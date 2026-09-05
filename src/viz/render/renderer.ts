import { mat3, mat4, vec3 } from "gl-matrix";
import type { GLSLProgram } from "../../gl/program";
import type { Node } from "../core/node";
import { LineBatch } from "./lines";
import { GpuMesh, type MeshData } from "./mesh";
import { createLineProgram, createSurfaceProgram } from "./programs";
import type { Collector, LightInfo, MeshOptions } from "./collector";
import { rgba, type Color } from "../types";

const OFF: [number, number, number] = [0, 0, 0];
const DOWN: [number, number, number] = [0, -1, 0];

type MeshItem = {
  mesh: GpuMesh;
  world: mat4;
  color: [number, number, number, number];
  unlit: boolean;
  /** view space depth, only used to sort the transparent ones */
  depth: number;
};

/**
 * Draws a scene from a given point of view.
 *
 * The renderer knows nothing about cameras, lights or frustums. It takes a
 * view matrix and a projection matrix, walks the scene asking every node what
 * it wants drawn, and draws it in three passes: solids, transparent surfaces
 * back to front, then all the lines in one go.
 */
export class VizRenderer {
  #gl: WebGL2RenderingContext;
  #lines: LineBatch;
  #seeThrough: LineBatch;
  #lineProgram: GLSLProgram | null = null;
  #surfaceProgram: GLSLProgram | null = null;

  ambient = 0.35;

  /**
   * How brightly to draw the parts of lines that are hidden behind something.
   * A frustum you cannot see through the objects inside it is not much use in
   * an illustration, so this is on by default. Set it to 0 for honest
   * occlusion.
   */
  xray = 0.2;

  /** Line width in pixels. */
  set lineThickness(pixels: number) {
    this.#lines.thickness = pixels;
    this.#seeThrough.thickness = pixels;
  }
  get lineThickness() {
    return this.#lines.thickness;
  }

  /**
   * Used when a scene contains no directional light of its own, so that a
   * demo about something else still gets readable shading for free.
   */
  defaultLight: LightInfo | null = {
    kind: "directional",
    color: [0.75, 0.75, 0.78],
    direction: [-0.4, -1, -0.35],
  };

  #lights: LightInfo[] = [];

