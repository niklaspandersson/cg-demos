import { mat4, vec3 } from "gl-matrix";
import type { Vec3Like } from "../types";

export type ViewerOptions = {
  position?: Vec3Like;
  target?: Vec3Like;
  up?: Vec3Like;
  /** Vertical field of view in degrees. */
  fov?: number;
  near?: number;
  far?: number;
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * The camera you look through.
 *
 * This is *not* part of the scene and is never drawn. It only decides where
 * you are standing while you inspect the illustration. A camera that is part
 * of what is being illustrated - one with a frustum you can see - is a
 * `SceneCamera` instead.
 *
 * The pose is stored as position plus target, because that is what both ways
 * of moving around need: orbiting swings the position about the target, and
 * flying drags both along together.
 */
export class Viewer {
  readonly position = vec3.fromValues(7, 5, 9);
  readonly target = vec3.create();
  readonly up = vec3.fromValues(0, 1, 0);

  fov = 50;
  near = 0.1;
  far = 500;

  constructor(options: ViewerOptions = {}) {
    this.set(options);
  }

  set(options: ViewerOptions) {
    if (options.position) vec3.copy(this.position, options.position);
    if (options.target) vec3.copy(this.target, options.target);
    if (options.up) vec3.copy(this.up, options.up);
    if (options.fov !== undefined) this.fov = options.fov;
    if (options.near !== undefined) this.near = options.near;
    if (options.far !== undefined) this.far = options.far;
    return this;
  }

  /**
   * Place the viewer on a sphere around `target`, which is the natural way to
   * describe a viewpoint when you are looking at something.
   *
   * @param azimuth   degrees around the y axis
   * @param elevation degrees above the ground plane
   */
  setOrbit(azimuth: number, elevation: number, distance: number) {
    const a = azimuth * DEG_TO_RAD;
    const e = elevation * DEG_TO_RAD;

    vec3.set(
      this.position,
      this.target[0] + distance * Math.cos(e) * Math.sin(a),
      this.target[1] + distance * Math.sin(e),
      this.target[2] + distance * Math.cos(e) * Math.cos(a),
    );
    return this;
  }

  get distance() {
    return vec3.distance(this.position, this.target);
  }

  viewMatrix(out: mat4 = mat4.create()) {
    return mat4.lookAt(out, this.position, this.target, this.up);
  }

  projectionMatrix(aspect: number, out: mat4 = mat4.create()) {
    return mat4.perspective(out, this.fov * DEG_TO_RAD, aspect, this.near, this.far);
  }
}
