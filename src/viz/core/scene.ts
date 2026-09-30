import { Node } from "./node";

/**
 * The root of everything being illustrated.
 *
 * Note what is *not* here: the camera you look through. That is the `Viewer`,
 * and it deliberately lives outside the scene, because it is not part of what
 * the illustration is about. A camera inside the scene is a `SceneCamera`.
 */
export class VizScene extends Node {
  constructor() {
    super({ name: "scene" });
  }

  update() {
    this.updateWorldMatrix();
  }
}
