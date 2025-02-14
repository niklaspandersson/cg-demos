#version 300 es

precision mediump float;

in vec3 vNormal;
in vec3 vColor;

out vec4 fragColor;
void main() {
  vec3 lightDirection = normalize(vec3(0.0f, 0.0f, 1.0f));
  float brightness = max(dot(vNormal, lightDirection), 0.0f);
  fragColor = vec4(vColor * brightness, 1.0f);
}