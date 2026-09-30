import { MeshNode, Playground, SceneCamera, axes, grid } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * Does the camera move, or does the world?
 *
 * The slider swings the scene camera around a stationary object. In the main
 * view the camera is obviously the thing moving. In the inset - which is what
 * that camera renders - the object appears to swing instead, because the view
 * matrix is the inverse of where the camera is standing: moving the camera
 * one way is exactly moving the whole world the other way.
 *
 * The world axes stay put while the camera's own axes rotate with it, which
 * is the same fact drawn twice.
 */
export default class Scene extends Playground {
  #camera!: SceneCamera;
  #angle = 35;
  #radius = 5;

  setup() {
    this.viewer.set({ target: [0, 0.8, 0], fov: 48 });
    this.viewer.setOrbit(24, 24, 17);

    this.scene.add(grid({ size: 14, step: 1 }));
    this.scene.add(axes({ name: "world origin", size: 2 }));
    this.label("world origin", [0, 0, 0], { offset: [0, -0.35, 0] });

    this.#camera = this.scene.add(
      new SceneCamera({
        name: "Camera",
        fov: 50,
        aspect: 1.4,
        near: 0.6,
        far: 7.5,
        color: [0.35, 0.85, 1],
        show: { body: true, axes: true, frustum: true, lookAtLine: true },
      }),
    );
    this.#place();
    this.label("camera", this.#camera, { offset: [0, 0.7, 0], color: [0.35, 0.85, 1] });

    // One asymmetric object, so you can tell which side you are looking at.
    this.scene.add(
      new MeshNode({
        name: "subject",
        shape: "box",
        wireframe: false,
        position: [0, 0.5, 0],
        color: [0.95, 0.72, 0.3],
      }),
    );
    this.scene.add(
      new MeshNode({
        shape: "box",
        wireframe: false,
        position: [0.75, 0.25, 0],
        scale: 0.5,
        color: [0.4, 0.8, 0.55],
      }),
    );
    this.scene.add(
      new MeshNode({ shape: "sphere", wireframe: false, position: [0, 1.35, 0], scale: 0.6, color: [0.9, 0.45, 0.5] }),
    );

    this.lookThrough(this.#camera, { widthFraction: 0.32 });
  }

  #place() {
    const a = (this.#angle * Math.PI) / 180;
    this.#camera.transform.setPosition([
      Math.sin(a) * this.#radius,
      1.6,
      Math.cos(a) * this.#radius,
    ]);
    this.#camera.transform.lookAt([0, 0.7, 0]);
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Camera angle",
        type: "number",
        min: -180,
        max: 180,
        step: 1,
        initial: this.#angle,
        update: (value: number) => {
          this.#angle = value;
          this.#place();
        },
      },
      {
        title: "Distance",
        type: "number",
        min: 2,
        max: 10,
        step: 0.1,
        initial: this.#radius,
        update: (value: number) => {
          this.#radius = value;
          this.#place();
        },
      },
    ];
  }
}
