import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #fov: number = 90;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;

    let projectionMatrix = mat4.create();
    const fovRad = (this.#fov * Math.PI) / 180;
    mat4.perspective(projectionMatrix, fovRad, 1, 0.1, 100);

    let modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -3]);
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
        title: "Field of View",
        type: <const>"number",
        min: 20,
        max: 150,
        initial: this.#fov,
        update: (value: number) => {
          this.#fov = value;
        },
      },
    ];
  }
}
