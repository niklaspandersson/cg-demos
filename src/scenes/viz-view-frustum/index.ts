import { MeshNode, Playground, SceneCamera, grid } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * What a view frustum is.
 *
 * A camera sits in the scene with its view volume drawn, and the corner inset
 * shows the picture that camera produces. Change the field of view or drag
 * the near and far planes and both views react together, which is the point:
 * the frustum is not decoration, it is exactly what the camera can see.
 *
 * Switching to orthographic uses the same drawing code - the shape simply
 * stops converging, because the corners come from inverting the projection
 * matrix rather than from any assumption about its type.
 */
export default class Scene extends Playground {
  #camera!: SceneCamera;

  setup() {
    this.viewer.set({ target: [0, 1, -1], fov: 50 });
    this.viewer.setOrbit(38, 22, 16);

    this.scene.add(grid({ size: 16, step: 1 }));

    this.#camera = this.scene.add(
      new SceneCamera({
        name: "Camera A",
        position: [0, 1.5, 5],
        lookAt: [0, 0.75, -3],
        fov: 45,
        aspect: 1.5,
        near: 1.5,
        far: 9,
        color: [0.3, 0.8, 1],
        show: {
          body: true,
          axes: true,
          frustum: true,
          nearPlane: true,
          farPlane: true,
          lookAtLine: true,
        },
      }),
    );

    // Something for the camera to look at, spread out in depth so the near
    // and far planes visibly cut things off.
    const colors: [number, number, number][] = [
      [0.95, 0.75, 0.3],
      [0.4, 0.85, 0.55],
      [0.95, 0.45, 0.5],
      [0.75, 0.6, 0.95],
    ];
    for (let i = 0; i < 4; i++) {
      this.scene.add(
        new MeshNode({
          shape: "box",
          wireframe: false,
          position: [(i % 2 ? 1 : -1) * 1.1, 0.5, 1.5 - i * 2.2],
          color: colors[i],
        }),
      );
    }

    this.scene.add(
      new MeshNode({ shape: "sphere", position: [0, 0.6, -6.5], scale: 1.2 }),
    );

    // The labels sit on the camera's view axis, so they follow the sliders
    // that move the planes.
    const camera = this.#camera;
    this.label("eye", camera, { offset: [0, 0.55, 0] });
    this.label("near plane", () => camera.pointAtDepth(camera.near), { color: camera.color });
    this.label("far plane", () => camera.pointAtDepth(camera.far), { color: camera.color });

    this.lookThrough(camera);
  }

  get params(): ParameterDescriptor[] {
    const camera = () => this.#camera;
    return [
      {
        title: "Field of view",
        type: "number",
        min: 10,
        max: 110,
        step: 1,
        initial: 45,
        update: (value: number) => (camera().fov = value),
      },
      {
        title: "Near plane",
        type: "number",
        min: 0.2,
        max: 6,
        step: 0.1,
        initial: 1.5,
        update: (value: number) => (camera().near = value),
      },
      {
        title: "Far plane",
        type: "number",
        min: 2,
        max: 20,
        step: 0.2,
        initial: 9,
        update: (value: number) => (camera().far = value),
      },
      {
        title: "Orthographic",
        type: "boolean",
        update: (value: boolean) => {
          camera().projectionType = value ? "orthographic" : "perspective";
        },
      },
      {
        title: "Image plane",
        type: "boolean",
        update: (value: boolean) => {
          camera().show.imagePlane = value ? 4 : false;
        },
      },
    ];
  }
}
