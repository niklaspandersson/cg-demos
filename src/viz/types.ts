import type { ReadonlyVec3 } from "gl-matrix";

/** A point or direction. Accepts a plain `[x, y, z]` literal. */
export type Vec3Like = ReadonlyVec3;

/** Linear RGB(A) in the 0..1 range. Alpha defaults to 1. */
export type Color =
  | readonly [number, number, number]
  | readonly [number, number, number, number];

export function rgba(color: Color): [number, number, number, number] {
  return [color[0], color[1], color[2], color.length === 4 ? color[3] : 1];
}
