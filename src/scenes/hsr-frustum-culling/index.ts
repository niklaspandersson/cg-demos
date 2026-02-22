import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #farPlane: number = 15;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;

    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, 1, 0.1, this.#farPlane);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = projectionMatrix;

    // Draw a row of cubes at increasing distances
    const positions = [-8, -5, -3, -6, -10, -13, -16];
    for (let i = 0; i < positions.length; i++) {
      let modelViewMatrix = mat4.create();
      const x = (i - 3) * 1.5;
      mat4.translate(modelViewMatrix, modelViewMatrix, [x, 0, positions[i]]);
      mat4.scale(modelViewMatrix, modelViewMatrix, [0.4, 0.4, 0.4]);
      mat4.rotateY(modelViewMatrix, modelViewMatrix, time + i);

      uniforms.uModelViewMatrix = modelViewMatrix;
      gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
    }
  };

  get params() {
    return [
      {
        title: "Far plane",
        type: <const>"number",
        min: 2,
        max: 20,
        initial: this.#farPlane,
        update: (value: number) => {
          this.#farPlane = value;
        },
      },
    ];
  }
}
