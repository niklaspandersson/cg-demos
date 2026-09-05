import { mat3, mat4, vec3 } from "gl-matrix";
import type { GLSLProgram } from "../../gl/program";
import type { Node } from "../core/node";
import { LineBatch } from "./lines";
import { GpuMesh, type MeshData } from "./mesh";
import { createLineProgram, createSurfaceProgram } from "./programs";
import type { Collector, MeshOptions } from "./collector";
import { rgba, type Color } from "../types";

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
  #lineProgram: GLSLProgram | null = null;
  #surfaceProgram: GLSLProgram | null = null;

  /** Direction the default light travels. Lit surfaces use this until Phase 4. */
  lightDirection: vec3 = vec3.normalize(vec3.create(), [-0.4, -1, -0.35]);
  ambient = 0.35;

  #opaque: MeshItem[] = [];
  #transparent: MeshItem[] = [];
  #meshCache = new Map<string, GpuMesh>();

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#lines = new LineBatch(gl);
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

  render(root: Node, view: mat4, projection: mat4) {
    const gl = this.#gl;
    const viewProjection = mat4.multiply(mat4.create(), projection, view);

    this.#opaque.length = 0;
    this.#transparent.length = 0;
    this.#lines.clear();

    this.#collect(root, view);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.#drawMeshes(this.#opaque, viewProjection);

    // Lines are opaque and write depth, so they go before the transparent
    // pass: a glass plane should tint the grid behind it, and be hidden by a
    // frustum edge in front of it.
    const lineUniforms = this.#lineProgram!.use();
    lineUniforms.uViewProjection = viewProjection;
    this.#lines.flush();

    // Transparent surfaces blend, so they are drawn last, back to front, and
    // must not write depth - otherwise they hide each other.
    this.#transparent.sort((a, b) => a.depth - b.depth);
    gl.depthMask(false);
    this.#drawMeshes(this.#transparent, viewProjection);
    gl.depthMask(true);
  }

  dispose() {
    this.#lines.dispose();
    for (const mesh of this.#meshCache.values()) mesh.dispose();
    this.#meshCache.clear();
  }

  #collect(node: Node, view: mat4) {
    if (!node.visible) return;

    const position = node.worldPosition(vec3.create());
    const depth = vec3.transformMat4(position, position, view)[2];

    const collector: Collector = {
      lines: this.#lines,
      geometry: (key, build) => this.mesh(key, build),
      mesh: (mesh: GpuMesh, color: Color, options: MeshOptions = {}) => {
        const rgbaColor = rgba(color);
        const item: MeshItem = {
          mesh,
          world: node.worldMatrix,
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
    node.collect(collector);
    this.#lines.transform = null;

    for (const child of node.children) this.#collect(child, view);
  }

  #drawMeshes(items: MeshItem[], viewProjection: mat4) {
    if (items.length === 0) return;

    const uniforms = this.#surfaceProgram!.use();
    uniforms.uViewProjection = viewProjection;
    uniforms.uLightDirection = this.lightDirection;
    uniforms.uAmbient = this.ambient;

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
