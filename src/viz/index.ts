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

export { SceneInspector, type SceneInspectorOptions } from "./inspect";

export { Viewer, type ViewerOptions } from "./camera/viewer";
export {
  ViewerControls,
  type ViewerControlsOptions,
  type ControlsMode,
} from "./camera/controls";

export { MeshNode, type MeshNodeOptions, type Shape } from "./entities/meshnode";
export { GeometryNode, type GeometryNodeOptions } from "./entities/geometrynode";
export { LineNode, type LineNodeOptions } from "./entities/linenode";

export {
  SceneCamera,
  type SceneCameraOptions,
  type SceneCameraGizmos,
  type ProjectionType,
} from "./entities/scenecamera";

export {
  Light,
  DirectionalLight,
  PointLight,
  SpotLight,
  type LightOptions,
  type DirectionalLightOptions,
  type PointLightOptions,
  type SpotLightOptions,
} from "./entities/lights";

export { grid, axes, arrow, ring, AxesNode, type AxesOptions } from "./gizmos/helpers";
export {
  frustumCorners,
  frustumSlice,
  viewDepthToNdcZ,
  unproject,
  FRUSTUM_EDGES,
  frustumPlanes,
  sphereInFrustum,
  type Plane,
} from "./gizmos/frustum";

export {
  TriangleMesh,
  type TriangleMeshOptions,
  type Triangle,
  type Vertex,
  type Shading,
  type UV,
} from "./geometry/trimesh";

export { VizRenderer } from "./render/renderer";
export { LineBatch } from "./render/lines";
export { PointBatch } from "./render/points";
export { PixelSurface } from "./render/pixels";
export {
  checkerTexture,
  whiteTexture,
  fromCanvas,
  setFiltering,
  type CheckerOptions,
} from "./render/textures";
export { GpuMesh, type MeshData } from "./render/mesh";
export type { Collector, MeshOptions, LightInfo } from "./render/collector";

export { LabelOverlay, type Label, type LabelOptions, type LabelTarget } from "./ui/labels";
export { Hud } from "./ui/hud";
export { Stages, type Stage, type StagesOptions } from "./ui/stages";
export { pickNode } from "./ui/picking";
export { readViewFromUrl, writeViewToUrl } from "./ui/viewlink";

export * as primitives from "./geometry/primitives";

export { rgba, type Color, type Vec3Like } from "./types";
