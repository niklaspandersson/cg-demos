#version 300 es
precision mediump float;

const vec3 vertices[3] = vec3[3](vec3(0.0f, 0.5f, 0.0f), vec3(-0.5f, -0.5f, 0.0f), vec3(0.5f, -0.5f, 0.0f));

uniform float time;
uniform vec3 uColor;
out vec3 color;

void main() {
  gl_Position = vec4(vertices[gl_VertexID], 1.0f);
  float t = (1.f + sin(time)) / 2.0f;
  vec3 result = mix(uColor, vec3(.0f, .0f, 1.f), t);

  color = result;
}