import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #speed = 3;
  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ url: 'scenes/transformation-simple-affine' })
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;
    const { mat4 } = ctx.linalg;
    const t = time * this.#speed;
    let translation = mat4.create();
    mat4.fromTranslation(translation, [0.2 * Math.sin(t), 0, 0.0]);
    const uniforms = this.#program!.use();
    uniforms.uTransformation = translation;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  get params() {
    return [{
      title: 'Speed',
      type: <const>'number',
      min: 0.2,
      max: 50,
      initial: this.#speed,
      update: (value: number) => {
        this.#speed = value;
      }
    }]
  }
}