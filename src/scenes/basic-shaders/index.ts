import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";

import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
