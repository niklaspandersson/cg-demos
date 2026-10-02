import { vec3 } from "gl-matrix";
import { Node, type NodeOptions } from "../core/node";
import type { Shading, TriangleMesh } from "../geometry/trimesh";
import { arrow } from "../gizmos/helpers";
import type { Collector } from "../render/collector";
import type { Color } from "../types";

const NORMAL_COLOR: Color = [0.45, 0.85, 0.95];

export type GeometryNodeOptions = NodeOptions & {
  mesh: TriangleMesh;
  color?: Color;
  /** Fill the triangles in. On by default. */
  faces?: boolean;
  /** Draw the three sides of every triangle. */
  edges?: boolean;
  /** Draw a dot on every vertex. */
  vertices?: boolean;
  /** Draw each triangle's normal as a short arrow from its middle. */
  normals?: boolean;
  /** How many triangles of the mesh to draw. Defaults to all of them. */
  reveal?: number;
  /** How many vertices to draw dots on. Defaults to all of them. */
  revealVertices?: number;
  /** One normal per triangle, or one averaged normal per vertex. */
  shading?: Shading;
  /** Use the mesh's own per-triangle colours instead of one flat colour. */
  colorFaces?: boolean;
  unlit?: boolean;
  edgeColor?: Color;
  vertexColor?: Color;
  /** Diameter of the vertex dots, in pixels. */
  pointSize?: number;
  normalLength?: number;
  texture?: WebGLTexture | null;
  textureScale?: readonly [number, number];
  /** Pick out the triangle that was revealed last, while they are appearing. */
  highlightLast?: boolean;
  highlightColor?: Color;
};

/**
 * A node that draws a `TriangleMesh` - and, more to the point, draws the parts
 * of it separately.
 *
 * `MeshNode` answers "put a box here". This answers "show me what a box *is*":
 * the dots are the vertices, the lines are the triangles' sides, the surfaces
 * are what the rasteriser fills in, and the arrows are the normals the lighting
 * will use. Each of those can be turned on by itself, which is how one object
 * can carry a whole course.
 */
export class GeometryNode extends Node {
  mesh: TriangleMesh;
  color: Color;
  faces: boolean;
  edges: boolean;
  vertices: boolean;
  normals: boolean;
  reveal: number;
  revealVertices: number;
  shading: Shading;
  colorFaces: boolean;
  unlit: boolean;
  edgeColor: Color;
  vertexColor: Color;
  pointSize: number;
  normalLength: number;
  texture: WebGLTexture | null;
  textureScale: readonly [number, number];
  highlightLast: boolean;
  highlightColor: Color;

  #edgeCache = new Map<number, number[]>();
  #center = vec3.create();
  #tip = vec3.create();

  constructor(options: GeometryNodeOptions) {
    super(options);

    this.mesh = options.mesh;
    this.color = options.color ?? [0.82, 0.78, 0.7];
    this.faces = options.faces ?? true;
    this.edges = options.edges ?? false;
    this.vertices = options.vertices ?? false;
    this.normals = options.normals ?? false;
    this.reveal = options.reveal ?? this.mesh.triangleCount;
    this.revealVertices = options.revealVertices ?? this.mesh.vertexCount;
    this.shading = options.shading ?? "flat";
    this.colorFaces = options.colorFaces ?? false;
    this.unlit = options.unlit ?? false;
    this.edgeColor = options.edgeColor ?? [0.1, 0.11, 0.15];
    this.vertexColor = options.vertexColor ?? [1, 0.82, 0.3];
    this.pointSize = options.pointSize ?? 9;
    this.normalLength = options.normalLength ?? 0.4;
    this.texture = options.texture ?? null;
    this.textureScale = options.textureScale ?? [1, 1];
    this.highlightLast = options.highlightLast ?? false;
    this.highlightColor = options.highlightColor ?? [1, 0.85, 0.35];
  }

