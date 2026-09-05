import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #cullingEnabled: boolean = true;
  #inspector = new SceneInspector({ interest: 3 });

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

    if (this.#cullingEnabled) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    } else {
      gl.disable(gl.CULL_FACE);
    }

    let modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [0, 0, -3]);
    mat4.rotateX(modelMatrix, modelMatrix, time * 0.5);
    mat4.rotateY(modelMatrix, modelMatrix, time * 0.7);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);
    uniforms.uModelViewMatrix = this.#inspector.modelView(modelMatrix);

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    this.#inspector.overlay(ctx);
  };

  dispose() {
    this.#inspector.dispose();
  }

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
      ...this.#inspector.params,
    ];
  }
}
