import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ url: 'scenes/transformation-simple-affine' })
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;
    let translation: mat4 = mat4.create();
    const scale = 0.5 + 0.7 * (1 + Math.sin(time * 3)) / 2;
    ctx.linalg.mat4.fromScaling(translation, [scale, scale, 0.0]);
    const uniforms = this.#program!.use();
    uniforms.uTransformation = translation;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}