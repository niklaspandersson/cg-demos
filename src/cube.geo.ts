

import { GLSLProgram } from "./gl/program";

const vertices = [
  // Front face
  -0.5, -0.5, 0.5, 1.0,
   0.5, -0.5, 0.5, 1.0,
   0.5,  0.5, 0.5, 1.0,
  -0.5,  0.5, 0.5, 1.0,

  // Back face
  -0.5, -0.5, -0.5, 1.0,
   0.5, -0.5, -0.5, 1.0,
   0.5,  0.5, -0.5, 1.0,
  -0.5,  0.5, -0.5, 1.0,

  // Top face
  -0.5, 0.5,  0.5, 1.0,
   0.5, 0.5,  0.5, 1.0,
   0.5, 0.5, -0.5, 1.0,
  -0.5, 0.5, -0.5, 1.0,

  // Bottom face
  -0.5, -0.5,  0.5, 1.0,
   0.5, -0.5,  0.5, 1.0,
   0.5, -0.5, -0.5, 1.0,
  -0.5, -0.5, -0.5, 1.0,

  // Right face
  0.5, -0.5,  0.5, 1.0,
  0.5,  0.5,  0.5, 1.0,
  0.5,  0.5, -0.5, 1.0,
  0.5, -0.5, -0.5, 1.0,

  // Left face
  -0.5, -0.5,  0.5, 1.0,
  -0.5,  0.5,  0.5, 1.0,
  -0.5,  0.5, -0.5, 1.0,
  -0.5, -0.5, -0.5, 1.0,
];

const Normals = {
  front:  [0, 0, 1, 0],
  back:   [0, 0, -1, 0],
  left:   [-1, 0, 0, 0],
  right:  [1, 0, 0, 0],
  top:    [0, 1, 0, 0],
  bottom: [0, -1, 0, 0],
};

const Colors = {
  front:  [1, 0, 0, 1],
  back:   [0, 1, 0, 1],
  left:   [0, 0, 1, 1],
  right:  [1, 1, 0, 1],
  top:    [1, 0, 1, 1],
  bottom: [0, 1, 1, 1],
};

// Define the face normals
const faceNormals = [
  // Front face
  ...Normals.front,
  ...Normals.front,
  ...Normals.front,
  ...Normals.front,

  // Back face
  ...Normals.back,
  ...Normals.back,
  ...Normals.back,
  ...Normals.back,

  // Top face
  ...Normals.top,
  ...Normals.top,
  ...Normals.top,
  ...Normals.top,

  // Bottom face
  ...Normals.bottom,
  ...Normals.bottom,
  ...Normals.bottom,
  ...Normals.bottom,

  // Right face
  ...Normals.right,
  ...Normals.right,
  ...Normals.right,
  ...Normals.right,

  // Left face
  ...Normals.left,
  ...Normals.left,
  ...Normals.left,
  ...Normals.left,
];

const colors = [
  // Front face
  ...Colors.front,
  ...Colors.front,
  ...Colors.front,
  ...Colors.front,

  // Back face
  ...Colors.back,
  ...Colors.back,
  ...Colors.back,
  ...Colors.back,

  // Top face
  ...Colors.top,
  ...Colors.top,
  ...Colors.top,
  ...Colors.top,

  // Bottom face
  ...Colors.bottom,
  ...Colors.bottom,
  ...Colors.bottom,
  ...Colors.bottom,

  // Right face
  ...Colors.right,
  ...Colors.right,
  ...Colors.right,
  ...Colors.right,

  // Left face
  ...Colors.left,
  ...Colors.left,
  ...Colors.left,
  ...Colors.left,
];

// Define the indices to form triangles
const indices = [
  0, 1, 2,
  0, 2, 3, // Front face

  4, 5, 6,
  4, 6, 7, // Back face

  8, 9, 10,
  8, 10, 11, // Top face
  
  12, 13, 14,
  12, 14, 15, // Bottom face

  16, 17, 18,
  16, 18, 19, // Right face
  
  20, 21, 22,
  20, 22, 23, // Left face
];

const cube = {
  vertices,
  faceNormals,
  colors,
  indices,
};

function createIndexBuffer(gl: WebGL2RenderingContext, indices: number[]) {
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  return indexBuffer;
}

/** @param {WebGL2RenderingContext} gl */
export function createCube(gl: WebGL2RenderingContext, program: GLSLProgram) {
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([...cube.vertices, ...cube.faceNormals, ...cube.colors]),
    gl.STATIC_DRAW
  );

  const attributes = program.getAttribLocations([
    "aPosition",
    "aNormal",
    "aColor",
  ]);
  if (attributes["aPosition"] < 0)
    throw new Error("No position attribute present");

  gl.vertexAttribPointer(attributes["aPosition"], 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(attributes["aPosition"]);

  if (attributes["aNormal"] > 0) {
    gl.vertexAttribPointer(
      attributes["aNormal"],
      4,
      gl.FLOAT,
      false,
      0,
      6 * 4 * 4 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(attributes["aNormal"]);
  }

  if (attributes["aColor"] > 0) {
    gl.vertexAttribPointer(
      attributes["aColor"],
      4,
      gl.FLOAT,
      false,
      0,
      2 * 6 * 4 * 4 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(attributes["aColor"]);
  }

  const indexBuffer = createIndexBuffer(gl, cube.indices);

  return { vertexBuffer, indexBuffer, numElements: cube.indices.length };
}
