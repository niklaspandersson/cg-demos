import { vec3 } from "gl-matrix";
import type { Node } from "../core/node";
import type { Viewer } from "./viewer";
import type { Vec3Like } from "../types";

export type ControlsMode = "orbit" | "fly";

export type ViewerControlsOptions = {
  mode?: ControlsMode;
  /** Seconds to cover most of the distance to where the camera is heading. */
  smoothing?: number;
  /** Units per second while flying. */
  flySpeed?: number;
  /** Degrees of rotation per pixel dragged. */
  rotateSpeed?: number;
  zoomSpeed?: number;
};

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MAX_ELEVATION = 89;

type Pose = {
  target: vec3;
  azimuth: number;
  elevation: number;
  distance: number;
};

const pose = (): Pose => ({ target: vec3.create(), azimuth: 0, elevation: 0, distance: 10 });

const copyPose = (to: Pose, from: Pose) => {
  vec3.copy(to.target, from.target);
  to.azimuth = from.azimuth;
  to.elevation = from.elevation;
  to.distance = from.distance;
};

/**
 * Where the camera is, described as a point it is interested in plus a
 * direction and a distance from it. Position is derived from those.
 *
 * Both ways of moving around use exactly the same numbers, and differ only in
 * which end is nailed down:
 *
 *   orbit - the target stays put and the camera swings around it
 *   fly   - the camera stays put and the target swings around it
 *
 * That is why switching modes never makes the view jump, and why the two
 * modes share one set of mouse handlers.
 */
function offsetFromAngles(p: Pose, out: vec3) {
  const a = p.azimuth * DEG_TO_RAD;
  const e = p.elevation * DEG_TO_RAD;
  return vec3.set(
    out,
    p.distance * Math.cos(e) * Math.sin(a),
    p.distance * Math.sin(e),
    p.distance * Math.cos(e) * Math.cos(a),
  );
}

/**
 * Mouse and keyboard control of the `Viewer`.
 *
 *   left drag           orbit, or look around in fly mode
 *   right/middle drag   pan
 *   wheel               move closer or further away (fly speed in fly mode)
 *   W A S D / Q E       fly, hold shift to go faster
 *   F                   switch between orbit and fly
 *   R                   back to the starting view
 *
 * Everything is damped: the camera eases towards where you told it to go
 * rather than snapping, which reads far better on a projector.
 */
export class ViewerControls {
  mode: ControlsMode;
  smoothing: number;
  flySpeed: number;
  rotateSpeed: number;
  zoomSpeed: number;

  enabled = true;

  #viewer: Viewer;
  #canvas: HTMLCanvasElement | null = null;

  /** Where the camera has been told to go. */
  #wanted = pose();
  /** Where it actually is, easing towards `#wanted`. */
  #current = pose();
  /** The view `reset()` returns to. */
  #home = pose();

  #drag: { pointerId: number; button: number; x: number; y: number } | null = null;
  #keys = new Set<string>();

  #scratch = vec3.create();
  #right = vec3.create();
  #forward = vec3.create();

  constructor(viewer: Viewer, options: ViewerControlsOptions = {}) {
    this.#viewer = viewer;
    this.mode = options.mode ?? "orbit";
    this.smoothing = options.smoothing ?? 0.09;
    this.flySpeed = options.flySpeed ?? 6;
    this.rotateSpeed = options.rotateSpeed ?? 0.3;
    this.zoomSpeed = options.zoomSpeed ?? 0.0015;

    this.syncFromViewer();
    this.saveHome();
  }

