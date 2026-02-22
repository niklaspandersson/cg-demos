#version 300 es

in vec4 aPosition;
in vec2 aTexCoord;

out vec2 vTexCoord;

void main() {
  gl_Position = aPosition;
  // Scale UVs to [0, 3] range to show wrapping behavior
  vTexCoord = aTexCoord * 3.0;
}
