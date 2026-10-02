/**
 * Textures built in the browser rather than loaded from a file.
 *
 * A checkerboard is the honest test image: it makes the seams of a texture
 * mapping obvious, it shows stretching as rectangles instead of squares, and
 * at a distance it is where filtering either works or visibly fails.
 */

/**
 * A single white pixel.
 *
 * The surface shader samples a texture whatever happens and multiplies by it,
 * so an untextured surface needs something harmless bound. White is the
 * identity for a multiply, which keeps that branch out of the shader.
 */
export function whiteTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return texture;
}

export type CheckerOptions = {
  /** Width and height of the image in pixels. */
  size?: number;
  /** How many squares across. */
  squares?: number;
  light?: string;
  dark?: string;
  /** Draw one square in a different colour, so rotation of the uv is visible. */
  marker?: string | false;
};

/**
 * A checkerboard with one corner square marked, drawn into a canvas and
 * uploaded.
 *
 * The marked square is worth the extra three lines: without it a checker looks
 * the same when the texture coordinates are rotated or mirrored, which is
 * precisely the mistake students need to be able to see.
 */
export function checkerTexture(
  gl: WebGL2RenderingContext,
  options: CheckerOptions = {},
): WebGLTexture {
  const size = options.size ?? 256;
  const squares = options.squares ?? 8;
  const light = options.light ?? "#e8e4da";
  const dark = options.dark ?? "#3f4a5a";

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get a 2d context for the texture");

  const step = size / squares;
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? light : dark;
      ctx.fillRect(x * step, y * step, step, step);
    }
  }

  if (options.marker !== false) {
    ctx.fillStyle = options.marker || "#e0803a";
    ctx.fillRect(0, 0, step, step);
  }

  return fromCanvas(gl, canvas);
}

/** Upload a canvas as a mipmapped, repeating texture. */
export function fromCanvas(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  setFiltering(gl, texture, true);
  return texture;
}

/**
 * Switch one texture between smooth and blocky sampling.
 *
 * Nearest shows what a texture really is - a grid of samples - and is the
 * right setting for showing magnification. Linear with mipmaps is what you
 * ship.
 */
export function setFiltering(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  smooth: boolean,
) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    smooth ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST,
  );
}
