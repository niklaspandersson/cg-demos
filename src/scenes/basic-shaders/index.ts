import { extractShaderProgramUrl } from "..";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;

  async init(ctx: GLContext) {
    const url = extractShaderProgramUrl(import.meta.url);
    this.#program = await ctx.createProgram({ url })
    this.#program.use()
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}