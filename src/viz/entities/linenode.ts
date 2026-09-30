import { Node, type NodeOptions } from "../core/node";
import type { Collector } from "../render/collector";
import type { Color } from "../types";

export type LineNodeOptions = NodeOptions & {
  /** Flat xyz values, read as pairs of endpoints. */
  points: number[];
  color?: Color;
};

/** A fixed set of line segments. Grids and other static helpers are these. */
export class LineNode extends Node {
  points: number[];
  color: Color;

  constructor(options: LineNodeOptions) {
    super(options);
    this.points = options.points;
    this.color = options.color ?? [0.5, 0.5, 0.5];
  }

  collect(collector: Collector) {
    collector.lines.segments(this.points, this.color);
  }
}
