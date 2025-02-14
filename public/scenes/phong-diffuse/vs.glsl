#version 300 es

in vec4 aPosition;
in vec4 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uColor;

out vec3 vNormal;
out vec3 vColor;

void main() {
  gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
  vNormal = (uModelViewMatrix * aNormal).xyz;
  vColor = uColor;
}