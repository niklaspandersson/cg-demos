import { mat4, vec3 } from "gl-matrix";
import { STANDARD_ATTRIB_LOCATIONS } from "../../gl/program";
import { rgba, type Color, type Vec3Like } from "../types";

const FLOATS_PER_VERTEX = 7; // x y z  r g b a

/**
 * Every line in the playground - grids, axes, wireframes, frustums, light
 * directions - ends up in this one batch and is drawn with a single
 * `gl.LINES` call.
 *
 * That is the trick that keeps the library small: a gizmo never owns a buffer
 * or a shader, it just pushes segments. Adding a new one is a function, not a
 * class.
 *
 * Points are pushed in whatever space `transform` describes (the renderer sets
 * it to the current node's world matrix), so gizmo code can work in
 * comfortable local coordinates.
 */
export class LineBatch {
  /** Applied to every point pushed. `null` means the points are world space. */
  transform: mat4 | null = null;

  #data = new Float32Array(1024 * FLOATS_PER_VERTEX);
  #vertexCount = 0;

  #gl: WebGL2RenderingContext;
  #vao: WebGLVertexArrayObject;
  #buffer: WebGLBuffer;
  #capacityOnGpu = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error("Failed to create line buffers");
    this.#vao = vao;
    this.#buffer = buffer;

    const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(STANDARD_ATTRIB_LOCATIONS.aPosition);
    gl.vertexAttribPointer(STANDARD_ATTRIB_LOCATIONS.aPosition, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(STANDARD_ATTRIB_LOCATIONS.aColor);
    gl.vertexAttribPointer(
      STANDARD_ATTRIB_LOCATIONS.aColor,
      4,
      gl.FLOAT,
      false,
      stride,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.bindVertexArray(null);
  }

  clear() {
    this.#vertexCount = 0;
    this.transform = null;
  }

  line(a: Vec3Like, b: Vec3Like, color: Color) {
    this.#vertex(a, color);
    this.#vertex(b, color);
  }

  /** `points` is a flat list of xyz triples used as pairs of endpoints. */
  segments(points: ArrayLike<number>, color: Color) {
    const p: vec3 = [0, 0, 0];
    for (let i = 0; i + 2 < points.length; i += 3) {
      vec3.set(p, points[i], points[i + 1], points[i + 2]);
      this.#vertex(p, color);
    }
  }

  polyline(points: readonly Vec3Like[], color: Color, closed = false) {
    for (let i = 0; i + 1 < points.length; i++) this.line(points[i], points[i + 1], color);
    if (closed && points.length > 2) this.line(points[points.length - 1], points[0], color);
  }

  /** A dashed segment, useful for "this is a construction line, not geometry". */
  dashed(a: Vec3Like, b: Vec3Like, color: Color, dashLength = 0.15) {
    const from = vec3.clone(a as vec3);
    const to = vec3.clone(b as vec3);
    const total = vec3.distance(from, to);
    if (total < 1e-6) return;

    const steps = Math.max(1, Math.round(total / (dashLength * 2)));
    const point = vec3.create();
    const next = vec3.create();
    for (let i = 0; i < steps; i++) {
      vec3.lerp(point, from, to, i / steps);
      vec3.lerp(next, from, to, (i + 0.5) / steps);
      this.line(point, next, color);
    }
  }

  /** Upload this frame's segments and draw them all at once. */
  flush() {
    if (this.#vertexCount === 0) return;

    const gl = this.#gl;
    const used = this.#data.subarray(0, this.#vertexCount * FLOATS_PER_VERTEX);

    gl.bindVertexArray(this.#vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);
    if (this.#data.length > this.#capacityOnGpu) {
      gl.bufferData(gl.ARRAY_BUFFER, this.#data.byteLength, gl.DYNAMIC_DRAW);
      this.#capacityOnGpu = this.#data.length;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, used);
    gl.drawArrays(gl.LINES, 0, this.#vertexCount);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.#gl.deleteBuffer(this.#buffer);
    this.#gl.deleteVertexArray(this.#vao);
  }

  #scratch = vec3.create();
  #vertex(point: Vec3Like, color: Color) {
    let p = point;
    if (this.transform) {
      p = vec3.transformMat4(this.#scratch, point, this.transform);
    }

    this.#reserve(this.#vertexCount + 1);
    const [r, g, b, a] = rgba(color);
    const at = this.#vertexCount * FLOATS_PER_VERTEX;
    this.#data.set([p[0], p[1], p[2], r, g, b, a], at);
    this.#vertexCount++;
  }

  #reserve(vertices: number) {
    const needed = vertices * FLOATS_PER_VERTEX;
    if (needed <= this.#data.length) return;

    let size = this.#data.length;
    while (size < needed) size *= 2;

    const grown = new Float32Array(size);
    grown.set(this.#data);
    this.#data = grown;
  }
}
