import type { mat4 } from "gl-matrix";
import type { LineBatch } from "./lines";
import type { GpuMesh, MeshData } from "./mesh";
import type { Color } from "../types";

export type MeshOptions = {
  /** Skip lighting and draw the flat colour. */
  unlit?: boolean;
  /** Extra transform applied inside the node's own space. */
  local?: mat4;
};

/**
 * What a node is handed during `collect()`. Anything it pushes here is drawn
 * this frame, positioned by the node's world matrix.
 */
export interface Collector {
  /** Line segments, in the collecting node's local space. */
  readonly lines: LineBatch;

  /**
   * Shared GPU geometry, uploaded the first time a given key is asked for.
   * Every unit cube in every scene ends up using the same buffers.
   */
  geometry(key: string, build: () => MeshData): GpuMesh;

  /** A solid surface. An alpha below 1 makes it a transparent one. */
  mesh(mesh: GpuMesh, color: Color, options?: MeshOptions): void;
}
