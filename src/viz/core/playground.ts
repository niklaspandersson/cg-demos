import { mat4 } from "gl-matrix";
import type { GLContext, GLScene, ParameterDescriptor } from "../../gl";
import type { SceneCamera } from "../entities/scenecamera";
import { Viewer } from "../camera/viewer";
import { ViewerControls } from "../camera/controls";
import { VizRenderer } from "../render/renderer";
import { Hud } from "../ui/hud";
import { LabelOverlay, type LabelOptions, type LabelTarget } from "../ui/labels";
import { pickNode } from "../ui/picking";
import { Stages, type Stage, type StagesOptions } from "../ui/stages";
import { PixelSurface } from "../render/pixels";
import { readViewFromUrl, viewChanged, writeViewToUrl } from "../ui/viewlink";
import type { Node } from "./node";
import { VizScene } from "./scene";

/**
 * Base class for a visualisation demo.
 *
 * It is an ordinary `GLScene`, so it plugs into the existing scene view, the
 * controls panel and the navigation without any of them knowing about the
 * library. A demo subclasses it and only writes `setup()`.
 *
 *     export default class Scene extends Playground {
 *       setup() {
 *         this.viewer.set({ position: [8, 5, 10] });
 *         this.scene.add(grid({ size: 10 }));
 *         this.scene.add(new MeshNode({ shape: "box", position: [0, 0.5, 0] }));
 *       }
 *     }
 */
export abstract class Playground implements GLScene {
  /** Everything being illustrated. */
  readonly scene = new VizScene();

  /** The camera you look through. Not part of the scene. */
  readonly viewer = new Viewer();

  /** Mouse and keyboard control of the viewer. */
  readonly controls = new ViewerControls(this.viewer);

  /** Fills the surrounding panel rather than using the fixed 512x512 canvas. */
  readonly layout = "fill" as const;

  background: [number, number, number, number] = [0.09, 0.1, 0.13, 1];

  /** Show the legend and the controls help. */
  showHud = true;

  /** Keep the viewpoint in the address bar, so a view can be linked to. */
  shareViewInUrl = true;

  /**
   * Draw the frame into a buffer this many times smaller than the canvas and
   * blow it back up. 1 is the normal full resolution picture; 8 is a scene made
   * of visible pixels, which is the only honest way to show rasterisation.
   */
  pixelSize = 1;

  #inset: { camera: SceneCamera; widthFraction: number } | null = null;
  #labels: LabelOverlay | null = null;
  #hud: Hud | null = null;
  #stages: Stages | null = null;
  #pixels: PixelSurface | null = null;
  #surface: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #viewProjection = mat4.create();

  #renderer: VizRenderer | null = null;
  /** Available from `setup()` onwards. */
  get renderer(): VizRenderer {
    if (!this.#renderer) {
      throw new Error("The renderer only exists once the playground has started");
    }
    return this.#renderer;
  }

