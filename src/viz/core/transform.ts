import { mat4, quat, vec3 } from "gl-matrix";
import type { Vec3Like } from "../types";

export type TransformOptions = {
  position?: Vec3Like;
  /** Euler angles in DEGREES, so a lecturer can just type `[0, 45, 0]`. */
  rotation?: Vec3Like;
  scale?: Vec3Like | number;
  /** Point the node's -z axis at this position. Overrides `rotation`. */
  lookAt?: Vec3Like;
  /** Which way is up when `lookAt` is used. Defaults to +y. */
  up?: Vec3Like;
};

const UP: Vec3Like = [0, 1, 0];

/**
 * Position, orientation and scale of a node.
 *
 * The fields are plain mutable vectors, so a demo can write
 * `node.transform.position[1] = 2` from a slider. Nothing is cached: the
 * matrix is rebuilt when asked for. At the handful-of-objects scale of these
 * illustrations that is far cheaper than getting cache invalidation wrong.
 */
export class Transform {
  readonly position = vec3.create();
  readonly orientation = quat.create();
  readonly scale = vec3.fromValues(1, 1, 1);

  constructor(options: TransformOptions = {}) {
    if (options.position) vec3.copy(this.position, options.position);
    if (options.rotation) this.setEuler(options.rotation);
    if (options.scale !== undefined) this.setScale(options.scale);
    if (options.lookAt) this.lookAt(options.lookAt, options.up);
  }

  setPosition(position: Vec3Like) {
    vec3.copy(this.position, position);
    return this;
  }

  /** Euler angles in degrees. */
  setEuler(degrees: Vec3Like) {
    quat.fromEuler(this.orientation, degrees[0], degrees[1], degrees[2]);
    return this;
  }

  setScale(scale: Vec3Like | number) {
    if (typeof scale === "number") vec3.set(this.scale, scale, scale, scale);
    else vec3.copy(this.scale, scale);
    return this;
  }

  /**
   * Orient the node so its -z axis points at `target`. -z is "forward" here
   * for the same reason it is for a camera: it is the direction `mat4.lookAt`
   * looks along.
   */
  lookAt(target: Vec3Like, up: Vec3Like = UP) {
    const m = mat4.targetTo(mat4.create(), this.position, target, up);
    mat4.getRotation(this.orientation, m);
    return this;
  }

  localMatrix(out: mat4 = mat4.create()) {
    return mat4.fromRotationTranslationScale(
      out,
      this.orientation,
      this.position,
      this.scale,
    );
  }
}
