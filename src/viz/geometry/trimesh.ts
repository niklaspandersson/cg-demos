import { vec3 } from "gl-matrix";
import type { MeshData } from "../render/mesh";
import type { Color } from "../types";

/**
 * A mesh written out the way the first lecture defines one: a list of points,
 * and a list of triangles saying which three points to join.
 *
 * `primitives.ts` next door builds the same kinds of shape straight into GPU
 * buffers, which is what a library wants. This class is for the demo that is
 * *about* the two lists: it keeps them addressable, so a slider can reveal one
 * triangle at a time, a dot can be drawn on vertex 6, and the normal of face 3
 * can be pointed at.
 */

export type Vertex = readonly [number, number, number];

/** Three indices into `vertices`. Counter-clockwise seen from the front. */
export type Triangle = readonly [number, number, number];

export type UV = readonly [number, number];

export type Shading = "flat" | "smooth";

export type TriangleMeshOptions = {
  /** Used to key the uploaded geometry, so give each mesh its own. */
  name: string;
  vertices: readonly Vertex[];
  triangles: readonly Triangle[];
  /**
   * Texture coordinates, one per *corner of each triangle* rather than one per
   * vertex.
   *
   * That is deliberate. A cube is eight points, but a cube with a texture on
   * every face is not: the corner where three faces meet needs a different
   * (u, v) for each of them. Storing them per corner keeps the eight-point
   * description of the shape intact and leaves the seam where it belongs - in
   * the texture coordinates, which is exactly the lesson.
   */
  uvs?: readonly [UV, UV, UV][];
  /** One colour per triangle. */
  faceColors?: readonly Color[];
};

export class TriangleMesh {
  readonly name: string;
  readonly vertices: readonly Vertex[];
  readonly triangles: readonly Triangle[];
  readonly uvs: readonly [UV, UV, UV][] | null;
  faceColors: readonly Color[] | null;

  #vertexNormals: number[] | null = null;

  constructor(options: TriangleMeshOptions) {
    this.name = options.name;
    this.vertices = options.vertices;
    this.triangles = options.triangles;
    this.uvs = options.uvs ?? null;
    this.faceColors = options.faceColors ?? null;
  }

  get vertexCount() {
    return this.vertices.length;
  }

  get triangleCount() {
    return this.triangles.length;
  }

  /** Give every triangle a colour, from its index. */
  paint(color: (triangle: number) => Color) {
    this.faceColors = this.triangles.map((_, i) => color(i));
    return this;
  }

  /**
   * The normal of one triangle: the cross product of two of its edges.
   *
   * Which way it ends up pointing is decided by the order the three corners
   * are listed in, and nothing else. That is the whole of "winding order", and
   * it is why a triangle listed the wrong way round is lit from behind and
   * culled away.
   */
  faceNormal(index: number, out: vec3 = vec3.create()): vec3 {
    const [a, b, c] = this.triangles[index];
    const edge1 = vec3.subtract(vec3.create(), this.vertices[b] as vec3, this.vertices[a] as vec3);
    const edge2 = vec3.subtract(vec3.create(), this.vertices[c] as vec3, this.vertices[a] as vec3);
    return vec3.normalize(out, vec3.cross(out, edge1, edge2));
  }

  /** The middle of one triangle, which is where to start drawing its normal. */
  faceCenter(index: number, out: vec3 = vec3.create()): vec3 {
    const [a, b, c] = this.triangles[index];
    vec3.add(out, this.vertices[a] as vec3, this.vertices[b] as vec3);
    vec3.add(out, out, this.vertices[c] as vec3);
    return vec3.scale(out, out, 1 / 3);
  }

  /** Distance from the origin to the furthest vertex. Used for framing. */
  radius(): number {
    let longest = 0;
    for (const vertex of this.vertices) {
      longest = Math.max(longest, vec3.length(vertex as vec3));
    }
    return longest;
  }

  /**
   * The three sides of every triangle, as a flat list of endpoint pairs - the
   * wireframe. Shared edges are drawn twice, which costs nothing here and
   * keeps "an edge belongs to a triangle" true.
   */
  edges(upTo = this.triangleCount): number[] {
    const points: number[] = [];
    for (const [a, b, c] of this.triangles.slice(0, upTo)) {
      for (const [from, to] of [[a, b], [b, c], [c, a]]) {
        points.push(...this.vertices[from], ...this.vertices[to]);
      }
    }
    return points;
  }

  /**
   * One averaged normal per vertex: every triangle that uses a vertex votes,
   * and the result is normalised. This is what makes a sphere look round
   * instead of faceted, and what makes a cube look like a soft lump if you use
   * it there.
   */
  vertexNormals(): number[] {
    if (this.#vertexNormals) return this.#vertexNormals;

    const sums = this.vertices.map(() => vec3.create());
    const normal = vec3.create();

    for (let i = 0; i < this.triangleCount; i++) {
      this.faceNormal(i, normal);
      for (const corner of this.triangles[i]) vec3.add(sums[corner], sums[corner], normal);
    }

    this.#vertexNormals = sums.flatMap((sum) => [...vec3.normalize(sum, sum)]);
    return this.#vertexNormals;
  }

  /**
   * Turn the two lists into buffers the GPU can draw.
   *
   * Every triangle gets its own three vertices, even where neighbours share a
   * corner. A renderer that cared about memory would share them; this one
   * cares that a face can have its own normal, its own colour and its own
   * texture coordinates, which is the same reason `boxMesh()` next door splits
   * the cube into twenty-four vertices.
   */
  toMeshData(
    options: { shading?: Shading; upTo?: number; colored?: boolean } = {},
  ): MeshData {
    const shading = options.shading ?? "flat";
    const upTo = Math.min(options.upTo ?? this.triangleCount, this.triangleCount);
    const colored = (options.colored ?? false) && this.faceColors !== null;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const smooth = shading === "smooth" ? this.vertexNormals() : null;
    const faceNormal = vec3.create();

    for (let i = 0; i < upTo; i++) {
      const triangle = this.triangles[i];
      if (!smooth) this.faceNormal(i, faceNormal);

      const color = colored ? this.faceColors![i] : null;
      const faceUvs = this.uvs?.[i];

      for (let corner = 0; corner < 3; corner++) {
        const vertex = triangle[corner];
        positions.push(...this.vertices[vertex]);

        if (smooth) normals.push(smooth[vertex * 3], smooth[vertex * 3 + 1], smooth[vertex * 3 + 2]);
        else normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);

        if (this.uvs) uvs.push(faceUvs![corner][0], faceUvs![corner][1]);
        if (color) colors.push(color[0], color[1], color[2], color.length === 4 ? color[3] : 1);

        indices.push(positions.length / 3 - 1);
      }
    }

    return {
      positions,
      normals,
      indices,
      uvs: this.uvs ? uvs : undefined,
      colors: colored ? colors : undefined,
    };
  }
}
