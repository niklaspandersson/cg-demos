import { GLSLProgram } from "./gl/program";

// position {xyzw}, normal {xyzw}, texcoord {xy}
const vertexData = [
  -0.5, -0.5, 0, 1.0, 0, 0, 1, 0, 0, 0,
  0.5, -0.5, 0, 1.0, 0, 0, 1, 0, 1, 0,
  0.5, 0.5, 0, 1.0, 0, 0, 1, 0, 1, 1,
  -0.5, 0.5, 0, 1.0, 0, 0, 1, 0, 0, 1
];

// Define the indices to form triangles
const indices = [
  0, 1, 2, 0, 2, 3
];

const plane = {
  vertexData,
  indices
};

function createIndexBuffer(gl: WebGL2RenderingContext, indices: number[]) {
  const indexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
  return indexBuffer
}

/** @param {WebGL2RenderingContext} gl */
export function createPlane(gl: WebGL2RenderingContext, program: GLSLProgram) {
  const vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(plane.vertexData), gl.STATIC_DRAW)

  const attributes = program.getAttribLocations(['aPosition', 'aNormal', 'aTexCoord'])
  if (attributes['aPosition'] < 0)
    throw new Error('No position attribute present')

  const stride = Float32Array.BYTES_PER_ELEMENT * 10

  gl.vertexAttribPointer(attributes['aPosition'], 4, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(attributes['aPosition'])

  if (attributes['aNormal'] > 0) {
    gl.vertexAttribPointer(attributes['aNormal'], 4, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
    gl.enableVertexAttribArray(attributes['aNormal'])
  }

  if (attributes['aTexCoord'] > 0) {
    gl.vertexAttribPointer(attributes['aTexCoord'], 2, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
    gl.enableVertexAttribArray(attributes['aTexCoord'])
  }

  const indexBuffer = createIndexBuffer(gl, plane.indices)

  return { vertexBuffer, indexBuffer, numElements: plane.indices.length }
}