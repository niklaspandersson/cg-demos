import { Node, type NodeOptions } from "../core/node";
import { LineNode } from "../entities/linenode";
import { gridEdges } from "../geometry/primitives";
import type { Collector } from "../render/collector";
import type { Color } from "../types";

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