  /** Read the viewer's current pose. Call it after moving the viewer by hand. */
  syncFromViewer() {
    const viewer = this.#viewer;
    const d = vec3.subtract(this.#scratch, viewer.position, viewer.target);
    const distance = Math.max(vec3.length(d), 1e-4);

    vec3.copy(this.#wanted.target, viewer.target);
    this.#wanted.distance = distance;
    this.#wanted.elevation = Math.asin(d[1] / distance) * RAD_TO_DEG;
    this.#wanted.azimuth = Math.atan2(d[0], d[2]) * RAD_TO_DEG;

    copyPose(this.#current, this.#wanted);
    return this;
  }

  /** Remember the current view as the one `reset()` goes back to. */
  saveHome() {
    copyPose(this.#home, this.#wanted);
    return this;
  }

  reset() {
    copyPose(this.#wanted, this.#home);
    return this;
  }

  /**
   * Orbit a particular thing: move the point of interest onto it and back off
   * far enough to see it. The damping turns this into a smooth flight.
   */
  focus(subject: Node | Vec3Like, options: { distance?: number } = {}) {
    if (Array.isArray(subject) || subject instanceof Float32Array) {
      vec3.copy(this.#wanted.target, subject as Vec3Like);
      if (options.distance !== undefined) this.#wanted.distance = options.distance;
      return this;
    }

    const node = subject as Node;
    node.worldPosition(this.#wanted.target);

    const radius = Math.max(node.focusRadius(), 0.2);
    const halfFov = (this.#viewer.fov / 2) * DEG_TO_RAD;
    this.#wanted.distance = options.distance ?? (radius / Math.tan(halfFov)) * 1.8;
    return this;
  }

  attach(canvas: HTMLCanvasElement) {
    this.detach();
    this.#canvas = canvas;

    // The canvas has to be focusable for the keyboard to reach it. Listening
    // on the canvas instead of the window keeps WASD from hijacking the page.
    if (canvas.tabIndex < 0) canvas.tabIndex = 0;

    canvas.addEventListener("pointerdown", this.#onPointerDown);
    canvas.addEventListener("pointermove", this.#onPointerMove);
    canvas.addEventListener("pointerup", this.#onPointerUp);
    canvas.addEventListener("pointercancel", this.#onPointerUp);
    canvas.addEventListener("wheel", this.#onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.#onContextMenu);
    canvas.addEventListener("keydown", this.#onKeyDown);
    canvas.addEventListener("keyup", this.#onKeyUp);
    canvas.addEventListener("blur", this.#onBlur);
    return this;
  }

  detach() {
    const canvas = this.#canvas;
    if (!canvas) return this;

    canvas.removeEventListener("pointerdown", this.#onPointerDown);
    canvas.removeEventListener("pointermove", this.#onPointerMove);
    canvas.removeEventListener("pointerup", this.#onPointerUp);
    canvas.removeEventListener("pointercancel", this.#onPointerUp);
    canvas.removeEventListener("wheel", this.#onWheel);
    canvas.removeEventListener("contextmenu", this.#onContextMenu);
    canvas.removeEventListener("keydown", this.#onKeyDown);
    canvas.removeEventListener("keyup", this.#onKeyUp);
    canvas.removeEventListener("blur", this.#onBlur);

    this.#canvas = null;
    this.#drag = null;
    this.#keys.clear();
    return this;
  }

  dispose() {
    this.detach();
  }

  /** Advance the damping and write the result into the viewer. */
  update(dt: number) {
    if (this.mode === "fly") this.#applyKeyboard(dt);

    // Exponential smoothing: a fixed fraction of the remaining distance per
    // second, so the result does not depend on the frame rate.
    const k = this.smoothing > 0 ? 1 - Math.exp(-dt / this.smoothing) : 1;
    const current = this.#current;
    const wanted = this.#wanted;

    vec3.lerp(current.target, current.target, wanted.target, k);
    current.azimuth += (wanted.azimuth - current.azimuth) * k;
    current.elevation += (wanted.elevation - current.elevation) * k;
    current.distance += (wanted.distance - current.distance) * k;

    const viewer = this.#viewer;
    vec3.copy(viewer.target, current.target);
    vec3.add(viewer.position, current.target, offsetFromAngles(current, this.#scratch));
  }

  #applyKeyboard(dt: number) {
    const keys = this.#keys;
    if (keys.size === 0) return;

    const speed = this.flySpeed * (keys.has("shift") ? 3 : 1) * dt;

    // -offset points from the camera towards its target, which is "forward".
    offsetFromAngles(this.#wanted, this.#forward);
    vec3.normalize(this.#forward, this.#forward);
    vec3.scale(this.#forward, this.#forward, -1);
    vec3.normalize(this.#right, vec3.cross(this.#right, this.#forward, this.#viewer.up));

    const move = vec3.set(this.#scratch, 0, 0, 0);
    if (keys.has("w")) vec3.scaleAndAdd(move, move, this.#forward, 1);
    if (keys.has("s")) vec3.scaleAndAdd(move, move, this.#forward, -1);
    if (keys.has("d")) vec3.scaleAndAdd(move, move, this.#right, 1);
    if (keys.has("a")) vec3.scaleAndAdd(move, move, this.#right, -1);
    if (keys.has("e")) vec3.scaleAndAdd(move, move, this.#viewer.up, 1);
    if (keys.has("q")) vec3.scaleAndAdd(move, move, this.#viewer.up, -1);

    if (vec3.squaredLength(move) > 0) {
      vec3.normalize(move, move);
      // Moving the target drags the camera along, because the position is
      // derived from it.
      vec3.scaleAndAdd(this.#wanted.target, this.#wanted.target, move, speed);
    }
  }

  #rotate(dx: number, dy: number) {
    const wanted = this.#wanted;

    // In fly mode the camera must not move, so the target is re-derived from
    // the position after the angles change.
    const pinned = this.mode === "fly" ? vec3.add(vec3.create(), wanted.target, offsetFromAngles(wanted, this.#scratch)) : null;

    wanted.azimuth -= dx * this.rotateSpeed;
    wanted.elevation = Math.min(
      MAX_ELEVATION,
      Math.max(-MAX_ELEVATION, wanted.elevation + dy * this.rotateSpeed),
    );

    if (pinned) vec3.subtract(wanted.target, pinned, offsetFromAngles(wanted, this.#scratch));
  }

  #pan(dx: number, dy: number) {
    const wanted = this.#wanted;
    offsetFromAngles(wanted, this.#forward);
    vec3.normalize(this.#forward, this.#forward);
    vec3.scale(this.#forward, this.#forward, -1);
    vec3.normalize(this.#right, vec3.cross(this.#right, this.#forward, this.#viewer.up));

    const up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.#right, this.#forward));

    // Scale with distance so a drag moves the same amount on screen whether
    // you are close up or far away.
    const scale = wanted.distance * 0.002;
    vec3.scaleAndAdd(wanted.target, wanted.target, this.#right, -dx * scale);
    vec3.scaleAndAdd(wanted.target, wanted.target, up, dy * scale);
  }

  #onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    this.#canvas?.focus();
    if (this.#drag) return;

    this.#drag = { pointerId: e.pointerId, button: e.button, x: e.clientX, y: e.clientY };
    this.#canvas?.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  #onPointerMove = (e: PointerEvent) => {
    const drag = this.#drag;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;

    if (drag.button === 0) this.#rotate(dx, dy);
    else this.#pan(dx, dy);

    e.preventDefault();
  };

  #onPointerUp = (e: PointerEvent) => {
    if (this.#drag?.pointerId !== e.pointerId) return;
    this.#canvas?.releasePointerCapture(e.pointerId);
    this.#drag = null;
  };

  #onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();

    if (this.mode === "fly") {
      this.flySpeed = Math.min(60, Math.max(0.5, this.flySpeed * Math.exp(-e.deltaY * this.zoomSpeed)));
      return;
    }

    const wanted = this.#wanted;
    wanted.distance = Math.min(
      1000,
      Math.max(0.2, wanted.distance * Math.exp(e.deltaY * this.zoomSpeed)),
    );
  };

  #onContextMenu = (e: Event) => e.preventDefault();

  #onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;

    const key = e.key.toLowerCase();
    if (key === "f") {
      this.mode = this.mode === "orbit" ? "fly" : "orbit";
      return;
    }
    if (key === "r") {
      this.reset();
      return;
    }

    if ("wasdqe".includes(key) || key === "shift") {
      this.#keys.add(key);
      e.preventDefault();
    }
  };

  #onKeyUp = (e: KeyboardEvent) => {
    this.#keys.delete(e.key.toLowerCase());
  };

  #onBlur = () => this.#keys.clear();
}
