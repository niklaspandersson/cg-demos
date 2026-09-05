import { vec3 } from "gl-matrix";
import {
  MeshNode,
  Node,
  Playground,
  SceneCamera,
  grid,
  primitives,
} from "../../viz";
import type { Collector } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * How a 3D point becomes a 2D one.
 *
 * A line is drawn from the eye through every corner of the object, and where
 * that line crosses the projection plane is where the corner lands in the
 * image. Slide the plane back and forth: the picture on it grows and shrinks,
 * but the *shape* does not change, because all these lines meet at the eye.
 *
 * That is the whole of perspective projection, and the division by z below is
 * the perspective divide with nothing hidden.
 */
class ProjectionRays extends Node {
  /** Distance from the eye to the projection plane. */
  depth = 3;

  #camera: SceneCamera;
  #subject: MeshNode;
  #corners = primitives.boxEdges();

  constructor(camera: SceneCamera, subject: MeshNode) {
    super({ name: "projection rays" });
    this.#camera = camera;
    this.#subject = subject;
  }

  collect(collector: Collector) {
    // This node is a child of the camera, so its local space *is* camera
    // space: the eye is at the origin, looking down -z.
    const lines = collector.seeThroughLines;
    const view = this.#camera.viewMatrix();

    const point = vec3.create();
    const hit = vec3.create();
    const previous = vec3.create();
    let havePrevious = false;

    for (let i = 0; i < this.#corners.length; i += 3) {
      // A corner of the unit box -> world space -> camera space.
      vec3.set(point, this.#corners[i], this.#corners[i + 1], this.#corners[i + 2]);
      vec3.transformMat4(point, point, this.#subject.worldMatrix);
      vec3.transformMat4(point, point, view);

      // Everything in front of the eye has a negative z, so this is where the
      // ray through the corner crosses the plane at z = -depth. Dividing by
      // the corner's own z is the perspective divide, with nothing hidden.
      if (point[2] >= -0.001) continue;
      vec3.scale(hit, point, -this.depth / point[2]);

      lines.dashed([0, 0, 0], point, [1, 1, 1, 0.3], 0.15);
      lines.line([0, 0, 0], hit, [1, 0.85, 0.4, 0.9]);

      // The corners arrive as the endpoints of the box's edges, so joining
      // each pair draws the projected outline for free.
      if (havePrevious) lines.line(previous, hit, [1, 0.85, 0.4]);
      vec3.copy(previous, hit);
      havePrevious = !havePrevious;
    }
  }
}

export default class Scene extends Playground {
  #camera!: SceneCamera;
  #rays!: ProjectionRays;
  #subject!: MeshNode;

  setup() {
    this.viewer.set({ target: [0, 1, -1.5], fov: 45 });
    this.viewer.setOrbit(58, 24, 16);

    this.scene.add(grid({ size: 14, step: 1 }));

    this.#camera = this.scene.add(
      new SceneCamera({
        name: "Camera",
        position: [0, 1.2, 4.5],
        lookAt: [0, 1, -3],
        fov: 50,
        aspect: 1.4,
        near: 0.5,
        far: 8,
        color: [0.35, 0.8, 1],
        show: { body: true, frustum: true, imagePlane: 3 },
      }),
    );
    this.label("eye", this.#camera, { offset: [0, 0.5, 0] });
    this.label("projection plane", () => this.#camera.pointAtDepth(this.#rays.depth), {
      color: [1, 0.85, 0.4],
      offset: [0, 1.1, 0],
    });

    this.#subject = this.scene.add(
      new MeshNode({
        name: "subject",
        shape: "box",
        position: [0, 1, -2.5],
        scale: 1.4,
        color: [0.95, 0.95, 1],
      }),
    );

    this.#rays = this.#camera.add(new ProjectionRays(this.#camera, this.#subject));

    this.lookThrough(this.#camera, { widthFraction: 0.28 });
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Plane distance",
        type: "number",
        min: 0.6,
        max: 6,
        step: 0.05,
        initial: 3,
        update: (value: number) => {
          this.#rays.depth = value;
          this.#camera.show.imagePlane = value;
        },
      },
      {
        title: "Object distance",
        type: "number",
        min: -6,
        max: -1,
        step: 0.05,
        initial: -2.5,
        update: (value: number) => (this.#subject.transform.position[2] = value),
      },
      {
        title: "Object size",
        type: "number",
        min: 0.4,
        max: 2.5,
        step: 0.05,
        initial: 1.4,
        update: (value: number) => this.#subject.transform.setScale(value),
      },
    ];
  }
}