  async init(ctx: GLContext) {
    const renderer = new VizRenderer(ctx.gl);
    await renderer.init();
    this.#renderer = renderer;
    this.#pixels = new PixelSurface(ctx.gl);
    await this.#pixels.init();

    ctx.clearColor = this.background;

    // The overlays are built before setup() runs, so a demo can add labels
    // and get a handle back rather than a promise of one later.
    const canvas = ctx.gl.canvas as HTMLCanvasElement;
    this.#canvas = canvas;
    this.#surface = canvas.parentElement;
    if (this.#surface) this.#labels = new LabelOverlay(this.#surface);

    await this.setup(ctx);

    // setup() is where a demo places the viewer, so the controls pick up the
    // pose afterwards - and remember it as the view that "R" returns to.
    // A viewpoint from the URL overrides it, but "R" still goes back to the
    // view the demo was written around.
    this.controls.syncFromViewer().saveHome();
    if (this.shareViewInUrl && readViewFromUrl(this.viewer)) {
      this.controls.syncFromViewer();
    }

    this.controls.attach(canvas);
    canvas.addEventListener("dblclick", this.#onDoubleClick);

    if (this.#surface && this.showHud) {
      this.#hud = new Hud(this.#surface, (node) => this.controls.focus(node));
      this.scene.update();
      this.#hud.setEntries(this.interesting());
    }
  }

  /**
   * The nodes a demo bothered to name. Those are the ones worth listing in
   * the legend and worth flying to when you click in the scene; unnamed
   * scenery would only be noise.
   *
   * Hidden subtrees are left out: a name in the legend that flies the viewer to
   * something it cannot see is worse than no entry at all, and a demo built as
   * a sequence of steps hides most of itself most of the time.
   */
  interesting(): Node[] {
    const found: Node[] = [];

    const visit = (node: Node) => {
      if (!node.visible) return;
      if (node !== this.scene && node.named) found.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this.scene);

    return found;
  }

  /**
   * Rebuild the legend from what is in the scene now. Needed after a demo shows
   * or hides part of itself; the legend is built once otherwise.
   */
  refreshLegend() {
    this.scene.update();
    this.#hud?.setEntries(this.interesting());
  }

  /**
   * Put a piece of text next to something. The target can be a node, a fixed
   * point, or a function, which is how a label follows a near plane that a
   * slider is moving.
   */
  label(text: string, target: LabelTarget, options: LabelOptions = {}) {
    return this.#labels?.add(text, target, options) ?? null;
  }

  /**
   * Turn this demo into a sequence of steps, with a caption panel over the
   * scene and the arrow keys stepping through it.
   *
   * Call it from `setup()`. `onChange` gets the new step's index and is
   * expected to put the scene into that state; it is also called for the
   * starting step, so one function describes every step and nothing has to be
   * undone. The controls panel is rebuilt afterwards, so each step can offer
   * its own sliders.
   */
  useStages(
    stages: readonly Stage[],
    onChange: (index: number) => void,
    options: StagesOptions = {},
  ): Stages {
    if (!this.#surface) throw new Error("useStages() needs the playground to have started");

    this.#stages?.dispose();
    const controller = new Stages(
      this.#surface,
      stages,
      (index) => {
        onChange(index);
        this.refreshParams();
      },
      options,
    );

    this.#stages = controller;
    onChange(controller.index);
    return controller;
  }

  /**
   * Ask the surrounding page to read `params` again. A demo needs this when its
   * controls depend on something the viewer just changed.
   */
  refreshParams() {
    this.#canvas?.dispatchEvent(new CustomEvent("scene-params", { bubbles: true }));
  }

  #onDoubleClick = (e: MouseEvent) => {
    const canvas = this.#canvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const node = pickNode(
      this.interesting(),
      this.#viewProjection,
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );

    if (node) this.controls.focus(node);
  };

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const renderer = this.#renderer;
    if (!renderer) return;

    this.controls.update(dt);
    this.update(dt, time);
    this.scene.update();

    const { drawingBufferWidth: canvasWidth, drawingBufferHeight: canvasHeight } = ctx.gl;

    // At a pixel size above 1 everything below draws into a smaller buffer, so
    // the frame is laid out against *that* size - including the inset, whose
    // corner is a fraction of the picture, not of the canvas.
    const target =
      this.#pixels?.begin(canvasWidth, canvasHeight, this.pixelSize, this.background) ?? null;
    const width = target?.width ?? canvasWidth;
    const height = target?.height ?? canvasHeight;
    const aspect = height > 0 ? width / height : 1;

    const view = this.viewer.viewMatrix();
    const projection = this.viewer.projectionMatrix(aspect);
    mat4.multiply(this.#viewProjection, projection, view);

    renderer.render(this.scene, view, projection);
    this.#renderInset(ctx, renderer, width, height);

    if (target) this.#pixels?.end(canvasWidth, canvasHeight);

    const canvas = ctx.gl.canvas as HTMLCanvasElement;
    this.#labels?.update(this.#viewProjection, canvas.clientWidth, canvas.clientHeight);

    this.#updateViewLink(dt);
  };

  #sinceUrlWrite = 0;
  #lastWrittenView: number[] = [];
  #updateViewLink(dt: number) {
    if (!this.shareViewInUrl) return;

    // Rewriting the URL on every frame of a camera move would be wasteful and
    // would make the address bar flicker, so it settles first.
    this.#sinceUrlWrite += dt;
    if (this.#sinceUrlWrite < 0.4) return;
    this.#sinceUrlWrite = 0;

    if (!viewChanged(this.viewer, this.#lastWrittenView)) return;
    this.#lastWrittenView = [...this.viewer.position, ...this.viewer.target];
    writeViewToUrl(this.viewer);
  }

  /**
   * Show what a scene camera actually sees, in a corner of the canvas.
   *
   * The renderer already takes a view matrix and a projection matrix, so this
   * is just a second pass through the same scene with that camera's matrices
   * and a smaller viewport. Having the frustum and the resulting image on
   * screen at the same time is what makes the frustum mean something.
   *
   * Pass null to turn it off.
   */
  lookThrough(camera: SceneCamera | null, options: { widthFraction?: number } = {}) {
    this.#inset = camera
      ? { camera, widthFraction: options.widthFraction ?? 0.3 }
      : null;
    return this;
  }

  #renderInset(ctx: GLContext, renderer: VizRenderer, width: number, height: number) {
    const inset = this.#inset;
    if (!inset) return;

    const gl = ctx.gl;

    // The inset takes the camera's own aspect ratio: it is that camera's
    // image, so letterboxing it would be a lie.
    const camera = inset.camera;
    const insetWidth = Math.round(width * inset.widthFraction);
    const insetHeight = Math.round(insetWidth / camera.aspect);
    const margin = Math.round(width * 0.015);
    const x = width - insetWidth - margin;
    const y = margin;

    gl.enable(gl.SCISSOR_TEST);

    // A border in the camera's own colour, so it is obvious which frustum
    // this picture belongs to.
    const border = Math.max(2, Math.round(width * 0.002));
    gl.scissor(x - border, y - border, insetWidth + border * 2, insetHeight + border * 2);
    gl.clearColor(camera.color[0], camera.color[1], camera.color[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(x, y, insetWidth, insetHeight);
    gl.clearColor(...this.background);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(x, y, insetWidth, insetHeight);
    renderer.render(this.scene, camera.viewMatrix(), camera.projectionMatrix(), {
      // A camera does not appear in its own picture.
      skip: camera,
    });

    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, width, height);
  }

  dispose() {
    this.#canvas?.removeEventListener("dblclick", this.#onDoubleClick);
    this.controls.dispose();
    this.#labels?.dispose();
    this.#hud?.dispose();
    this.#stages?.dispose();
    this.#pixels?.dispose();
    this.#renderer?.dispose();

    this.#labels = null;
    this.#hud = null;
    this.#stages = null;
    this.#pixels = null;
    this.#canvas = null;
    this.#surface = null;
    this.#renderer = null;
  }

  /** Build the scene. Called once, after the renderer is ready. */
  protected abstract setup(ctx: GLContext): void | Promise<void>;

  /** Optional per-frame hook. Most illustrations do not need it. */
  protected update(_dt: number, _time: number) {}

  get params(): ParameterDescriptor[] {
    return [];
  }
}
