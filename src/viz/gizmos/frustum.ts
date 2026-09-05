import { mat4, vec3, vec4 } from "gl-matrix";

/**
 * The eight corners of the canonical view volume, near face first.
 *
 * Note the z range: WebGL and OpenGL put normalised device coordinates
 * between -1 and +1 on *all three* axes. Direct3D, Vulkan and WebGPU use 0..1
 * for depth, which is why this list is the one thing in the library that has
 * to be told which API it is drawing for.
 */
const NDC_CORNERS: [number, number, number][] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], // near
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],     // far
];

/** Edges between those corners: the near square, the far square, the sides. */
export const FRUSTUM_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Undo a projection: take a point in normalised device coordinates back to
 * the space the projection was applied in.
 *
 * The perspective divide is right there on the last line. Doing it this way
 * rather than working out the corners trigonometrically is the whole point:
 * a perspective frustum and an orthographic one come out of the *same* four
 * lines of code, so switching a camera between them shows the shape morph
 * from a truncated pyramid into a box with nothing special-cased.
 */
export function unproject(ndc: vec3, inverseProjection: mat4, out: vec3 = vec3.create()): vec3 {
  const p = vec4.transformMat4(vec4.create(), [ndc[0], ndc[1], ndc[2], 1], inverseProjection);
  return vec3.set(out, p[0] / p[3], p[1] / p[3], p[2] / p[3]);
}

/**
 * The eight corners of a projection's view volume, in the space the camera
 * itself lives in (-z forward). Order matches `FRUSTUM_EDGES`.
 */
export function frustumCorners(projection: mat4): vec3[] {
  const inverse = mat4.invert(mat4.create(), projection);
  if (!inverse) return [];

  return NDC_CORNERS.map((corner) => unproject(corner as unknown as vec3, inverse));
}

/**
 * Where a given view-space depth ends up in normalised device coordinates.
 * Used to slice the frustum at an arbitrary distance from the camera.
 */
export function viewDepthToNdcZ(projection: mat4, depth: number): number {
  const clip = vec4.transformMat4(vec4.create(), [0, 0, -depth, 1], projection);
  return clip[3] === 0 ? 0 : clip[2] / clip[3];
}

/**
 * The four corners of the cross section of the frustum at one NDC depth,
 * counter-clockwise. At z = -1 that is the near plane, at z = +1 the far
 * plane, and anywhere in between it is a projection plane you can slide back
 * and forth.
 */
export function frustumSlice(projection: mat4, ndcZ: number): vec3[] {
  const inverse = mat4.invert(mat4.create(), projection);
  if (!inverse) return [];

  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) =>
    unproject([x, y, ndcZ] as unknown as vec3, inverse),
  );
}

/**
 * A slice described as a transform of the unit plane, so it can be drawn as
 * a filled, semi-transparent quad rather than just an outline.
 */
export function sliceTransform(corners: vec3[], out: mat4 = mat4.create()): mat4 {
  const width = corners[1][0] - corners[0][0];
  const height = corners[2][1] - corners[1][1];
  const z = (corners[0][2] + corners[2][2]) / 2;
  const x = (corners[0][0] + corners[2][0]) / 2;
  const y = (corners[0][1] + corners[2][1]) / 2;

  mat4.identity(out);
  mat4.translate(out, out, [x, y, z]);
  mat4.scale(out, out, [width, height, 1]);
  return out;
}

/** A plane as [nx, ny, nz, d], where a point is inside when n.p + d >= 0. */
export type Plane = [number, number, number, number];

/**
 * The six planes bounding a frustum, from a combined projection * view
 * matrix, pointing inwards.
 *
 * Each plane is a sum or difference of two rows of the matrix. That falls
 * straight out of what clipping tests: a point is inside the left plane when
 * its clip-space x is at least -w, which is (row3 + row0) . p >= 0. The other
 * five are the same argument for the other five bounds.
 */
export function frustumPlanes(viewProjection: mat4): Plane[] {
  const m = viewProjection;
  // gl-matrix stores columns, so row i column j is m[j * 4 + i].
  const row = (i: number): Plane => [m[i], m[4 + i], m[8 + i], m[12 + i]];

  const w = row(3);
  const combine = (r: Plane, sign: number): Plane => {
    const plane: Plane = [
      w[0] + sign * r[0],
      w[1] + sign * r[1],
      w[2] + sign * r[2],
      w[3] + sign * r[3],
    ];
    const length = Math.hypot(plane[0], plane[1], plane[2]) || 1;
    return [plane[0] / length, plane[1] / length, plane[2] / length, plane[3] / length];
  };

  return [
    combine(row(0), 1),  // left
    combine(row(0), -1), // right
    combine(row(1), 1),  // bottom
    combine(row(1), -1), // top
    combine(row(2), 1),  // near
    combine(row(2), -1), // far
  ];
}

/**
 * Whether a sphere is at least partly inside. This is the test a renderer
 * actually uses to cull: cheap, and wrong only in the harmless direction -
 * it can keep something that turns out to be invisible, never drop something
 * that would have been seen.
 */
export function sphereInFrustum(planes: Plane[], center: vec3, radius: number): boolean {
  for (const [nx, ny, nz, d] of planes) {
    if (nx * center[0] + ny * center[1] + nz * center[2] + d < -radius) return false;
  }
  return true;
}
