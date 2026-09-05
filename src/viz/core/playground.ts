import type { GLContext, GLScene, ParameterDescriptor } from "../../gl";
import { Viewer } from "../camera/viewer";
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

  /** Fills the surrounding panel rather than using the fixed 512x512 canvas. */
  readonly layout = "fill" as const;

  background: [number, number, number, number] = [0.09, 0.1, 0.13, 1];

  #renderer: VizRenderer | null = null;
  protected get renderer() {
    return this.#renderer;
  }

  async init(ctx: GLContext) {
    const renderer = new VizRenderer(ctx.gl);
    await renderer.init();
    this.#renderer = renderer;

    ctx.clearColor = this.background;
    await this.setup(ctx);
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const renderer = this.#renderer;
    if (!renderer) return;

    this.update(dt, time);
    this.scene.update();

    const { drawingBufferWidth: width, drawingBufferHeight: height } = ctx.gl;
    const aspect = height > 0 ? width / height : 1;

    renderer.render(
      this.scene,
      this.viewer.viewMatrix(),
      this.viewer.projectionMatrix(aspect),
    );
  };

  dispose() {
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
