import { extractShaderProgramUrl } from '..';
import { GLContext, GLScene, GLSLProgram } from '../../gl';

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;

  async init(ctx: GLContext) {
    const url = extractShaderProgramUrl(import.meta.url);
    this.#program = await ctx.createProgram({ url })

    const uniforms = this.#program!.use()
    await this.#loadTexture(ctx, 'assets/bricks.jpg')
    ctx.gl.uniform1i(uniforms.uSampler, 0)

    const { numElements } = ctx.geometry.createPlane(ctx.gl, this.#program)
    this.#numElements = numElements;
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0)
  }

  get params() {
    return []
  }

  async #loadTexture(ctx: GLContext, url: string) {
    const { gl } = ctx
    gl.activeTexture(gl.TEXTURE0)
    const texture = await ctx.loadTexture(url)
    gl.bindTexture(gl.TEXTURE_2D, texture)
  }
}