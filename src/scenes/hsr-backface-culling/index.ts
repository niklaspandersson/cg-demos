import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #cullingEnabled: boolean = true;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;

    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, 1, 0.1, 100);
    const uniforms = this.#program.use();
    uniforms.uProjectionMatrix = projectionMatrix;
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;

    if (this.#cullingEnabled) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    } else {
      gl.disable(gl.CULL_FACE);
    }

    let modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -3]);
    mat4.rotateX(modelViewMatrix, modelViewMatrix, time * 0.5);
    mat4.rotateY(modelViewMatrix, modelViewMatrix, time * 0.7);

    const uniforms = this.#program!.use();
    uniforms.uModelViewMatrix = modelViewMatrix;

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "Back face culling",
        type: <const>"boolean",
        initial: true,
        update: (value: boolean) => {
          this.#cullingEnabled = value;
        },
      },
    ];
  }
}
