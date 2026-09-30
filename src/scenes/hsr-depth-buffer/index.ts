import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #depthEnabled: boolean = true;
  #inspector = new SceneInspector({ interest: 5 });

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
    this.#program.use();

    const { numElements } = createCube(ctx.gl, this.#program);
    this.#numElements = numElements;

    await this.#inspector.init(ctx);
  }

  renderFrame = (ctx: GLContext, dt: number, time: number) => {
    const { gl } = ctx;

    // The camera this demo is written around sits at the origin looking down
    // -z, which makes its view matrix the identity - and is why the matrices
    // below can be read as model matrices and model-view matrices at once.
    const projection = mat4.perspective(mat4.create(), Math.PI / 3, 1, 0.1, 100);
    const view = mat4.create();
    this.#inspector.frame(dt, projection, view);

    if (this.#depthEnabled) {
      gl.enable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);

    // First cube: closer, rotating
    let mv1 = mat4.create();
    mat4.translate(mv1, mv1, [-0.5, 0, -3]);
    mat4.rotateY(mv1, mv1, time * 0.5);
    mat4.rotateX(mv1, mv1, time * 0.3);

    uniforms.uModelViewMatrix = this.#inspector.modelView(mv1);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    // Second cube: overlapping, slightly behind
    let mv2 = mat4.create();
    mat4.translate(mv2, mv2, [0.5, 0, -4]);
    mat4.rotateY(mv2, mv2, -time * 0.5);
    mat4.rotateX(mv2, mv2, -time * 0.3);

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
        title: "Depth testing",
        type: <const>"boolean",
        initial: true,
        update: (value: boolean) => {
          this.#depthEnabled = value;
        },
      },
      ...this.#inspector.params,
    ];
  }
}
