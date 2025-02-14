import { mat4 } from 'gl-matrix'
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from '../../cube';
import { extractShaderProgramUrl } from '..';

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #uSpeed: number = .1;
  #uColor: number[] = [1, 0, 0];

  async init(ctx: GLContext) {
    const url = extractShaderProgramUrl(import.meta.url);
    this.#program = await ctx.createProgram({ url })
    const uniforms = this.#program.use()

    const { numElements } = createCube(ctx.gl, this.#program)
    this.#numElements = numElements;

    let projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, Math.PI / 2, 1, .1, 100)
    uniforms.uProjectionMatrix = projectionMatrix
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;
    let modelViewMatrix = mat4.create()
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -2])

    const angle = Math.PI * 2 * time * this.#uSpeed;
    mat4.rotateX(modelViewMatrix, modelViewMatrix, angle / 2)
    mat4.rotateY(modelViewMatrix, modelViewMatrix, angle)

    const uniforms = this.#program!.use()
    uniforms.uModelViewMatrix = modelViewMatrix
    uniforms.uColor = this.#uColor

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0)
  }

  get params() {
    return [{
      title: 'Color',
      type: <const>'color',
      update: (value: number[]) => {
        this.#uColor = value;
      }
    },
    {
      title: 'Speed',
      type: <const>'number',
      min: 0.01,
      max: 1,
      update: (value: number) => {
        this.#uSpeed = value;
      }
    }]
  }
}