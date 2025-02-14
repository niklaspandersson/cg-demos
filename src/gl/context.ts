import * as glMath from 'gl-matrix'
import { createCube } from '../cube'
import { createPlane } from '../plane'
import { GLSLProgram } from './program'
import type { BuildProps as GLSLProgramProps } from './program'
import { loadTexture } from './texture'

const geometry = {
  createCube,
  createPlane,
}

type CreateProgramProps = Omit<GLSLProgramProps, "gl">

export class GLContext {
  get linalg() { return glMath }

  #context: WebGL2RenderingContext
  get gl() { return this.#context }

  get geometry() { return geometry }

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("webgl2")
    if (!context)
      throw new Error("Failed to create webgl2 context")

    this.#context = context
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
  }

  async createProgram(opts: CreateProgramProps) {
    const program = new GLSLProgram(this.#context)
    await program.build(opts)
    return program
  }

  loadTexture(url: string) {
    return loadTexture(this.gl, url)
  }

  #frameRequestId: number | null = null
  render(onFrame: (ctx: GLContext, dt: number, time: number) => void) {
    const gl = this.#context

    gl.viewport(0.0, 0.0, gl.canvas.width, gl.canvas.height)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clearDepth(1.0)
    gl.clearColor(0, 0, 0, 1.0)

    let accTime = 0
    let lastTime: number | undefined
    const frameCallback: FrameRequestCallback = (timestamp) => {
      const ts = timestamp / 1000
      lastTime ??= ts
      const dt = ts - lastTime
      accTime += dt
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      onFrame(this, dt, accTime)
      this.#frameRequestId = requestAnimationFrame(frameCallback)
      lastTime = ts
    }
    this.#frameRequestId = requestAnimationFrame(frameCallback)
  }

  stopRendering() {
    if (this.#frameRequestId)
      cancelAnimationFrame(this.#frameRequestId)
    this.#frameRequestId = 0;
  }
}