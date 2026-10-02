import { mat4, vec3 } from "gl-matrix";
import { STANDARD_ATTRIB_LOCATIONS } from "../../gl/program";
import { rgba, type Color, type Vec3Like } from "../types";

/** Per point: position, colour and a diameter in pixels. */
const FLOATS_PER_POINT = 8;

/**
 * The dots that show where the vertices are.
 *
 * Like `LineBatch`, a node never owns a buffer: it pushes points in its own
 * local space and the whole scene's worth is drawn in one call. Unlike lines,
 * this one really can use the primitive WebGL offers - `gl.POINTS` with
 * `gl_PointSize` is not clamped the way `gl.lineWidth` is - so a point is one
 * vertex rather than a quad built in the vertex shader.
 */
export class PointBatch {
  /** Applied to every point pushed. `null` means the points are world space. */
  transform: mat4 | null = null;

  /** Diameter in pixels, used by `point()` when none is given. */
  size = 9;

  #data = new Float32Array(256 * FLOATS_PER_POINT);
  #count = 0;

  #gl: WebGL2RenderingContext;
  #vao: WebGLVertexArrayObject;
  #buffer: WebGLBuffer;
  #capacityOnGpu = 0;
  #scratch = vec3.create();

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error("Failed to create point buffers");
    this.#vao = vao;
    this.#buffer = buffer;

    const stride = FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
    const float = Float32Array.BYTES_PER_ELEMENT;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    this.#attribute(STANDARD_ATTRIB_LOCATIONS.aPosition, 3, stride, 0);
    this.#attribute(STANDARD_ATTRIB_LOCATIONS.aColor, 4, stride, 3 * float);
    // The point program reads its diameter from aTexCoord.x - the same kind of
    // reuse the line program makes of aNormal, and for the same reason: the
    // four standard attribute slots are the ones every program here agrees on.
    this.#attribute(STANDARD_ATTRIB_LOCATIONS.aTexCoord, 2, stride, 7 * float);
    gl.bindVertexArray(null);
  }

  get pointCount() {
    return this.#count;
  }

  clear() {
    this.#count = 0;
    this.transform = null;
  }

  point(position: Vec3Like, color: Color, size = this.size) {
    this.#grow();

    const point = this.transform
      ? vec3.transformMat4(this.#scratch, position as vec3, this.transform)
      : (position as vec3);

    const [r, g, b, a] = rgba(color);
    const at = this.#count * FLOATS_PER_POINT;
    this.#data[at] = point[0];
    this.#data[at + 1] = point[1];
    this.#data[at + 2] = point[2];
    this.#data[at + 3] = r;
    this.#data[at + 4] = g;
    this.#data[at + 5] = b;
    this.#data[at + 6] = a;
    this.#data[at + 7] = size;
    this.#count++;
  }

  /** `points` is a flat list of xyz triples. */
  all(points: ArrayLike<number>, color: Color, size = this.size) {
    for (let i = 0; i + 2 < points.length; i += 3) {
      this.point(vec3.set(vec3.create(), points[i], points[i + 1], points[i + 2]), color, size);
    }
  }

  upload() {
    if (this.#count === 0) return;

    const gl = this.#gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);

    const floats = this.#count * FLOATS_PER_POINT;
    if (this.#capacityOnGpu < this.#data.length) {
      gl.bufferData(gl.ARRAY_BUFFER, this.#data, gl.DYNAMIC_DRAW);
      this.#capacityOnGpu = this.#data.length;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.#data.subarray(0, floats));
    }
  }

  draw() {
    if (this.#count === 0) return;
    const gl = this.#gl;
    gl.bindVertexArray(this.#vao);
    gl.drawArrays(gl.POINTS, 0, this.#count);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.#gl.deleteBuffer(this.#buffer);
    this.#gl.deleteVertexArray(this.#vao);
  }

  #grow() {
    const needed = (this.#count + 1) * FLOATS_PER_POINT;
    if (needed <= this.#data.length) return;

    const bigger = new Float32Array(this.#data.length * 2);
    bigger.set(this.#data);
    this.#data = bigger;
  }

  #attribute(location: number, size: number, stride: number, offset: number) {
    const gl = this.#gl;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }
}
