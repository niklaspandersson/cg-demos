import { mat4, vec3 } from "gl-matrix";
import { Node, type NodeOptions } from "../core/node";
import type { Collector } from "../render/collector";
import { planeMesh } from "../geometry/primitives";
import {
  FRUSTUM_EDGES,
  frustumCorners,
  frustumSlice,
  sliceTransform,
  viewDepthToNdcZ,
} from "../gizmos/frustum";
import type { Color } from "../types";

export type ProjectionType = "perspective" | "orthographic";

export type SceneCameraGizmos = {
  /** A small wire camera shape, so it reads as a camera and not a point. */
  body?: boolean;
  /** Its local axes - the honest answer to "which way is it facing?". */
  axes?: boolean;
  frustum?: boolean;
  nearPlane?: boolean;
  farPlane?: boolean;
  /**
   * A projection plane at this distance in front of the camera, or false for
   * none. This is the surface the image is formed on.
   */
  imagePlane?: number | false;
  /** A dashed line from the camera to whatever it is aimed at. */
  lookAtLine?: boolean;
  /** The up vector, the other half of what `lookAt` needs. */
  up?: boolean;
};

export type SceneCameraOptions = NodeOptions & {
  projectionType?: ProjectionType;
  /** Vertical field of view in degrees, when perspective. */
  fov?: number;
  /** Width divided by height of the image this camera produces. */
  aspect?: number;
  near?: number;
  far?: number;
  /** Half the height of the box, when orthographic. */
  orthoHeight?: number;
  color?: Color;
  show?: SceneCameraGizmos;
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * A camera **inside** the scene: something you look at, not through.
 *
 * This is the object most of these illustrations are actually about. It draws
 * its own view volume, and `Playground.lookThrough()` can render the scene a
 * second time from it, so the frustum and the image it produces are on screen
 * together.
 *
 * The camera you view the illustration from is the `Viewer`, which is not
 * part of the scene at all.
 */
export class SceneCamera extends Node {
  projectionType: ProjectionType;
  fov: number;
  aspect: number;
  near: number;
  far: number;
  orthoHeight: number;

  /** One colour identifies this camera, its frustum and its inset view. */
  color: Color;
  show: SceneCameraGizmos;

  constructor(options: SceneCameraOptions = {}) {
    super({ name: "camera", ...options });

    this.projectionType = options.projectionType ?? "perspective";
    this.fov = options.fov ?? 45;
    this.aspect = options.aspect ?? 1.5;
    this.near = options.near ?? 1;
    this.far = options.far ?? 8;
    this.orthoHeight = options.orthoHeight ?? 2;
    this.color = options.color ?? [0.3, 0.8, 1];
    this.show = { body: true, frustum: true, ...options.show };
  }

  /**
   * A projection matrix to use instead of building one from the fields above.
   * Set this when the camera is standing in for one a demo built itself: the
   * frustum then shows that demo's real projection, whatever it is.
   */
  projectionOverride: mat4 | null = null;

  projectionMatrix(out: mat4 = mat4.create()): mat4 {
    if (this.projectionOverride) return mat4.copy(out, this.projectionOverride);

    if (this.projectionType === "orthographic") {
      const halfHeight = this.orthoHeight;
      const halfWidth = halfHeight * this.aspect;
      return mat4.ortho(out, -halfWidth, halfWidth, -halfHeight, halfHeight, this.near, this.far);
    }

    return mat4.perspective(out, this.fov * DEG_TO_RAD, this.aspect, this.near, this.far);
  }

  /** The view matrix is just the inverse of where the camera is standing. */
  viewMatrix(out: mat4 = mat4.create()): mat4 {
    return mat4.invert(out, this.worldMatrix) ?? mat4.identity(out);
  }

  focusRadius() {
    return Math.max(0.6, this.far * 0.3);
  }

  collect(collector: Collector) {
    const { seeThroughLines: lines } = collector;
    const projection = this.projectionMatrix();
    const corners = frustumCorners(projection);

    if (this.show.body) this.#collectBody(collector);
    if (this.show.axes) this.#collectAxes(collector);

    if (this.show.frustum && corners.length) {
      // Lines from the eye to the near corners, so the apex is visible even
      // when the near plane is far from the origin.
      for (let i = 0; i < 4; i++) lines.dashed([0, 0, 0], corners[i], this.#dim(0.55), 0.08);
      for (const [a, b] of FRUSTUM_EDGES) lines.line(corners[a], corners[b], this.color);
    }

    if (this.show.nearPlane) this.#collectSlice(collector, projection, -1, 0.22);
    if (this.show.farPlane) this.#collectSlice(collector, projection, 1, 0.12);

    if (typeof this.show.imagePlane === "number") {
      const ndcZ = viewDepthToNdcZ(projection, this.show.imagePlane);
      this.#collectSlice(collector, projection, ndcZ, 0.3, [1, 0.85, 0.4]);
    }

    if (this.show.up) {
      const length = Math.max(0.5, this.near);
      lines.line([0, 0, 0], [0, length, 0], [0.3, 0.85, 0.35]);
    }

    if (this.show.lookAtLine) {
      lines.dashed([0, 0, 0], [0, 0, -this.far], this.#dim(0.5), 0.12);
    }
  }

  /**
   * Stand this camera where a given view matrix puts it.
   *
   * A view matrix takes the world into the camera's space, so its inverse is
   * the camera's own place in the world. That one sentence is the whole
   * relationship between a camera and its view matrix.
   */
  setFromViewMatrix(view: mat4) {
    const world = mat4.invert(mat4.create(), view);
    if (!world) return this;

    mat4.getTranslation(this.transform.position, world);
    mat4.getRotation(this.transform.orientation, world);
    return this;
  }

  /**
   * A point on the camera's view axis, `depth` units in front of it, in world
   * space. The near plane is at `pointAtDepth(near)`, and a label put there
   * follows the plane when a slider moves it.
   */
  pointAtDepth(depth: number, out: vec3 = vec3.create()): vec3 {
    const m = this.worldMatrix;
    return vec3.set(
      out,
      m[12] - m[8] * depth,
      m[13] - m[9] * depth,
      m[14] - m[10] * depth,
    );
  }

  /** Where this camera is aimed, in world space. Handy for labelling. */
  forward(out: vec3 = vec3.create()): vec3 {
    const m = this.worldMatrix;
    return vec3.normalize(out, vec3.set(out, -m[8], -m[9], -m[10]));
  }

  #dim(alpha: number): Color {
    return [this.color[0], this.color[1], this.color[2], alpha];
  }

  #collectSlice(
    collector: Collector,
    projection: mat4,
    ndcZ: number,
    alpha: number,
    color: Color = this.color,
  ) {
    const corners = frustumSlice(projection, ndcZ);
    if (!corners.length) return;

    collector.seeThroughLines.polyline(corners, color, true);
    collector.mesh(collector.geometry("plane", planeMesh), [color[0], color[1], color[2], alpha], {
      unlit: true,
      local: sliceTransform(corners),
    });
  }

  /** Size of the local axes, in scene units. Independent of the projection. */
  axesSize = 1;

  #collectAxes(collector: Collector) {
    const s = this.axesSize;
    collector.seeThroughLines.line([0, 0, 0], [s, 0, 0], [0.9, 0.25, 0.25]);
    collector.seeThroughLines.line([0, 0, 0], [0, s, 0], [0.3, 0.85, 0.35]);
    collector.seeThroughLines.line([0, 0, 0], [0, 0, s], [0.35, 0.55, 1.0]);
  }

  /** A box with a lens cone on the front, pointing down -z. */
  #collectBody(collector: Collector) {
    const { seeThroughLines: lines } = collector;
    const w = 0.18;
    const h = 0.14;
    const back = 0.34;
    const front = 0.05;

    const box: [number, number, number][] = [
      [-w, -h, front], [w, -h, front], [w, h, front], [-w, h, front],
      [-w, -h, back], [w, -h, back], [w, h, back], [-w, h, back],
    ];
    for (const [a, b] of FRUSTUM_EDGES) lines.line(box[a], box[b], this.color);

    const lens = 0.22;
    const nose = -0.2;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      lines.line([x * w, y * h, front], [x * lens, y * lens, nose], this.color);
    }
    lines.polyline(
      ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(
        ([x, y]) => [x * lens, y * lens, nose] as [number, number, number],
      ),
      this.color,
      true,
    );
  }
}
