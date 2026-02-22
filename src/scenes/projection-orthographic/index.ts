import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #zoom: number = 2;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;

    let projectionMatrix = mat4.create();
    const z = this.#zoom;
    mat4.ortho(projectionMatrix, -z, z, -z, z, 0.1, 100);

    let modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -5]);
    const angle = time * 0.5;
    mat4.rotateX(modelViewMatrix, modelViewMatrix, angle * 0.7);
    mat4.rotateY(modelViewMatrix, modelViewMatrix, angle);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = projectionMatrix;
    uniforms.uModelViewMatrix = modelViewMatrix;

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "Zoom",
        type: <const>"number",
        min: 0.5,
        max: 5,
        initial: this.#zoom,
        update: (value: number) => {
          this.#zoom = value;
        },
      },
    ];
  }
}
