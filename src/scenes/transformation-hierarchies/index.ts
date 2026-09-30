import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #speed: number = 1;
  #inspector = new SceneInspector({ interest: 9 });

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;

    await this.#inspector.init(ctx);
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;
    const t = time * this.#speed;
    const uniforms = this.#program!.use();

    let viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, [0, 0, -8]);
    mat4.rotateX(viewMatrix, viewMatrix, 0.3);

    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, 1, 0.1, 100);

    this.#inspector.frame(dt, projectionMatrix, viewMatrix);

    // Sun: large cube at center, slow rotation
    // Each matrix below is a world transform now, with the view applied at
    // the end - which is what makes it possible to view the same hierarchy
    // through a different camera.
    let sunMatrix = mat4.create();
    mat4.rotateY(sunMatrix, sunMatrix, t * 0.3);

    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);
    uniforms.uModelViewMatrix = this.#inspector.modelView(sunMatrix);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Earth: orbits the sun, smaller
    let earthMatrix = mat4.clone(sunMatrix);
    mat4.rotateY(earthMatrix, earthMatrix, t);
    mat4.translate(earthMatrix, earthMatrix, [3, 0, 0]);
    mat4.scale(earthMatrix, earthMatrix, [0.4, 0.4, 0.4]);
    mat4.rotateY(earthMatrix, earthMatrix, t * 2);

    uniforms.uModelViewMatrix = this.#inspector.modelView(earthMatrix);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Moon: orbits the earth, even smaller
    // Start from earth's position (before earth's own scale/rotation)
    let moonBase = mat4.clone(sunMatrix);
    mat4.rotateY(moonBase, moonBase, t);
    mat4.translate(moonBase, moonBase, [3, 0, 0]);
    mat4.rotateY(moonBase, moonBase, t * 3);
    mat4.translate(moonBase, moonBase, [1, 0, 0]);
    mat4.scale(moonBase, moonBase, [0.15, 0.15, 0.15]);

    uniforms.uModelViewMatrix = this.#inspector.modelView(moonBase);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    this.#inspector.overlay(ctx);
  };

  dispose() {
    this.#inspector.dispose();
  }

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
      ...this.#inspector.params,
    ];
  }
}
