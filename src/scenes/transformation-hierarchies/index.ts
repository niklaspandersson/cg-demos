import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #speed: number = 1;

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
    const t = time * this.#speed;
    const uniforms = this.#program!.use();

    let viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, [0, 0, -8]);
    mat4.rotateX(viewMatrix, viewMatrix, 0.3);

    // Sun: large cube at center, slow rotation
    let sunMatrix = mat4.create();
    mat4.multiply(sunMatrix, viewMatrix, sunMatrix);
    mat4.rotateY(sunMatrix, sunMatrix, t * 0.3);

    uniforms.uModelViewMatrix = sunMatrix;
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Earth: orbits the sun, smaller
    let earthMatrix = mat4.clone(sunMatrix);
    mat4.rotateY(earthMatrix, earthMatrix, t);
    mat4.translate(earthMatrix, earthMatrix, [3, 0, 0]);
    mat4.scale(earthMatrix, earthMatrix, [0.4, 0.4, 0.4]);
    mat4.rotateY(earthMatrix, earthMatrix, t * 2);

    uniforms.uModelViewMatrix = earthMatrix;
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Moon: orbits the earth, even smaller
    // Start from earth's position (before earth's own scale/rotation)
    let moonBase = mat4.clone(sunMatrix);
    mat4.rotateY(moonBase, moonBase, t);
    mat4.translate(moonBase, moonBase, [3, 0, 0]);
    mat4.rotateY(moonBase, moonBase, t * 3);
    mat4.translate(moonBase, moonBase, [1, 0, 0]);
    mat4.scale(moonBase, moonBase, [0.15, 0.15, 0.15]);

    uniforms.uModelViewMatrix = moonBase;
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "Speed",
        type: <const>"number",
        min: 0.1,
        max: 3,
        initial: this.#speed,
        update: (value: number) => {
          this.#speed = value;
        },
      },
    ];
  }
}
