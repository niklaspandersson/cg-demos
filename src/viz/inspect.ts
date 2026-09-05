import { mat4, vec3 } from "gl-matrix";
import type { GLContext, ParameterDescriptor } from "../gl";
import { Viewer } from "./camera/viewer";
import { ViewerControls } from "./camera/controls";
import { VizScene } from "./core/scene";
import { SceneCamera } from "./entities/scenecamera";
import { grid, axes } from "./gizmos/helpers";
import { VizRenderer } from "./render/renderer";
import { Hud } from "./ui/hud";
import { LabelOverlay } from "./ui/labels";
import type { Color } from "./types";

export type SceneInspectorOptions = {
  /** Colour of the demo camera and its frustum. */
  color?: Color;
  /**
   * Roughly how far in front of the demo camera its content sits, used to
   * frame the first detached view.
   *
   * Worth setting: most demos leave the far plane at 100 because nothing
   * depends on it, and framing on that would leave the actual subject a speck
   * in the distance. Defaults to the far plane when not given.
   */
  interest?: number;

  /** Extent of the reference grid drawn while detached. */
  gridSize?: number;
  /** Label for the toggle in the controls panel. */
  title?: string;
};

const CAMERA_COLOR: Color = [0.35, 0.8, 1];

/**
 * Lets an ordinary demo break loose from the camera it was written around.
 *
 * A demo normally renders through one fixed camera. Hand that camera's
 * projection and view matrices to `frame()` each frame and ask for matrices
 * back, and nothing changes: you get the same two matrices you passed in, so
 * the demo renders exactly as it did before.
 *
 * Switch `detached` on and the answers change. The demo's geometry is now
 * drawn from a camera you fly yourself, and the camera the demo *thought* it
 * was using appears in the scene as a frustum you can walk around. Its
 * picture is unchanged - the same objects, the same shaders, the same
 * matrices - you are simply no longer standing inside it.
 *
 * This is the two-camera distinction the rest of the library is built on,
 * applied to a demo that only ever had one.
 */
export class SceneInspector {
  /** The camera you fly. Only used while detached. */
  readonly viewer = new Viewer();
  readonly controls = new ViewerControls(this.viewer);

  /** The demo's own camera, drawn as a frustum while detached. */
  readonly camera: SceneCamera;
  readonly scene = new VizScene();