  /** Show every triangle. */
  revealAll() {
    this.reveal = this.mesh.triangleCount;
    this.revealVertices = this.mesh.vertexCount;
    return this;
  }

  focusRadius() {
    const m = this.worldMatrix;
    const scale = Math.max(
      Math.hypot(m[0], m[1], m[2]),
      Math.hypot(m[4], m[5], m[6]),
      Math.hypot(m[8], m[9], m[10]),
    );
    return Math.max(0.3, this.mesh.radius() * scale);
  }

  collect(collector: Collector) {
    const triangles = Math.max(0, Math.min(Math.round(this.reveal), this.mesh.triangleCount));

    if (this.faces && triangles > 0) this.#collectFaces(collector, triangles);
    if (this.edges && triangles > 0) {
      collector.lines.segments(this.#edgesUpTo(triangles), this.edgeColor);
    }

    // While the triangles are appearing one at a time, the one that just
    // arrived is the only interesting one - including when it has landed on the
    // far side, which is why this outline shows through the others.
    if (this.highlightLast && triangles > 0) {
      const [a, b, c] = this.mesh.triangles[triangles - 1];
      const corners = [a, b, c].map((index) => this.mesh.vertices[index]);
      collector.seeThroughLines.polyline(corners, this.highlightColor, true);
    }

    if (this.vertices) {
      const count = Math.min(Math.round(this.revealVertices), this.mesh.vertexCount);
      for (let i = 0; i < count; i++) {
        collector.points.point(this.mesh.vertices[i], this.vertexColor, this.pointSize);
      }
    }

    // The arrows show the normals the shader is actually using, which is not
    // the same set in the two shading modes: one per face, or one per vertex.
    if (this.normals && this.shading === "smooth") this.#collectVertexNormals(collector, triangles);
    else if (this.normals) this.#collectFaceNormals(collector, triangles);
  }

  #collectFaceNormals(collector: Collector, triangles: number) {
    for (let i = 0; i < triangles; i++) {
      this.mesh.faceCenter(i, this.#center);
      this.mesh.faceNormal(i, this.#tip);
      vec3.scaleAndAdd(this.#tip, this.#center, this.#tip, this.normalLength);
      arrow(collector.seeThroughLines, this.#center, this.#tip, NORMAL_COLOR, 0.1);
    }
  }

  #collectVertexNormals(collector: Collector, triangles: number) {
    const normals = this.mesh.vertexNormals();
    const shown = new Set<number>();
    for (let i = 0; i < triangles; i++) for (const corner of this.mesh.triangles[i]) shown.add(corner);

    for (const index of shown) {
      const from = this.mesh.vertices[index];
      vec3.set(this.#tip, normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2]);
      vec3.scaleAndAdd(this.#tip, from as vec3, this.#tip, this.normalLength);
      arrow(collector.seeThroughLines, from, this.#tip, NORMAL_COLOR, 0.1);
    }
  }

  #collectFaces(collector: Collector, triangles: number) {
    const colored = this.colorFaces && this.mesh.faceColors !== null;

    // Every combination of "how much of it" and "shaded which way" is its own
    // piece of geometry, uploaded once and then reused. A slider sweeping
    // through the triangles therefore uploads each step only the first time it
    // is reached.
    const key = `tri:${this.mesh.name}:${this.shading}:${triangles}:${colored ? "c" : "f"}`;
    const geometry = collector.geometry(key, () =>
      this.mesh.toMeshData({ shading: this.shading, upTo: triangles, colored }),
    );

    collector.mesh(geometry, this.color, {
      unlit: this.unlit,
      texture: this.texture,
      textureScale: this.textureScale,
    });
  }

  #edgesUpTo(triangles: number): number[] {
    let edges = this.#edgeCache.get(triangles);
    if (!edges) {
      edges = this.mesh.edges(triangles);
      this.#edgeCache.set(triangles, edges);
    }
    return edges;
  }
}
