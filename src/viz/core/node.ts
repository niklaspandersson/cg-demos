import { mat4, vec3 } from "gl-matrix";
import { Transform, type TransformOptions } from "./transform";
import type { Collector } from "../render/collector";

export type NodeOptions = TransformOptions & {
  name?: string;
  visible?: boolean;
};

let nextId = 0;

/**
 * One thing in the scene. A node has a transform, may have children, and may
 * contribute something to draw.
 *
 * Subclasses override `collect()` to add their geometry and gizmos. The base
 * node draws nothing, which makes it useful on its own as a grouping pivot.
 */
export class Node {
  readonly id = nextId++;
  name: string;
  visible = true;
  readonly transform: Transform;

  parent: Node | null = null;
  readonly children: Node[] = [];

  /** World matrix, refreshed once per frame by `updateWorldMatrix()`. */
  readonly worldMatrix = mat4.create();

  constructor(options: NodeOptions = {}) {
    this.transform = new Transform(options);
    this.name = options.name ?? `node-${this.id}`;
    if (options.visible !== undefined) this.visible = options.visible;
  }

  add<T extends Node>(child: T): T {
    child.parent?.remove(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(child: Node) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parent = null;
    }
    return this;
  }

  /** Depth-first walk over this node and everything below it. */
  *walk(): Generator<Node> {
    yield this;
    for (const child of this.children) yield* child.walk();
  }

  find(name: string): Node | undefined {
    for (const node of this.walk()) if (node.name === name) return node;
    return undefined;
  }

  /** Recompute this subtree's world matrices. Called once per frame. */
  updateWorldMatrix(parentWorld?: mat4) {
    this.transform.localMatrix(this.worldMatrix);
    if (parentWorld) mat4.multiply(this.worldMatrix, parentWorld, this.worldMatrix);

    for (const child of this.children) child.updateWorldMatrix(this.worldMatrix);
  }

  worldPosition(out: vec3 = vec3.create()) {
    return vec3.set(out, this.worldMatrix[12], this.worldMatrix[13], this.worldMatrix[14]);
  }

  /**
   * Hand the renderer whatever this node wants drawn.
   *
   * Lines pushed here are in the node's own local space - the collector
   * applies the world matrix - so a wireframe cube is simply the twelve edges
   * of a unit cube.
   */
  collect(_collector: Collector) {}
}
