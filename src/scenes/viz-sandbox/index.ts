import { MeshNode, Playground, axes, grid } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * Exercises everything the library can currently draw. It is both a smoke
 * test - if this renders, the library works - and the reference for what a
 * demo looks like.
 *
 * Drag to orbit, right-drag to pan, scroll to zoom, F to fly with WASD,
 * R to get back to this starting view.
 */
export default class Scene extends Playground {
  setup() {
    this.viewer.set({ target: [0, 1, 0], fov: 50 });
    this.viewer.setOrbit(35, 25, 14);

    this.scene.add(grid({ size: 12, step: 1 }));
    this.scene.add(axes({ size: 1.5 }));

    // A row of wireframe boxes, the shape most illustrations are built from.
    for (let i = 0; i < 4; i++) {
      this.scene.add(
        new MeshNode({
          name: `box-${i}`,
          shape: "box",
          position: [-3 + i * 2, 0.5, -2],
          scale: 1,
          color: [0.95, 0.75, 0.3],
        }),
      );
    }

    // Solid shapes, to check that the lit surface pass works.
    this.scene.add(
      new MeshNode({
        name: "solid-box",
        shape: "box",
        wireframe: false,
        position: [-2, 0.75, 2],
        scale: 1.5,
        color: [0.4, 0.65, 0.95],
      }),
    );

    this.scene.add(
      new MeshNode({
        name: "solid-sphere",
        shape: "sphere",
        wireframe: false,
        position: [1, 0.75, 2],
        scale: 1.5,
        color: [0.9, 0.45, 0.45],
      }),
    );

    this.scene.add(
      new MeshNode({ name: "wire-sphere", shape: "sphere", position: [3.5, 1, 2], scale: 2 }),
    );

    // A transparent upright plane, to check the blended pass and the sorting.
    this.scene.add(
      new MeshNode({
        name: "glass",
        shape: "plane",
        wireframe: false,
        position: [0, 1.5, -4.5],
        scale: [6, 3, 1],
        color: [0.5, 0.9, 0.8, 0.25],
      }),
    );
    this.scene.add(
      new MeshNode({
        name: "glass-outline",
        shape: "plane",
        position: [0, 1.5, -4.5],
        scale: [6, 3, 1],
        color: [0.5, 0.9, 0.8],
      }),
    );

    // A child node, to check that parent transforms compose.
    const pivot = this.scene.add(
      new MeshNode({ name: "pivot", shape: "box", position: [0, 2.5, 0], rotation: [0, 30, 0] }),
    );
    pivot.add(new MeshNode({ name: "child", shape: "box", position: [1.5, 0, 0], scale: 0.4 }));
    pivot.add(axes({ size: 1 }));
  }

  get params(): ParameterDescriptor[] {
    return [
      {
        title: "Fly mode",
        type: "boolean",
        update: (value: boolean) => {
          this.controls.mode = value ? "fly" : "orbit";
        },
      },
    ];
  }
}
