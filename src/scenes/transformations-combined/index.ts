import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #speed = 1;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });
  }

  renderFrame = (ctx: GLContext, _: number, time: number) => {
    const { gl } = ctx;
    const { mat4 } = ctx.linalg;
    const t = time * this.#speed;

    // Scale → Rotate → Translate (read bottom-to-top)
    let transform = mat4.create();
    mat4.fromTranslation(transform, [0.3 * Math.sin(t), 0.2 * Math.cos(t), 0.0]);

    let rotation = mat4.create();
    mat4.fromZRotation(rotation, t);
    mat4.multiply(transform, transform, rotation);

    let scale = mat4.create();
    const s = 0.5 + 0.3 * Math.sin(t * 2);
    mat4.fromScaling(scale, [s, s, 1.0]);
    mat4.multiply(transform, transform, scale);

    const uniforms = this.#program!.use();
    uniforms.uTransformation = transform;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  get params() {
    return [
      {
        title: "Speed",
        type: <const>"number",
        min: 0.1,
        max: 5,
        initial: this.#speed,
        update: (value: number) => {
          this.#speed = value;
        },
      },
    ];
  }
}
