import fs from "./fs.glsl?raw";
import vs from "./vs.glsl?raw";
import { GLContext, GLScene, GLSLProgram } from "../../gl";

export default class Scene implements GLScene {
  #program: GLSLProgram | null = null;
  #numElements: number = 0;
  #texture: WebGLTexture | null = null;
  #useNearest: boolean = false;

  async init(ctx: GLContext) {
    this.#program = await ctx.createProgram({ fs, vs });

    const { gl } = ctx;
    const uniforms = this.#program!.use();

    // Create a small 4x4 checkerboard texture to make filtering differences visible
    this.#texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);

    const size = 4;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const isWhite = (x + y) % 2 === 0;
        pixels[i] = isWhite ? 255 : 0;
        pixels[i + 1] = isWhite ? 255 : 0;
        pixels[i + 2] = isWhite ? 255 : 50;
        pixels[i + 3] = 255;
      }
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.#applyFiltering(gl);

    gl.uniform1i(uniforms.uSampler, 0);

    const { numElements } = ctx.geometry.createPlane(ctx.gl, this.#program);
    this.#numElements = numElements;
  }

  #applyFiltering(gl: WebGL2RenderingContext) {
    if (this.#useNearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
  }

  renderFrame = (ctx: GLContext) => {
    const { gl } = ctx;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    this.#applyFiltering(gl);
    gl.drawElements(gl.TRIANGLES, this.#numElements, gl.UNSIGNED_SHORT, 0);
  };

  get params() {
    return [
      {
        title: "Nearest filtering",
        type: <const>"boolean",
        update: (value: boolean) => {
          this.#useNearest = value;
        },
      },
    ];
  }
}
