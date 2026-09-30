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
  #inspector = new SceneInspector({ interest: 6 });

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

    // The camera this demo is written around sits at the origin looking down
    // -z, which makes its view matrix the identity - and is why the matrices
    // below can be read as model matrices and model-view matrices at once.
    const projection = mat4.perspective(mat4.create(), Math.PI / 3, 1, 0.1, 100);
    const view = mat4.create();
    this.#inspector.frame(dt, projection, view);

    // Left cube: translate then rotate (rotation in world space)
    let mv1 = mat4.create();
    mat4.translate(mv1, mv1, [-1.5, 0, -5]);
    mat4.rotateY(mv1, mv1, t);
    mat4.scale(mv1, mv1, [0.5, 0.5, 0.5]);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);
    uniforms.uModelViewMatrix = this.#inspector.modelView(mv1);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Right cube: rotate then translate (rotation in local space)
    let mv2 = mat4.create();
    mat4.translate(mv2, mv2, [0, 0, -5]);
    mat4.rotateY(mv2, mv2, t);
    mat4.translate(mv2, mv2, [1.5, 0, 0]);
    mat4.scale(mv2, mv2, [0.5, 0.5, 0.5]);

    uniforms.uModelViewMatrix = this.#inspector.modelView(mv2);
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
