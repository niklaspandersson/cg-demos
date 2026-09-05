import { mat4, vec3 } from "gl-matrix";
import {
  MeshNode,
  Playground,
  SceneCamera,
  frustumPlanes,
  grid,
  sphereInFrustum,
} from "../../viz";
import type { ParameterDescriptor } from "../../gl";

const INSIDE: [number, number, number] = [0.45, 0.9, 0.55];
const OUTSIDE: [number, number, number] = [0.5, 0.5, 0.58];

/**
 * Why a renderer throws work away before doing it.
 *
 * Every object is tested against the six planes of the camera's frustum and
 * coloured green if it survives. Swing the camera around and watch objects
 * drop out - and check the inset: everything grey really is absent from the
 * picture, which is the whole justification for not drawing it.
 *
 * The test uses a bounding sphere, which is what a real renderer does. It is
 * wrong only in the harmless direction: it can keep something that turns out
 * to be invisible, never drop something that would have been seen.
 */
export default class Scene extends Playground {
  #camera!: SceneCamera;
  #objects: MeshNode[] = [];
  #angle = 0;

  setup() {
    this.viewer.set({ target: [0, 0.5, 0], fov: 50 });
    this.viewer.setOrbit(20, 45, 26);

    this.scene.add(grid({ size: 22, step: 1 }));

    this.#camera = this.scene.add(
      new SceneCamera({
        name: "Camera",
        position: [0, 1.4, 8],
        fov: 40,
        aspect: 1.5,
        near: 1,
        far: 12,
        color: [0.35, 0.8, 1],
        show: { body: true, frustum: true, nearPlane: true, farPlane: true },
      }),
    );
    this.#aim();

    // A field of objects, deliberately wider and deeper than the frustum.
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        this.#objects.push(
          this.scene.add(
            new MeshNode({
              shape: "box",
              wireframe: false,
              position: [x * 2, 0.5, z * 2],
              scale: 0.9,
            }),
          ),
        );
      }
    }

    this.lookThrough(this.#camera, { widthFraction: 0.3 });
  }

  #aim() {
    const a = (this.#angle * Math.PI) / 180;
    this.#camera.transform.setPosition([Math.sin(a) * 8, 1.4, Math.cos(a) * 8]);
    this.#camera.transform.lookAt([0, 0.5, 0]);
  }

  protected update() {
    // The scene graph is refreshed after update(), so the camera's world
    // matrix has to be brought up to date before its planes are extracted.
    this.scene.update();

    const viewProjection = mat4.multiply(
      mat4.create(),
      this.#camera.projectionMatrix(),
      this.#camera.viewMatrix(),
    );
    const planes = frustumPlanes(viewProjection);

    const center = vec3.create();
    for (const object of this.#objects) {
      object.worldPosition(center);
      // The unit box's corners are 0.87 from its centre, before scaling.
      const radius = 0.87 * object.transform.scale[0];
      object.color = sphereInFrustum(planes, center, radius) ? INSIDE : OUTSIDE;
    }
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Camera angle",
        type: "number",
        min: -180,
        max: 180,
        step: 1,
        initial: 0,
        update: (value: number) => {
          this.#angle = value;
          this.#aim();
        },
      },
      {
        title: "Field of view",
        type: "number",
        min: 15,
        max: 100,
        step: 1,
        initial: 40,
        update: (value: number) => (this.#camera.fov = value),
      },
      {
        title: "Far plane",
        type: "number",
        min: 3,
        max: 25,
        step: 0.5,
        initial: 12,
        update: (value: number) => (this.#camera.far = value),
      },
    ];
  }
}
