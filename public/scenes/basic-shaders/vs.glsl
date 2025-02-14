#version 300 es

const vec3 vertices[3] = vec3[3](vec3(0.0f, 0.5f, 0.0f), vec3(-0.5f, -0.5f, 0.0f), vec3(0.5f, -0.5f, 0.0f));

void main() {
  gl_Position = vec4(vertices[gl_VertexID], 1.0f);
}