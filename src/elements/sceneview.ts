import { GLContext, GLScene, GLSLProgram } from "../gl";

const FIXED_SIZE = 512;

const template = document.createElement("template");
template.innerHTML = `
<div class="scene-surface">
  <canvas width="${FIXED_SIZE}" height="${FIXED_SIZE}"></canvas>
</div>
`;

export class GLSceneView extends HTMLElement {
  static get observedAttributes() {
    return ["scene"];
  }

  #ctx: GLContext;
  get ctx() {
    return this.#ctx;
  }

  #canvas: HTMLCanvasElement;
  #surface: HTMLElement;
  #resizeObserver: ResizeObserver;
  #scene: GLScene | null = null;
  /** The scene currently running, or null while none is loaded. */
  get currentScene() {
    return this.#scene;
  }

  constructor() {
    super();
    this.appendChild(template.content.cloneNode(true));

    this.#surface = this.querySelector(".scene-surface") as HTMLElement;
    this.#canvas = this.querySelector("canvas") as HTMLCanvasElement;
    this.#ctx = new GLContext(this.#canvas);

    this.#resizeObserver = new ResizeObserver(() => this.#syncCanvasSize());
    this.#resizeObserver.observe(this.#surface);
  }

  disconnectedCallback() {
    this.#resizeObserver.disconnect();
    this.#disposeScene();
    this.#ctx.stopRendering();
  }

  async attributeChangedCallback(name: string, _: string, newValue: string) {
    if (name === "scene") {
      let url = newValue;
      // adds '/index.js' if newString is pathname
      if (!url.toLocaleLowerCase().endsWith(".js")) {
        url += (url.endsWith("/") ? "" : "/") + "index";
      } else {
        url.substring(0, url.length - 3);
      }

      const module = await import(`../scenes/${url}`);
      const SceneConstructor = module.default;
      this.#renderScene(new SceneConstructor());
    }
  }

  /**
   * A "fill" scene stretches to the surrounding panel and follows the device
   * pixel ratio, so it stays sharp on a high resolution display. Every other
   * scene keeps the intrinsic square canvas it was written against.
   */
  #syncCanvasSize() {
    const fill = this.hasAttribute("responsive");
    if (!fill) {
      this.#canvas.width = FIXED_SIZE;
      this.#canvas.height = FIXED_SIZE;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.#surface.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.#surface.clientHeight * dpr));

    if (this.#canvas.width !== width) this.#canvas.width = width;
    if (this.#canvas.height !== height) this.#canvas.height = height;
  }

  #disposeScene() {
    this.#scene?.dispose?.();
    this.#scene = null;
  }

  async #renderScene(scene: GLScene) {
    this.#ctx.stopRendering();
    this.#disposeScene();

    this.toggleAttribute("responsive", scene.layout === "fill");
    this.#syncCanvasSize();

    try {
      await scene.init(this.#ctx);
      this.#scene = scene;
      this.#ctx.render(scene.renderFrame);
      this.#dispatchSceneLoaded(scene, this.#ctx.programs);
    } catch (e) {
      console.error(e);
      this.#ctx.stopRendering();
      scene.dispose?.();
      this.#dispatchSceneLoaded(null);
    }
  }

  #dispatchSceneLoaded(
    scene: GLScene | null,
    programs: readonly GLSLProgram[] = [],
  ) {
    this.dispatchEvent(
      new CustomEvent("scene-loaded", { detail: { scene, programs } }),
    );
  }
}

window.customElements.define("scene-view", GLSceneView);
