/**
 * A small library for building interactive illustrations of graphics
 * concepts: scenes containing cameras, lights and simple geometry that you
 * can fly around and inspect.
 *
 * Read CONVENTIONS.md first - it states the coordinate system, the units and
 * the two different meanings of "camera" that run through the whole library.
 */

export { Playground } from "./core/playground";
export { VizScene } from "./core/scene";
export { Node, type NodeOptions } from "./core/node";
export { Transform, type TransformOptions } from "./core/transform";

export { Viewer, type ViewerOptions } from "./camera/viewer";
export {
  ViewerControls,
  type ViewerControlsOptions,
  type ControlsMode,
} from "./camera/controls";

export { MeshNode, type MeshNodeOptions, type Shape } from "./entities/meshnode";
export { LineNode, type LineNodeOptions } from "./entities/linenode";

export {
  SceneCamera,
  type SceneCameraOptions,
  type SceneCameraGizmos,
  type ProjectionType,
} from "./entities/scenecamera";

export { grid, axes, AxesNode, type AxesOptions } from "./gizmos/helpers";
export {
  frustumCorners,
  frustumSlice,
  viewDepthToNdcZ,
  unproject,
  FRUSTUM_EDGES,
} from "./gizmos/frustum";

export { VizRenderer } from "./render/renderer";
export { LineBatch } from "./render/lines";
export { GpuMesh, type MeshData } from "./render/mesh";
export type { Collector, MeshOptions } from "./render/collector";

export * as primitives from "./geometry/primitives";

export { rgba, type Color, type Vec3Like } from "./types";
