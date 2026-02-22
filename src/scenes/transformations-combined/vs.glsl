#version 300 es
precision mediump float;

const vec3 vertices[3] = vec3[3](
  vec3(0.0f, 0.5f, 0.0f),
  vec3(-0.5f, -0.5f, 0.0f),
  vec3(0.5f, -0.5f, 0.0f)
);

const vec3 colors[3] = vec3[3](
  vec3(1.0f, 0.0f, 0.0f),
  vec3(0.0f, 1.0f, 0.0f),
  vec3(0.0f, 0.0f, 1.0f)
);

uniform mat4 uTransformation;

out vec3 vColor;

void main() {
  gl_Position = uTransformation * vec4(vertices[gl_VertexID], 1.0f);
  vColor = colors[gl_VertexID];
}