  #scratch = vec3.create();
  #opaque: MeshItem[] = [];
  #transparent: MeshItem[] = [];
  #meshCache = new Map<string, GpuMesh>();

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#lines = new LineBatch(gl);
    this.#seeThrough = new LineBatch(gl);
  }

  async init() {
    this.#lineProgram = await createLineProgram(this.#gl);
    this.#surfaceProgram = await createSurfaceProgram(this.#gl);
  }

  /**
   * Upload a piece of geometry once and reuse it. Every unit cube in every
   * scene shares one set of buffers.
   */
  mesh(key: string, build: () => MeshData): GpuMesh {
    let mesh = this.#meshCache.get(key);
    if (!mesh) {
      mesh = new GpuMesh(this.#gl, build());
      this.#meshCache.set(key, mesh);
    }
    return mesh;
  }

  render(root: Node, view: mat4, projection: mat4, options: { skip?: Node } = {}) {
    const gl = this.#gl;
    const viewProjection = mat4.multiply(mat4.create(), projection, view);

    this.#opaque.length = 0;
    this.#transparent.length = 0;
    this.#lights.length = 0;
    this.#lines.clear();
    this.#seeThrough.clear();

    this.#collect(root, view, options.skip);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.#drawMeshes(this.#opaque, viewProjection);

    // Lines are opaque and write depth, so they go before the transparent
    // pass: a glass plane should tint the grid behind it, and be hidden by a
    // frustum edge in front of it.
    this.#drawLines(viewProjection);

    // Transparent surfaces blend, so they are drawn last, back to front, and
    // must not write depth - otherwise they hide each other.
    this.#transparent.sort((a, b) => a.depth - b.depth);
    gl.depthMask(false);
    this.#drawMeshes(this.#transparent, viewProjection);
    gl.depthMask(true);
  }

  dispose() {
    this.#lines.dispose();
    this.#seeThrough.dispose();
    for (const mesh of this.#meshCache.values()) mesh.dispose();
    this.#meshCache.clear();
  }

  #collect(node: Node, view: mat4, skip?: Node) {
    if (!node.visible || node === skip) return;

    const collector: Collector = {
      lines: this.#lines,
      seeThroughLines: this.#seeThrough,
      geometry: (key, build) => this.mesh(key, build),
      light: (info: LightInfo) => this.#lights.push(info),
      mesh: (mesh: GpuMesh, color: Color, options: MeshOptions = {}) => {
        const world = options.local
          ? mat4.multiply(mat4.create(), node.worldMatrix, options.local)
          : node.worldMatrix;

        // Sort transparent surfaces by where they actually sit, which is not
        // the node's origin once a local offset is involved.
        const depth = vec3.transformMat4(
          vec3.set(this.#scratch, world[12], world[13], world[14]),
          this.#scratch,
          view,
        )[2];

        const rgbaColor = rgba(color);
        const item: MeshItem = {
          mesh,
          world,
          color: rgbaColor,
          unlit: options.unlit ?? false,
          depth,
        };
        (rgbaColor[3] < 1 ? this.#transparent : this.#opaque).push(item);
      },
    };

    // Gizmos push their lines in local space; the batch moves them to world
    // space so a wireframe cube is just the edges of a unit cube.
    this.#lines.transform = node.worldMatrix;
    this.#seeThrough.transform = node.worldMatrix;
    node.collect(collector);
    this.#lines.transform = null;
    this.#seeThrough.transform = null;

    for (const child of node.children) this.#collect(child, view, skip);
  }

  #drawLines(viewProjection: mat4) {
    const gl = this.#gl;
    if (this.#lines.segmentCount === 0 && this.#seeThrough.segmentCount === 0) return;

    this.#lines.upload();
    this.#seeThrough.upload();

    const uniforms = this.#lineProgram!.use();
    uniforms.uViewProjection = viewProjection;
    uniforms.uThickness = this.#lines.thickness;
    uniforms.uHalfViewport = [gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2];

    // The hidden parts of the gizmos first, faintly, with the depth test
    // inverted. They must not write depth, or they would hide the pass that
    // draws the same lines where they are actually visible.
    if (this.xray > 0) {
      gl.depthFunc(gl.GREATER);
      gl.depthMask(false);
      uniforms.uOpacity = this.xray;
      this.#seeThrough.draw();
      gl.depthMask(true);
      gl.depthFunc(gl.LEQUAL);
    }

    uniforms.uOpacity = 1;
    this.#lines.draw();
    this.#seeThrough.draw();
  }

  /**
   * One light of each kind reaches the shader. A scene with more than that is
   * past the point where an illustration is still illustrating anything.
   */
  #applyLights(uniforms: Record<string, unknown>) {
    const directional =
      this.#lights.find((l) => l.kind === "directional") ??
      (this.#lights.length === 0 ? this.defaultLight ?? undefined : undefined);
    const point = this.#lights.find((l) => l.kind === "point");
    const spot = this.#lights.find((l) => l.kind === "spot");

    uniforms.uDirectionalColor = directional?.color ?? OFF;
    uniforms.uDirectionalDirection = directional?.direction ?? DOWN;

    uniforms.uPointColor = point?.color ?? OFF;
    uniforms.uPointPosition = point?.position ?? OFF;
    uniforms.uPointRange = point?.range ?? 10;

    uniforms.uSpotColor = spot?.color ?? OFF;
    uniforms.uSpotPosition = spot?.position ?? OFF;
    uniforms.uSpotDirection = spot?.direction ?? DOWN;
    uniforms.uSpotRange = spot?.range ?? 10;
    uniforms.uSpotCone = spot?.cone ?? [1, 1];
  }

  #drawMeshes(items: MeshItem[], viewProjection: mat4) {
    if (items.length === 0) return;

    const uniforms = this.#surfaceProgram!.use();
    uniforms.uViewProjection = viewProjection;
    uniforms.uAmbient = this.ambient;
    this.#applyLights(uniforms);

    const normalMatrix = mat3.create();
    for (const item of items) {
      mat3.normalFromMat4(normalMatrix, item.world);
      uniforms.uModel = item.world;
      uniforms.uNormalMatrix = normalMatrix;
      uniforms.uColor = item.color;
      uniforms.uUnlit = item.unlit ? 1 : 0;
      item.mesh.draw();
    }
  }
}
