import { GLSLProgram } from "../../gl/program";

/**
 * The two shaders the playground draws everything with.
 *
 * They are built directly instead of through `GLContext.createProgram` on
 * purpose: these belong to the library, not to the lesson, so they stay out of
 * the shader editor that lists a scene's own programs.
 */

const LINE_VS = `#version 300 es
in vec3 aPosition;
in vec4 aColor;

uniform mat4 uViewProjection;

out vec4 vColor;

void main() {
  vColor = aColor;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;

const LINE_FS = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 fragColor;

void main() {
  fragColor = vColor;
}
`;

const SURFACE_VS = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProjection;
uniform mat3 uNormalMatrix;

out vec3 vNormal;

void main() {
  vNormal = uNormalMatrix * aNormal;
  gl_Position = uViewProjection * uModel * vec4(aPosition, 1.0);
}
`;

const SURFACE_FS = `#version 300 es
precision highp float;

in vec3 vNormal;

uniform vec4 uColor;
uniform vec3 uLightDirection; // the direction the light travels
uniform float uAmbient;
uniform float uUnlit;         // 1.0 disables shading

out vec4 fragColor;

void main() {
  // Surfaces here are often seen from the inside, so light both sides.
  vec3 normal = normalize(vNormal);
  if (!gl_FrontFacing) normal = -normal;

  float lambert = max(dot(normal, -normalize(uLightDirection)), 0.0);
  float shade = mix(uAmbient + (1.0 - uAmbient) * lambert, 1.0, uUnlit);

  fragColor = vec4(uColor.rgb * shade, uColor.a);
}
`;

async function buildProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const program = new GLSLProgram(gl);
  await program.build({ vs, fs });
  return program;
}

export const createLineProgram = (gl: WebGL2RenderingContext) =>
  buildProgram(gl, LINE_VS, LINE_FS);

export const createSurfaceProgram = (gl: WebGL2RenderingContext) =>
  buildProgram(gl, SURFACE_VS, SURFACE_FS);
