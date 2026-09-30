import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #farPlane: number = 15;
  // The far plane is what this demo is about, so it gets drawn. Its distance
  // is on a slider, which also makes it the right thing to frame the first
  // detached view around.
  #inspector = new SceneInspector();

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;

    this.#inspector.camera.show.farPlane = true;
    await this.#inspector.init(ctx);
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;

    // The camera this demo is written around sits at the origin looking down
    // -z, which makes its view matrix the identity - and is why the matrices
    // below can be read as model matrices and model-view matrices at once.
    const projection = mat4.create();
    mat4.perspective(projection, Math.PI / 3, 1, 0.1, this.#farPlane);
    const view = mat4.create();
    this.#inspector.frame(dt, projection, view);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);

    // Draw a row of cubes at increasing distances
    const positions = [-8, -5, -3, -6, -10, -13, -16];
    for (let i = 0; i < positions.length; i++) {
      let modelMatrix = mat4.create();
      const x = (i - 3) * 1.5;
      mat4.translate(modelMatrix, modelMatrix, [x, 0, positions[i]]);
      mat4.scale(modelMatrix, modelMatrix, [0.4, 0.4, 0.4]);
      mat4.rotateY(modelMatrix, modelMatrix, time + i);

      uniforms.uModelViewMatrix = this.#inspector.modelView(modelMatrix);
      gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
    }

    this.#inspector.overlay(ctx);
  };

  dispose() {
    this.#inspector.dispose();
  }

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
      ...this.#inspector.params,
    ];
  }
}
