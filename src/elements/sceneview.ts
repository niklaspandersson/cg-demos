import { GLContext, GLScene, GLSLProgram } from "../gl";

const template = document.createElement("template");
template.innerHTML = `
<canvas width="512" height="512"></canvas>
`;

export class GLSceneView extends HTMLElement {
  static get observedAttributes() {
    return ["scene"];
  }

  #ctx: GLContext;
  get ctx() {
    return this.#ctx;
  }

  constructor() {
    super();
    this.appendChild(template.content.cloneNode(true));

    const canvas = this.querySelector("canvas") as HTMLCanvasElement;
    this.#ctx = new GLContext(canvas);
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

  async #renderScene(scene: GLScene) {
    this.#ctx.stopRendering();
    try {
      await scene.init(this.#ctx);
      this.#ctx.render(scene.renderFrame);
      this.#dispatchSceneLoaded(scene, this.#ctx.programs);
    } catch (e) {
      console.error(e);
      this.#ctx.stopRendering();
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
