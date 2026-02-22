import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

const WRAP_MODES = ["REPEAT", "CLAMP_TO_EDGE", "MIRRORED_REPEAT"] as const;

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #wrapMode: number = 0;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });

    const uniforms = this.#program!.use();
    await this.#loadTexture(ctx, "assets/bricks.jpg");
    ctx.gl.uniform1i(uniforms.uSampler, 0);

    const { numElements } = ctx.geometry.createPlane(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  #applyWrapMode(gl: WebGL2RenderingContext) {
    const mode = WRAP_MODES[this.#wrapMode];
    const glMode = gl[mode];
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glMode);
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    this.#applyWrapMode(gl);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "Wrap mode (0=Repeat, 1=Clamp, 2=Mirror)",
        type: <const>"number",
        min: 0,
        max: 2,
        step: 1,
        initial: 0,
        update: (value: number) => {
          this.#wrapMode = Math.round(value);
        },
      },
    ];
  }

  async #loadTexture(ctx: GLContext, url: string) {
    const { gl } = ctx;
    gl.activeTexture(gl.TEXTURE0);
    const texture = await ctx.loadTexture(url);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.#applyWrapMode(gl);
  }
}
