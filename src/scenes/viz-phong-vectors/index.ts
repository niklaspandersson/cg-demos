import { vec3 } from "gl-matrix";
import {
  DirectionalLight,
  MeshNode,
  Node,
  Playground,
  SceneCamera,
  arrow,
  grid,
} from "../../viz";
import type { Collector, Label } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * The Phong lighting model, seen from outside the shader.
 *
 * Every vector the model talks about, drawn at one point on a surface:
 *
 *   N  the surface normal
 *   L  towards the light
 *   V  towards the viewer
 *   R  L mirrored in N - the direction light bounces
 *
 * Diffuse brightness is how closely L lines up with N. Specular is how
 * closely R lines up with V, which is why the highlight moves when you move
 * your head and the diffuse shading does not.
 *
 * Both numbers are shown live, so you can watch a dot product be a dot
 * product.
 *
 * V points at a *scene camera*, not at you. If it pointed at the camera you
 * are looking through it would always point straight out of the screen and
 * be foreshortened to nothing - which is a neat illustration of why the two
 * kinds of camera in this library are kept apart.
 */
class ShadingVectors extends Node {
  /** Where the sample point sits on the surface, in its plane. */
  u = 0;
  v = 0;

  /** Filled in each frame so the readout can show them. */
  diffuse = 0;
  specular = 0;
  shininess = 24;

  #light: DirectionalLight;
  #eye: Node;

  constructor(light: DirectionalLight, eye: Node) {
    super({ name: "shading vectors" });
    this.#light = light;
    this.#eye = eye;
  }

