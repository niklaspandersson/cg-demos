import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({
      url: "scenes/transformation-simple-affine",
    });
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;
    const t = time * 3;
    let translation: mat4 = mat4.create();
    ctx.linalg.mat4.fromZRotation(translation, t);

    const uniforms = this.#program!.use();
    uniforms.uTransformation = translation;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
