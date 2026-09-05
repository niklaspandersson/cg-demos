import { vec3 } from "gl-matrix";
import { Node, type NodeOptions } from "../core/node";
import { LineNode } from "../entities/linenode";
import { gridEdges } from "../geometry/primitives";
import type { Collector } from "../render/collector";
import type { LineBatch } from "../render/lines";
import type { Color, Vec3Like } from "../types";

/** A ground plane grid in xz, to give the scene a floor to read against. */
export function grid(
  options: NodeOptions & { size?: number; step?: number; color?: Color } = {},
) {
  const size = options.size ?? 10;
  const step = options.step ?? 1;

  return new LineNode({
    name: "grid",
    ...options,
    points: gridEdges(size, step),
    color: options.color ?? [0.55, 0.57, 0.62],
  });
}

export type AxesOptions = NodeOptions & {
  /** Length of each arm. */
  size?: number;
};

/**
 * The local coordinate system of whatever it is attached to: x red, y green,
 * z blue. Add it as a child of a node to see which way that node is facing.
 */
export class AxesNode extends Node {
  size: number;

  constructor(options: AxesOptions = {}) {
    super({ name: "axes", ...options });
    this.size = options.size ?? 1;
  }

  collect(collector: Collector) {
    const s = this.size;
    collector.lines.line([0, 0, 0], [s, 0, 0], [0.9, 0.25, 0.25]);
    collector.lines.line([0, 0, 0], [0, s, 0], [0.3, 0.85, 0.35]);
    collector.lines.line([0, 0, 0], [0, 0, s], [0.35, 0.55, 1.0]);
  }
}

export const axes = (options: AxesOptions = {}) => new AxesNode(options);

/**
 * A line with a small four-barb head, for showing a direction. Barbs are
 * built from any two vectors perpendicular to the shaft, so it reads as an
 * arrow from every viewing angle.
 */
export function arrow(
  lines: LineBatch,
  from: Vec3Like,
  to: Vec3Like,
  color: Color,
  headLength = 0.22,
) {
  lines.line(from, to, color);

  const shaft = vec3.subtract(vec3.create(), to as vec3, from as vec3);
  const length = vec3.length(shaft);
  if (length < 1e-5) return;
  vec3.scale(shaft, shaft, 1 / length);

  const head = Math.min(headLength, length * 0.4);
  const reference: Vec3Like = Math.abs(shaft[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const side = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), shaft, reference));
  const other = vec3.cross(vec3.create(), shaft, side);

  const base = vec3.scaleAndAdd(vec3.create(), to as vec3, shaft, -head);
  for (const axis of [side, other]) {
    for (const sign of [1, -1]) {
      lines.line(to, vec3.scaleAndAdd(vec3.create(), base, axis, sign * head * 0.45), color);
    }
  }
}

/** A circle of `segments` points, perpendicular to `axis`, centred on `center`. */
export function ring(center: Vec3Like, radius: number, segments = 32): vec3[] {
  const points: vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(
      vec3.fromValues(
        center[0] + Math.cos(a) * radius,
        center[1] + Math.sin(a) * radius,
        center[2],
      ),
    );
  }
  return points;
}
