import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #uSpeed: number = 0.1;
  #uColor: number[] = [1, 0, 0];
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

      // Worth noticing once you detach: the light stays put relative to you,
    // not to the world. The fragment shader defines its direction as
    // (0, 0, 1) in *view* space, so it is a headlight - it always shines from
    // whichever camera is doing the rendering.
  // The camera this demo is written around sits at the origin looking down
    // -z, which makes its view matrix the identity - and is why the matrices
    // below can be read as model matrices and model-view matrices at once.
    const projection = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100);
    const view = mat4.create();
    this.#inspector.frame(dt, projection, view);

    let modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [0, 0, -2]);

    const angle = Math.PI * 2 * time * this.#uSpeed;
    mat4.rotateX(modelMatrix, modelMatrix, angle / 2);
    mat4.rotateY(modelMatrix, modelMatrix, angle);

    const uniforms = this.#program!.use();
    uniforms.uProjectionMatrix = this.#inspector.projection(ctx);
    uniforms.uModelViewMatrix = this.#inspector.modelView(modelMatrix);
    uniforms.uColor = this.#uColor;

    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);

    this.#inspector.overlay(ctx);
  };

  dispose() {
    this.#inspector.dispose();
  }

  get params() {
    return [
      {
        title: "Color",
        type: <const>"color",
        update: (value: number[]) => {
          this.#uColor = value;
        },
      },
      {
        title: "Speed",
        type: <const>"number",
        min: 0.01,
        max: 1,
        update: (value: number) => {
          this.#uSpeed = value;
        },
      },
      ...this.#inspector.params,
    ];
  }
}
