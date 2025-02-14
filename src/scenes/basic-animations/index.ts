import { extractShaderProgramUrl } from "..";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #speed: number = 1;

  async init(ctx: GLContext) {
    const url = extractShaderProgramUrl(import.meta.url);
    this.#program = await ctx.createProgram({ url })
    const uniforms = this.#program.use()
    uniforms.uColor = [1, 0, 0];
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;
    const uniforms = this.#program!.use()
    uniforms.time = time * this.#speed;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  get params() {
    return [{
      title: 'Speed',
      type: <const>'number',
      min: 0.2,
      max: 10,
      update: (value: number) => {
        this.#speed = value;
      }
    }]
  }
}