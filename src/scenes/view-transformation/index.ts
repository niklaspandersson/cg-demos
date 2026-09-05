import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { mat4 } from "gl-matrix";
import { GLContext, GLScene, GLSLProgram } from "../../gl";
import { SceneInspector } from "../../viz";
import { createCube } from "../../cube.geo";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #cameraAngle: number = 0;
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

    const angle = this.#cameraAngle;
    const radius = 4;
    const eyeX = radius * Math.sin(angle);
    const eyeZ = radius * Math.cos(angle);

    let viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [eyeX, 2, eyeZ], [0, 0, 0], [0, 1, 0]);

    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, 1, 0.1, 100);

    this.#inspector.frame(dt, projectionMatrix, viewMatrix);

    // Slowly rotate the cube to show it's static, camera is moving
    let modelMatrix = mat4.create();
    mat4.rotateY(modelMatrix, modelMatrix, time * 0.2);

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
        title: "Camera Angle",
        type: <const>"number",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        initial: this.#cameraAngle,
        update: (value: number) => {
          this.#cameraAngle = value;
        },
      },
      ...this.#inspector.params,
    ];
  }
}
