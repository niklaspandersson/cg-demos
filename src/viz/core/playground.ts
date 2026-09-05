import type { GLContext, GLScene, ParameterDescriptor } from "../../gl";
import type { SceneCamera } from "../entities/scenecamera";
import { Viewer } from "../camera/viewer";
import { ViewerControls } from "../camera/controls";
import { VizRenderer } from "../render/renderer";
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

  #inset: { camera: SceneCamera; widthFraction: number } | null = null;

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

    ctx.clearColor = this.background;
    await this.setup(ctx);

    // setup() is where a demo places the viewer, so the controls pick up the
    // pose afterwards - and remember it as the view that "R" returns to.
    this.controls.syncFromViewer().saveHome();
    this.controls.attach(ctx.gl.canvas as HTMLCanvasElement);
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const renderer = this.#renderer;
    if (!renderer) return;

    this.controls.update(dt);
    this.update(dt, time);
    this.scene.update();

    const { drawingBufferWidth: width, drawingBufferHeight: height } = ctx.gl;
    const aspect = height > 0 ? width / height : 1;

    renderer.render(
      this.scene,
      this.viewer.viewMatrix(),
      this.viewer.projectionMatrix(aspect),
    );

    this.#renderInset(ctx, renderer);
  };

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

  #renderInset(ctx: GLContext, renderer: VizRenderer) {
    const inset = this.#inset;
    if (!inset) return;

    const gl = ctx.gl;
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

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
    this.controls.dispose();
    this.#renderer?.dispose();
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
