import {
  DirectionalLight,
  MeshNode,
  Playground,
  PointLight,
  SpotLight,
  grid,
} from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * The three kinds of light, side by side.
 *
 * All three light the whole scene, as real lights would, so switch them on
 * and off one at a time to see what each contributes. The gizmos are chosen
 * to show what makes them different: parallel rays that do not care where the
 * light is, rays radiating from a point that has no direction, and a cone
 * that has both.
 */
export default class Scene extends Playground {
  #directional!: DirectionalLight;
  #point!: PointLight;
  #spot!: SpotLight;

  setup() {
    this.viewer.set({ target: [0, 1, 0], fov: 50 });
    this.viewer.setOrbit(20, 28, 20);

    this.scene.add(grid({ size: 20, step: 1 }));

    // No stand-in light: this scene is about the lights it contains, so with
    // all of them off it should go dark rather than stay conveniently lit.
    this.renderer.defaultLight = null;

    this.#directional = this.scene.add(
      new DirectionalLight({
        name: "Sun",
        position: [-6, 4.5, 2],
        direction: [0.35, -1, -0.3],
        color: [1, 0.93, 0.75],
        show: { arrow: true, rays: 3, plane: true, length: 4 },
      }),
    );

    this.#point = this.scene.add(
      new PointLight({
        name: "Bulb",
        position: [0, 3.2, 0],
        color: [0.6, 0.85, 1],
        range: 7,
        show: { star: true, rays: 14, length: 1.2 },
      }),
    );

    this.#spot = this.scene.add(
      new SpotLight({
        name: "Spot",
        position: [6, 5, 2],
        lookAt: [6, 0, -1],
        angle: 26,
        penumbra: 10,
        range: 12,
        color: [1, 0.75, 0.85],
        show: { cone: true, innerCone: true, rays: 6, length: 5.5 },
      }),
    );

    this.label("directional", this.#directional, { offset: [0, 0.6, 0], color: [1, 0.93, 0.75] });
    this.label("point", this.#point, { offset: [0, 1.1, 0], color: [0.6, 0.85, 1] });
    this.label("spot", this.#spot, { offset: [0, 0.6, 0], color: [1, 0.75, 0.85] });

    // Something for each light to fall on.
    for (const x of [-6, 0, 6]) {
      this.scene.add(
        new MeshNode({
          shape: "plane",
          wireframe: false,
          position: [x, 0.01, 0],
          rotation: [-90, 0, 0],
          scale: 5,
          color: [0.72, 0.72, 0.76],
        }),
      );
      this.scene.add(
        new MeshNode({
          shape: "sphere",
          wireframe: false,
          position: [x, 0.6, 0],
          scale: 1.2,
          color: [0.85, 0.85, 0.88],
        }),
      );
      this.scene.add(
        new MeshNode({
          shape: "box",
          wireframe: false,
          position: [x - 1.4, 0.4, 1.2],
          scale: 0.8,
          color: [0.8, 0.8, 0.84],
        }),
      );
    }
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Directional",
        type: "boolean",
        initial: true,
        update: (value: boolean) => (this.#directional.visible = value),
      },
      {
        title: "Point",
        type: "boolean",
        initial: true,
        update: (value: boolean) => (this.#point.visible = value),
      },
      {
        title: "Spot",
        type: "boolean",
        initial: true,
        update: (value: boolean) => (this.#spot.visible = value),
      },
      {
        title: "Sun direction",
        type: "number",
        min: -80,
        max: 80,
        step: 1,
        initial: 20,
        update: (value: number) => {
          const a = (value * Math.PI) / 180;
          this.#directional.setDirection([Math.sin(a), -1, -Math.cos(a) * 0.4]);
        },
      },
      {
        title: "Point height",
        type: "number",
        min: 0.5,
        max: 8,
        step: 0.1,
        initial: 3.2,
        update: (value: number) => (this.#point.transform.position[1] = value),
      },
      {
        title: "Point range",
        type: "number",
        min: 1,
        max: 20,
        step: 0.5,
        initial: 7,
        update: (value: number) => (this.#point.range = value),
      },
      {
        title: "Spot angle",
        type: "number",
        min: 5,
        max: 60,
        step: 1,
        initial: 26,
        update: (value: number) => (this.#spot.angle = value),
      },
      {
        title: "Spot softness",
        type: "number",
        min: 0,
        max: 30,
        step: 1,
        initial: 10,
        update: (value: number) => (this.#spot.penumbra = value),
      },
    ];
  }
}
