import { STANDARD_ATTRIB_LOCATIONS } from "../../gl/program";

/**
 * Plain arrays describing a piece of geometry, independent of WebGL. The
 * primitive builders produce these; `GpuMesh` uploads them.
 */
export type MeshData = {
  /** 3 floats per vertex */
  positions: number[];
  /** 3 floats per vertex, optional for geometry that is never lit */
  normals?: number[];
  indices: number[];
};

/**
 * Geometry on the GPU, wrapped in a vertex array object.
 *
 * The VAO records how the buffers feed the shader, so drawing an object is a
 * single `bindVertexArray` instead of re-specifying every attribute pointer.
 * That matters here because a playground draws many small objects per frame.
 */
export class GpuMesh {
  #gl: WebGL2RenderingContext;
  #vao: WebGLVertexArrayObject;
  #buffers: WebGLBuffer[] = [];
  #indexCount: number;

  constructor(gl: WebGL2RenderingContext, data: MeshData) {
    this.#gl = gl;
    this.#indexCount = data.indices.length;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create vertex array object");
    this.#vao = vao;

    gl.bindVertexArray(vao);
    this.#attribute(STANDARD_ATTRIB_LOCATIONS.aPosition, data.positions, 3);
    if (data.normals)
      this.#attribute(STANDARD_ATTRIB_LOCATIONS.aNormal, data.normals, 3);

    const indexBuffer = gl.createBuffer();
    if (!indexBuffer) throw new Error("Failed to create index buffer");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(data.indices),
      gl.STATIC_DRAW,
    );
    this.#buffers.push(indexBuffer);

    gl.bindVertexArray(null);
  }

  draw() {
    const gl = this.#gl;
    gl.bindVertexArray(this.#vao);
    gl.drawElements(gl.TRIANGLES, this.#indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.#gl;
    for (const buffer of this.#buffers) gl.deleteBuffer(buffer);
    gl.deleteVertexArray(this.#vao);
    this.#buffers = [];
  }

  #attribute(location: number, values: number[], size: number) {
    const gl = this.#gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create vertex buffer");

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);

    this.#buffers.push(buffer);
  }
}