  collect(collector: Collector) {
    const lines = collector.seeThroughLines;
    const length = 2;

    // The surface is the xz plane, so the normal is simply +y. Everything
    // below is in world space, and this node sits at the sample point.
    const normal = vec3.fromValues(0, 1, 0);
    const point = this.worldPosition();

    const toLight = vec3.negate(vec3.create(), this.#light.worldDirection());
    vec3.normalize(toLight, toLight);

    const toEye = vec3.subtract(vec3.create(), this.#eye.worldPosition(), point);
    vec3.normalize(toEye, toEye);

    // R = 2 (N . L) N - L, the mirror of L about the normal.
    const reflected = vec3.scaleAndAdd(
      vec3.create(),
      vec3.negate(vec3.create(), toLight),
      normal,
      2 * vec3.dot(normal, toLight),
    );
    vec3.normalize(reflected, reflected);

    this.diffuse = Math.max(0, vec3.dot(normal, toLight));
    this.specular = Math.pow(Math.max(0, vec3.dot(reflected, toEye)), this.shininess);

    // Drawn in local space, which is this node's own position.
    const scaled = (v: vec3) => [v[0] * length, v[1] * length, v[2] * length] as const;
    arrow(lines, [0, 0, 0], scaled(normal), [0.4, 0.9, 0.5]);
    arrow(lines, [0, 0, 0], scaled(toLight), [1, 0.9, 0.4]);
    arrow(lines, [0, 0, 0], scaled(toEye), [0.5, 0.75, 1]);
    arrow(lines, [0, 0, 0], scaled(reflected), [1, 0.55, 0.6]);

    // The mirror symmetry of L and R about N, which is what makes R what it is.
    lines.dashed(scaled(toLight), scaled(reflected), [1, 1, 1, 0.25], 0.12);
  }
}

export default class Scene extends Playground {
  #vectors!: ShadingVectors;
  #light!: DirectionalLight;
  #eye!: SceneCamera;
  #angle = 42;

  setup() {
    this.viewer.set({ target: [0, 1, 0], fov: 48 });
    this.viewer.setOrbit(35, 22, 10);

    this.scene.add(grid({ size: 12, step: 1 }));

    this.#light = this.scene.add(
      new DirectionalLight({
        name: "Light",
        position: [-2.5, 3, 1.5],
        color: [1, 0.92, 0.7],
        show: { arrow: true, rays: 2, length: 2.2 },
      }),
    );
    this.#aim();

    this.scene.add(
      new MeshNode({
        name: "surface",
        shape: "plane",
        wireframe: false,
        rotation: [-90, 0, 0],
        scale: 7,
        color: [0.72, 0.73, 0.78],
      }),
    );

    this.#eye = this.scene.add(
      new SceneCamera({
        name: "Eye",
        // Placed near the mirror direction, so the highlight is already
        // visible before anything is touched.
        position: [-4.3, 2.2, -2.5],
        fov: 40,
        aspect: 1.4,
        near: 0.5,
        far: 7,
        color: [0.5, 0.75, 1],
        show: { body: true, frustum: true },
      }),
    );

    this.#vectors = this.scene.add(new ShadingVectors(this.#light, this.#eye));
    this.#vectors.transform.setPosition([0, 0.02, 0]);
    this.#eye.transform.lookAt([0, 0.02, 0]);
    this.label("eye", this.#eye, { offset: [0, 0.5, 0], color: [0.5, 0.75, 1] });

    this.label("N", () => this.#offset([0, 2, 0]), { color: [0.4, 0.9, 0.5] });
    this.label("L", () => this.#offset(this.#toLight()), { color: [1, 0.9, 0.4] });
    this.label("V", () => this.#offset(this.#toEye()), { color: [0.5, 0.75, 1] });
    this.label("R", () => this.#offset(this.#reflected()), { color: [1, 0.55, 0.6] });
    // A live readout, so the dot products are numbers you can watch change.
    this.#readout = this.label("", () => this.#offset([0, -0.55, 0]));
  }

  #readout: Label | null = null;

  protected update() {
    if (!this.#readout) return;
    this.#readout.element.textContent =
      `diffuse ${this.#vectors.diffuse.toFixed(2)}` +
      `  ·  specular ${this.#vectors.specular.toFixed(2)}`;
  }

  #offset(direction: readonly number[]): [number, number, number] {
    const p = this.#vectors.worldPosition();
    return [p[0] + direction[0] * 1.15, p[1] + direction[1] * 1.15, p[2] + direction[2] * 1.15];
  }

  #toLight() {
    const d = vec3.negate(vec3.create(), this.#light.worldDirection());
    return [d[0] * 2, d[1] * 2, d[2] * 2];
  }

  #toEye() {
    const d = vec3.subtract(vec3.create(), this.#eye.worldPosition(), this.#vectors.worldPosition());
    vec3.normalize(d, d);
    return [d[0] * 2, d[1] * 2, d[2] * 2];
  }

  #reflected() {
    const l = vec3.negate(vec3.create(), this.#light.worldDirection());
    vec3.normalize(l, l);
    const n = vec3.fromValues(0, 1, 0);
    const r = vec3.scaleAndAdd(vec3.create(), vec3.negate(vec3.create(), l), n, 2 * vec3.dot(n, l));
    vec3.normalize(r, r);
    return [r[0] * 2, r[1] * 2, r[2] * 2];
  }

  #aim() {
    const a = (this.#angle * Math.PI) / 180;
    this.#light.setDirection([-Math.cos(a), -Math.sin(a), -0.45]);
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Light elevation",
        type: "number",
        min: 10,
        max: 85,
        step: 1,
        initial: this.#angle,
        update: (value: number) => {
          this.#angle = value;
          this.#aim();
        },
      },
      {
        title: "Shininess",
        type: "number",
        min: 1,
        max: 128,
        step: 1,
        initial: 24,
        update: (value: number) => (this.#vectors.shininess = value),
      },
      {
        title: "Eye angle",
        type: "number",
        min: -180,
        max: 180,
        step: 1,
        initial: -120,
        update: (value: number) => {
          const a = (value * Math.PI) / 180;
          this.#eye.transform.setPosition([Math.sin(a) * 5, 2.2, Math.cos(a) * 5]);
          this.#eye.transform.lookAt(this.#vectors.worldPosition());
        },
      },
      {
        title: "Sample point x",
        type: "number",
        min: -3,
        max: 3,
        step: 0.05,
        initial: 0,
        update: (value: number) => (this.#vectors.transform.position[0] = value),
      },
      {
        title: "Sample point z",
        type: "number",
        min: -3,
        max: 3,
        step: 0.05,
        initial: 0,
        update: (value: number) => (this.#vectors.transform.position[2] = value),
      },
    ];
  }
}
