import fs from './fs.glsl?raw'
import vs from './vs.glsl?raw'
import { GLContext, GLScene, GLSLProgram } from "../../gl";

const vertexData = new Float32Array([
  0, 0.5, 0, 1.0, 0.0, 0.0,
  -0.5, -0.5, 0, 0.0, 1.0, 0.0,
  0.5, -0.5, 0, 0.0, 0.0, 1.0,
])

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs })
    this.#program.use()

    const { gl } = ctx

    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW)

    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 6 * vertexData.BYTES_PER_ELEMENT, 0)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 6 * vertexData.BYTES_PER_ELEMENT, 3 * vertexData.BYTES_PER_ELEMENT)
    gl.enableVertexAttribArray(1)
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