  #detached = false;
  get detached() {
    return this.#detached;
  }
  set detached(value: boolean) {
    if (value === this.#detached) return;
    this.#detached = value;

    this.controls.enabled = value;
    if (value) this.#frameTheCamera();
    this.#syncOverlays();
    this.#requestLayout(value ? "fill" : "fixed");
  }

  #title: string;
  #interest: number | null;
  #renderer: VizRenderer | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #surface: HTMLElement | null = null;
  #hud: Hud | null = null;
  #labels: LabelOverlay | null = null;

  #demoProjection = mat4.create();
  #demoView = mat4.create();
  #modelView = mat4.create();
  #freeProjection = mat4.create();
  #viewProjection = mat4.create();

  constructor(options: SceneInspectorOptions = {}) {
    this.#title = options.title ?? "Free camera";
    this.#interest = options.interest ?? null;

    this.camera = new SceneCamera({
      name: "demo camera",
      color: options.color ?? CAMERA_COLOR,
      // No filled planes by default: a demo that leaves its far plane at 100
      // would get a wall of translucent grey across the whole view. A demo
      // where the planes are the subject turns them on itself.
      show: { body: true, axes: true, frustum: true },
    });

    this.scene.add(grid({ size: options.gridSize ?? 20, step: 1, color: [0.4, 0.42, 0.48] }));
    this.scene.add(axes({ size: 1.2 }));
    this.scene.add(this.camera);

    this.controls.enabled = false;
  }

  async init(ctx: GLContext) {
    const renderer = new VizRenderer(ctx.gl);
    await renderer.init();
    this.#renderer = renderer;

    this.#canvas = ctx.gl.canvas as HTMLCanvasElement;
    this.#surface = this.#canvas.parentElement;
    this.controls.attach(this.#canvas);
  }

  /**
   * Call once at the top of `renderFrame`, with the projection and view the
   * demo would have used on its own.
   */
  frame(dt: number, projection: mat4, view: mat4) {
    mat4.copy(this.#demoProjection, projection);
    mat4.copy(this.#demoView, view);

    this.camera.projectionOverride = this.#demoProjection;
    this.camera.setFromViewMatrix(this.#demoView);

    // Kept current even while attached: detaching frames the first view from
    // the camera's world matrix, and a stale one would put you somewhere
    // arbitrary.
    this.scene.update();

    if (this.#detached) this.controls.update(dt);
  }

  /** The projection to send to the demo's shader this frame. */
  projection(ctx: GLContext): mat4 {
    if (!this.#detached) return this.#demoProjection;

    const { drawingBufferWidth: width, drawingBufferHeight: height } = ctx.gl;
    return this.viewer.projectionMatrix(height > 0 ? width / height : 1, this.#freeProjection);
  }

  /** The view to send. */
  view(): mat4 {
    return this.#detached ? this.viewer.viewMatrix(this.#modelView) : this.#demoView;
  }

  /**
   * The model-view matrix for one object. Pass the object's transform in
   * world space - the space the demo's own view matrix takes as input.
   */
  modelView(model: mat4, out: mat4 = mat4.create()): mat4 {
    if (!this.#detached) return mat4.multiply(out, this.#demoView, model);

    return mat4.multiply(out, this.viewer.viewMatrix(), model);
  }

  /**
   * Draw the reference grid and the demo camera's frustum. Call after the
   * demo has drawn, so the gizmos land on top of its geometry.
   */
  overlay(ctx: GLContext) {
    const renderer = this.#renderer;
    if (!renderer || !this.#detached) return;

    const gl = ctx.gl;
    const aspect = gl.drawingBufferHeight > 0
      ? gl.drawingBufferWidth / gl.drawingBufferHeight
      : 1;

    const view = this.viewer.viewMatrix();
    const projection = this.viewer.projectionMatrix(aspect);
    mat4.multiply(this.#viewProjection, projection, view);

    renderer.render(this.scene, view, projection);

    this.#labels?.update(this.#viewProjection, this.#canvas!.clientWidth, this.#canvas!.clientHeight);

    // The demo owns the GL state the rest of the time, so hand it back as it
    // was found.
    gl.disable(gl.BLEND);
  }

  dispose() {
    this.controls.dispose();
    this.#hud?.dispose();
    this.#labels?.dispose();
    this.#renderer?.dispose();
    this.#requestLayout("fixed");

    this.#hud = null;
    this.#labels = null;
    this.#renderer = null;
    this.#canvas = null;
    this.#surface = null;
  }

  /** The toggle, ready to spread into a scene's `params`. */
  get params(): ParameterDescriptor[] {
    return [
      {
        title: this.#title,
        type: "boolean",
        initial: this.#detached,
        update: (value: boolean) => (this.detached = value),
      },
    ];
  }

  /**
   * Step outside to a view that shows the whole frustum: off to one side,
   * above, and far enough back that the apex stays in frame.
   */
  #frameTheCamera() {
    const world = this.camera.worldMatrix;
    const right = vec3.set(vec3.create(), world[0], world[1], world[2]);
    const up = vec3.set(vec3.create(), world[4], world[5], world[6]);
    const back = vec3.set(vec3.create(), world[8], world[9], world[10]);

    const reach = Math.max(2, this.#interest ?? this.#depthOfInterest());
    const target = this.camera.pointAtDepth(reach * 0.45);

    const direction = vec3.create();
    vec3.scaleAndAdd(direction, direction, right, 1);
    vec3.scaleAndAdd(direction, direction, up, 0.55);
    vec3.scaleAndAdd(direction, direction, back, 0.45);
    vec3.normalize(direction, direction);

    const position = vec3.scaleAndAdd(vec3.create(), target, direction, reach * 1.35);

    this.viewer.set({ position, target, fov: 50, far: Math.max(500, reach * 20) });
    this.controls.syncFromViewer().saveHome();
  }

  /**
   * How far out the demo's camera is looking. Taken from the far corner of
   * its own frustum, so it works for any projection the demo used.
   */
  #depthOfInterest(): number {
    const inverse = mat4.invert(mat4.create(), this.#demoProjection);
    if (!inverse) return 6;

    const corner = vec3.transformMat4(vec3.create(), [0, 0, 1], inverse);
    return Math.min(Math.abs(corner[2]), 40);
  }

  #syncOverlays() {
    const surface = this.#surface;
    if (!surface) return;

    if (!this.#detached) {
      this.#hud?.dispose();
      this.#labels?.dispose();
      this.#hud = null;
      this.#labels = null;
      return;
    }

    this.#hud ??= new Hud(surface, (node) => this.controls.focus(node));
    this.#hud.setEntries([this.camera]);

    this.#labels ??= new LabelOverlay(surface);
    this.#labels.clear();
    this.#labels.add("demo camera", this.camera, {
      offset: [0, 0.6, 0],
      color: this.camera.color,
    });
  }

  /**
   * A detached demo wants room to fly around in, so it asks the scene view to
   * stretch. Attached, it goes back to the square canvas it was written for -
   * which is also what keeps its hard-coded 1:1 aspect ratio honest.
   */
  #requestLayout(layout: "fixed" | "fill") {
    this.#canvas?.dispatchEvent(
      new CustomEvent("scene-layout", { bubbles: true, detail: { layout } }),
    );
  }
}
