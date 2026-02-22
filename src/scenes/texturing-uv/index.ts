import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #uvScale: number = 1;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });

    const uniforms = this.#program!.use();
    await this.#loadTexture(ctx, "assets/bricks.jpg");
    ctx.gl.uniform1i(uniforms.uSampler, 0);

    const { numElements } = ctx.geometry.createPlane(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    const uniforms = this.#program!.use();
    uniforms.uUvScale = this.#uvScale;
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "UV Scale",
        type: <const>"number",
        min: 0.1,
        max: 5,
        step: 0.1,
        initial: this.#uvScale,
        update: (value: number) => {
          this.#uvScale = value;
        },
      },
    ];
  }

  async #loadTexture(ctx: GLContext, url: string) {
    const { gl } = ctx;
    gl.activeTexture(gl.TEXTURE0);
    const texture = await ctx.loadTexture(url);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Enable repeat for UV scaling demonstration
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }
}
