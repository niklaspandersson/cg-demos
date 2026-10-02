import type { GLSLProgram } from "../../gl/program";
import { createBlitProgram } from "./programs";

/**
 * Renders a frame into a deliberately small buffer and blows it back up, so
 * the pixels the rasteriser actually filled are visible as squares.
 *
 * This is the one place in the library where the picture is wrong on purpose.
 * Everything else draws the scene as well as it can; this throws resolution
 * away, because "a triangle becomes the set of pixel centres that fall inside
 * it" is impossible to see at two million pixels and obvious at two thousand.
 *
 * The small picture is copied back by drawing it as a texture over the whole
 * canvas, with nearest sampling so the blocks stay blocks. `blitFramebuffer`
 * would be the shorter way to say that and is what this used to do - but the
 * canvas is multisampled, and a scaling blit into a multisampled buffer is an
 * error, so the texture goes through a shader instead.
 */
export class PixelSurface {
  #gl: WebGL2RenderingContext;
  #framebuffer: WebGLFramebuffer | null = null;
  #texture: WebGLTexture | null = null;
  #depth: WebGLRenderbuffer | null = null;
  #program: GLSLProgram | null = null;
  #width = 0;
  #height = 0;
  #active = false;

  /** Set once the framebuffer has failed, so it is not tried every frame. */
  #broken = false;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
  }

  /**
   * Start drawing into a buffer `scale` times smaller than the canvas, and
   * return the size that buffer turned out to be - the caller needs it for its
   * viewport and its aspect ratio.
   *
   * Returns null when there is nothing to do, in which case the caller draws to
   * the canvas as usual.
   */
  begin(
    canvasWidth: number,
    canvasHeight: number,
    scale: number,
    clearColor: readonly [number, number, number, number],
  ): { width: number; height: number } | null {
    if (scale <= 1 || this.#broken) return null;

    const gl = this.#gl;
    const width = Math.max(1, Math.floor(canvasWidth / scale));
    const height = Math.max(1, Math.floor(canvasHeight / scale));
    if (!this.#resize(width, height)) return null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(...clearColor);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.#active = true;
    return { width, height };
  }

  /** Put the small picture back on the canvas, one block per sample. */
  end(canvasWidth: number, canvasHeight: number) {
    if (!this.#active || !this.#program) return;
    this.#active = false;

    const gl = this.#gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasWidth, canvasHeight);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    this.#program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
  }

  dispose() {
    const gl = this.#gl;
    if (this.#framebuffer) gl.deleteFramebuffer(this.#framebuffer);
    if (this.#texture) gl.deleteTexture(this.#texture);
    if (this.#depth) gl.deleteRenderbuffer(this.#depth);
    this.#framebuffer = null;
    this.#texture = null;
    this.#depth = null;
    this.#width = 0;
    this.#height = 0;
  }

  #resize(width: number, height: number): boolean {
    if (this.#framebuffer && this.#width === width && this.#height === height) return true;

    const gl = this.#gl;
    const keepProgram = this.#program;
    this.dispose();
    this.#program = keepProgram;

    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    const depth = gl.createRenderbuffer();
    if (!framebuffer || !texture || !depth) {
      this.#broken = true;
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    // Nearest in both directions: this texture is the picture, and smoothing it
    // on the way back to the canvas would hide the very thing being shown.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);

    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (!complete) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteRenderbuffer(depth);
      // A demo that cannot have its low resolution mode is still a demo, so
      // this gives up quietly and draws at full size from here on.
      this.#broken = true;
      return false;
    }

    this.#framebuffer = framebuffer;
    this.#texture = texture;
    this.#depth = depth;
    this.#width = width;
    this.#height = height;
    return true;
  }

  /** Builds the shader that copies the small picture back. */
  async init() {
    if (this.#program) return;

    const program = await createBlitProgram(this.#gl);
    program.use();
    const sampler = program.getUniformLocation("uTexture");
    if (sampler) this.#gl.uniform1i(sampler, 0);
    this.#program = program;
  }
}
