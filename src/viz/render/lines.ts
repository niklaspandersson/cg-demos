import { mat4, vec3 } from "gl-matrix";
import { STANDARD_ATTRIB_LOCATIONS } from "../../gl/program";
import { rgba, type Color, type Vec3Like } from "../types";

/** Per segment: both endpoints and one colour. */
const FLOATS_PER_SEGMENT = 10;

/**
 * The four corners of a segment's quad, as (which end, which side).
 * Drawn as a triangle strip, one instance per segment.
 */
const CORNERS = new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]);

/**
 * Every line in the playground - grids, wireframes, axes, frustums, light
 * directions - ends up in this one batch and is drawn with a single call.
 *
 * That is the trick that keeps the library small: a gizmo never owns a buffer
 * or a shader, it just pushes segments. Adding a new one is a function, not a
 * class.
 *
 * Points are pushed in whatever space `transform` describes (the renderer sets
 * it to the current node's world matrix), so gizmo code can work in
 * comfortable local coordinates.
 *
 * Each segment is drawn as a screen-space quad rather than with `gl.LINES`,
 * because browsers clamp `gl.lineWidth` to one pixel and a one pixel line is
 * hard to see on a projector. The widening happens in the vertex shader; see
 * `programs.ts`.
 */
export class LineBatch {
  /** Applied to every point pushed. `null` means the points are world space. */
  transform: mat4 | null = null;

  /** Line width in pixels, the same at any distance. */
  thickness = 1.6;

  #data = new Float32Array(512 * FLOATS_PER_SEGMENT);
  #count = 0;

  #gl: WebGL2RenderingContext;
  #vao: WebGLVertexArrayObject;
  #buffer: WebGLBuffer;
  #corners: WebGLBuffer;
  #capacityOnGpu = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    const corners = gl.createBuffer();
    if (!vao || !buffer || !corners) throw new Error("Failed to create line buffers");
    this.#vao = vao;
    this.#buffer = buffer;
    this.#corners = corners;

    gl.bindVertexArray(vao);

    // Which corner of the quad this vertex is: the same four for every
    // segment, so it does not advance per instance.
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(STANDARD_ATTRIB_LOCATIONS.aTexCoord);
    gl.vertexAttribPointer(STANDARD_ATTRIB_LOCATIONS.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    // The segment itself advances once per instance.
    const stride = FLOATS_PER_SEGMENT * Float32Array.BYTES_PER_ELEMENT;
    const float = Float32Array.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    this.#instanced(STANDARD_ATTRIB_LOCATIONS.aPosition, 3, stride, 0);
    this.#instanced(STANDARD_ATTRIB_LOCATIONS.aNormal, 3, stride, 3 * float);
    this.#instanced(STANDARD_ATTRIB_LOCATIONS.aColor, 4, stride, 6 * float);

    gl.bindVertexArray(null);
  }

  get segmentCount() {
    return this.#count;
  }

  clear() {
    this.#count = 0;
    this.transform = null;
  }

  line(a: Vec3Like, b: Vec3Like, color: Color) {
    this.#segment(a, b, color);
  }

  /** `points` is a flat list of xyz triples, read as pairs of endpoints. */
  segments(points: ArrayLike<number>, color: Color) {
    const a: vec3 = [0, 0, 0];
    const b: vec3 = [0, 0, 0];
    for (let i = 0; i + 5 < points.length; i += 6) {
      vec3.set(a, points[i], points[i + 1], points[i + 2]);
      vec3.set(b, points[i + 3], points[i + 4], points[i + 5]);
      this.#segment(a, b, color);
    }
  }

  polyline(points: readonly Vec3Like[], color: Color, closed = false) {
    for (let i = 0; i + 1 < points.length; i++) this.#segment(points[i], points[i + 1], color);
    if (closed && points.length > 2) this.#segment(points[points.length - 1], points[0], color);
  }

  /** A dashed segment, for "this is a construction line, not geometry". */
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
      this.#segment(point, next, color);
    }
  }

  /** Upload this frame's segments. Call once, then `draw()` as often as needed. */
  upload() {
    if (this.#count === 0) return;

    const gl = this.#gl;
    gl.bindVertexArray(this.#vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);

    if (this.#data.length > this.#capacityOnGpu) {
      gl.bufferData(gl.ARRAY_BUFFER, this.#data.byteLength, gl.DYNAMIC_DRAW);
      this.#capacityOnGpu = this.#data.length;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.#data.subarray(0, this.#count * FLOATS_PER_SEGMENT));
    gl.bindVertexArray(null);
  }

  draw() {
    if (this.#count === 0) return;

    const gl = this.#gl;
    gl.bindVertexArray(this.#vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.#count);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.#gl.deleteBuffer(this.#buffer);
    this.#gl.deleteBuffer(this.#corners);
    this.#gl.deleteVertexArray(this.#vao);
  }

  #instanced(location: number, size: number, stride: number, offset: number) {
    const gl = this.#gl;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(location, 1);
  }

  #a = vec3.create();
  #b = vec3.create();
  #segment(a: Vec3Like, b: Vec3Like, color: Color) {
    let from = a;
    let to = b;
    if (this.transform) {
      from = vec3.transformMat4(this.#a, a, this.transform);
      to = vec3.transformMat4(this.#b, b, this.transform);
    }

    this.#reserve(this.#count + 1);
    const [r, g, bb, alpha] = rgba(color);
    const at = this.#count * FLOATS_PER_SEGMENT;
    this.#data.set(
      [from[0], from[1], from[2], to[0], to[1], to[2], r, g, bb, alpha],
      at,
    );
    this.#count++;
  }

  #reserve(segments: number) {
    const needed = segments * FLOATS_PER_SEGMENT;
    if (needed <= this.#data.length) return;

    let size = this.#data.length;
    while (size < needed) size *= 2;

    const grown = new Float32Array(size);
    grown.set(this.#data);
    this.#data = grown;
  }
}
