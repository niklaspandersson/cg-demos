import { GLSLProgram } from "../../gl/program";

/**
 * The two shaders the playground draws everything with.
 *
 * They are built directly instead of through `GLContext.createProgram` on
 * purpose: these belong to the library, not to the lesson, so they stay out of
 * the shader editor that lists a scene's own programs.
 */

const LINE_VS = `#version 300 es
// One instance per line segment, drawn as a four-corner strip. The segment's
// two endpoints arrive together, and the vertex shader widens it in screen
// space - browsers clamp gl.lineWidth to one pixel, so a line thick enough to
// see on a projector has to be built out of triangles.
in vec3 aPosition;  // one end of the segment
in vec3 aNormal;    // the other end
in vec4 aColor;
in vec2 aTexCoord;  // x: which end (0 or 1), y: which side (-1 or +1)

uniform mat4 uViewProjection;
uniform vec2 uHalfViewport; // half the viewport, in pixels
uniform float uThickness;   // in pixels

out vec4 vColor;

/**
 * Pull an endpoint that is at or behind the eye forward to where w is safely
 * positive, so dividing by w below cannot send it somewhere absurd.
 */
vec4 clipToFront(vec4 keep, vec4 move) {
  float epsilon = 0.0001;
  if (move.w >= epsilon) return move;
  return mix(move, keep, (epsilon - move.w) / (keep.w - move.w));
}

void main() {
  vec4 a = clipToFront(uViewProjection * vec4(aNormal, 1.0), uViewProjection * vec4(aPosition, 1.0));
  vec4 b = clipToFront(uViewProjection * vec4(aPosition, 1.0), uViewProjection * vec4(aNormal, 1.0));

  vec4 clip = mix(a, b, aTexCoord.x);
  vColor = aColor;

  // Offset sideways by half the thickness. Scaling by clip.w undoes the
  // perspective divide that is about to happen, which is what keeps the line
  // the same number of pixels wide however far away it is.
  vec2 direction = (b.xy / b.w - a.xy / a.w) * uHalfViewport;
  vec2 side = dot(direction, direction) > 0.0
    ? normalize(vec2(-direction.y, direction.x))
    : vec2(0.0);

  clip.xy += side * aTexCoord.y * uThickness * 0.5 * clip.w / uHalfViewport;
  gl_Position = clip;
}
`;

const LINE_FS = `#version 300 es
precision highp float;

in vec4 vColor;

uniform float uOpacity; // dims the pass that draws hidden lines

out vec4 fragColor;

void main() {
  fragColor = vec4(vColor.rgb, vColor.a * uOpacity);
}
`;

const SURFACE_VS = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProjection;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec3 vWorldPosition;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);

  vNormal = uNormalMatrix * aNormal;
  vWorldPosition = world.xyz;
  gl_Position = uViewProjection * world;
}
`;

const SURFACE_FS = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPosition;

uniform vec4 uColor;
uniform float uAmbient;
uniform float uUnlit;              // 1.0 disables shading

// One light of each kind is enough to illustrate the differences between
// them. A black colour means "this light is not in the scene".
uniform vec3 uDirectionalColor;
uniform vec3 uDirectionalDirection; // the direction the light travels

uniform vec3 uPointColor;
uniform vec3 uPointPosition;
uniform float uPointRange;

uniform vec3 uSpotColor;
uniform vec3 uSpotPosition;
uniform vec3 uSpotDirection;
uniform float uSpotRange;
uniform vec2 uSpotCone;             // cos(outer), cos(inner)

out vec4 fragColor;

/** Fades to a quarter of the brightness at the light's range. */
float attenuation(float distance, float range) {
  float d = distance / max(range, 0.001);
  return 1.0 / (1.0 + 3.0 * d * d);
}

void main() {
  // Surfaces here are often seen from the inside, so light both sides.
  vec3 normal = normalize(vNormal);
  if (!gl_FrontFacing) normal = -normal;

  vec3 light = vec3(uAmbient);

  light += uDirectionalColor * max(dot(normal, -normalize(uDirectionalDirection)), 0.0);

  vec3 toPoint = uPointPosition - vWorldPosition;
  float pointDistance = length(toPoint);
  light += uPointColor
    * max(dot(normal, toPoint / max(pointDistance, 0.0001)), 0.0)
    * attenuation(pointDistance, uPointRange);

  vec3 toSpot = uSpotPosition - vWorldPosition;
  float spotDistance = length(toSpot);
  vec3 spotDir = toSpot / max(spotDistance, 0.0001);
  // How far inside the cone this point is: 1 within the bright core, 0
  // outside the outer angle, a soft edge in between.
  float cone = smoothstep(uSpotCone.x, uSpotCone.y, dot(-spotDir, normalize(uSpotDirection)));
  light += uSpotColor
    * max(dot(normal, spotDir), 0.0)
    * cone
    * attenuation(spotDistance, uSpotRange);

  vec3 shaded = mix(uColor.rgb * light, uColor.rgb, uUnlit);
  fragColor = vec4(shaded, uColor.a);
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
