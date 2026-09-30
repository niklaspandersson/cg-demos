import { Node, type NodeOptions } from "../core/node";
import type { Collector } from "../render/collector";
import type { MeshData } from "../render/mesh";
import type { Color } from "../types";
import {
  boxEdges,
  boxMesh,
  planeEdges,
  planeMesh,
  sphereEdges,
  sphereMesh,
} from "../geometry/primitives";

export type Shape = "box" | "plane" | "sphere";

export type MeshNodeOptions = NodeOptions & {
  shape?: Shape;
  /** Draw the edges instead of the surfaces. Defaults to true. */
  wireframe?: boolean;
  color?: Color;
  /** Draw the flat colour with no shading. */
  unlit?: boolean;
};

const SHAPES: Record<Shape, { solid: () => MeshData; edges: () => number[] }> = {
  box: { solid: boxMesh, edges: boxEdges },
  plane: { solid: planeMesh, edges: planeEdges },
  sphere: { solid: sphereMesh, edges: sphereEdges },
};

/**
 * A simple geometric object in the scene: a box, a plane or a sphere.
 *
 * Wireframe is the default, because an illustration usually needs to show
 * what is behind an object as well as the object itself.
 */
export class MeshNode extends Node {
  shape: Shape;
  wireframe: boolean;
  color: Color;
  unlit: boolean;

  #edges: number[] | null = null;

  constructor(options: MeshNodeOptions = {}) {
    super(options);
    this.shape = options.shape ?? "box";
    this.wireframe = options.wireframe ?? true;
    this.color = options.color ?? [0.85, 0.85, 0.9];
    this.unlit = options.unlit ?? false;
  }

  collect(collector: Collector) {
    const shape = SHAPES[this.shape];

    if (this.wireframe) {
      this.#edges ??= shape.edges();
      collector.lines.segments(this.#edges, this.color);
      return;
    }

    collector.mesh(collector.geometry(this.shape, shape.solid), this.color, {
      unlit: this.unlit,
    });
  }
}
