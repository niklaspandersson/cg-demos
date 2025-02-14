import { extractShaderProgramUrl } from "..";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #uColor: number[] = [1, 0, 0];

  async init(ctx: GLContext) {
    const url = extractShaderProgramUrl(import.meta.url);
    this.#program = await ctx.createProgram({ url })
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    this.#program!.use().uColor = this.#uColor;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  get params() {
    return [{
      title: 'Color',
      type: <const>'color',
      update: (value: number[]) => {
        this.#uColor = value;
      }
    }]
  }
}