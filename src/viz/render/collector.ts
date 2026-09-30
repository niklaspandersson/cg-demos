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
 * A light's contribution to shading, in world space. Gathered during
 * traversal so it is ready by the time surfaces are drawn.
 */
export type LightInfo = {
  kind: "directional" | "point" | "spot";
  color: [number, number, number];
  /** The direction the light travels. Directional and spot lights only. */
  direction?: [number, number, number];
  /** Point and spot lights only. */
  position?: [number, number, number];
  /** Distance at which a point or spot light has faded to a quarter. */
  range?: number;
  /** Cosines of the outer and inner cone angles. Spot lights only. */
  cone?: [number, number];
};

/**
 * What a node is handed during `collect()`. Anything it pushes here is drawn
 * this frame, positioned by the node's world matrix.
 */
export interface Collector {
  /**
   * Line segments, in the collecting node's local space. Occluded normally:
   * something behind a solid box is behind it.
   */
  readonly lines: LineBatch;

  /**
   * The same, but the hidden parts still show faintly.
   *
   * The rule of thumb: scenery uses `lines`, gizmos use this one. A frustum
   * or a light cone is an explanation drawn over the scene, and an
   * explanation you cannot see because a box is in the way explains nothing.
   */
  readonly seeThroughLines: LineBatch;

  /**
   * Shared GPU geometry, uploaded the first time a given key is asked for.
   * Every unit cube in every scene ends up using the same buffers.
   */
  geometry(key: string, build: () => MeshData): GpuMesh;

  /** A solid surface. An alpha below 1 makes it a transparent one. */
  mesh(mesh: GpuMesh, color: Color, options?: MeshOptions): void;

  /** Contribute to how surfaces in this scene are shaded. */
  light(info: LightInfo): void;
}
