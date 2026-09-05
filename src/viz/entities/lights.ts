import { vec3 } from "gl-matrix";
import { Node, type NodeOptions } from "../core/node";
import type { Collector, LightInfo } from "../render/collector";
import { arrow, ring } from "../gizmos/helpers";
import type { Color, Vec3Like } from "../types";

const DEG_TO_RAD = Math.PI / 180;

export type LightOptions = NodeOptions & {
  color?: Color;
  /** Scales the light's contribution to shading. */
  intensity?: number;
};

/**
 * Shared behaviour of the three light types.
 *
 * Like a camera, a light points along its own -z axis, so `lookAt` and
 * `setDirection` do the same job here as they do there.
 */
export abstract class Light extends Node {
  color: Color;
  intensity: number;

  constructor(options: LightOptions = {}) {
    super(options);
    this.color = options.color ?? [1, 0.96, 0.88];
    this.intensity = options.intensity ?? 1;
  }

  /** Aim the light. `direction` is the direction the light travels. */
  setDirection(direction: Vec3Like) {
    const target = vec3.add(vec3.create(), this.transform.position, direction);
    this.transform.lookAt(target);
    return this;
  }

  /** The direction the light travels, in world space. */
  worldDirection(out: vec3 = vec3.create()): vec3 {
    const m = this.worldMatrix;
    return vec3.normalize(out, vec3.set(out, -m[8], -m[9], -m[10]));
  }

  protected tinted(): [number, number, number] {
    return [
      this.color[0] * this.intensity,
      this.color[1] * this.intensity,
      this.color[2] * this.intensity,
    ];
  }
}

export type DirectionalLightOptions = LightOptions & {
  /** The direction the light travels. */
  direction?: Vec3Like;
  show?: {
    /** A single arrow along the direction. */
    arrow?: boolean;
    /** A square bundle of parallel rays: this many per side. */
    rays?: number;
    /** Outline the plane the rays start from. */
    plane?: boolean;
    /** How long the rays are. */
    length?: number;
  };
};

/**
 * Light with a direction and no position, like the sun.
 *
 * The gizmo draws a *bundle of parallel rays* rather than rays fanning out
 * from the node's origin, because "a directional light has no position" is
 * the thing this type is for and the thing students most often get wrong.
 * Moving the node only moves the picture; it changes nothing about the light.
 */
export class DirectionalLight extends Light {
  show: NonNullable<DirectionalLightOptions["show"]>;

  constructor(options: DirectionalLightOptions = {}) {
    super({ name: "directional light", ...options });
    this.show = { arrow: true, rays: 3, length: 2.5, ...options.show };
    if (options.direction) this.setDirection(options.direction);
  }

  focusRadius() {
    return (this.show.length ?? 2.5) * 0.8;
  }

  collect(collector: Collector) {
    const info: LightInfo = {
      kind: "directional",
      color: this.tinted(),
      direction: [...this.worldDirection()] as [number, number, number],
    };
    collector.light(info);

    const { lines } = collector;
    const length = this.show.length ?? 2.5;
    const count = this.show.rays ?? 0;

    // Local space, so -z is the direction the light travels.
    if (this.show.arrow) arrow(lines, [0, 0, 0], [0, 0, -length], this.color, length * 0.12);

    if (count > 0) {
      const spread = 0.5;
      const step = count > 1 ? (spread * 2) / (count - 1) : 0;
      const faded: Color = [this.color[0], this.color[1], this.color[2], 0.65];

      for (let i = 0; i < count; i++) {
        for (let j = 0; j < count; j++) {
          const x = count > 1 ? -spread + i * step : 0;
          const y = count > 1 ? -spread + j * step : 0;
          if (this.show.arrow && x === 0 && y === 0) continue;
          arrow(lines, [x, y, 0], [x, y, -length], faded, length * 0.08);
        }
      }

      if (this.show.plane) {
        lines.polyline(
          [
            [-spread, -spread, 0],
            [spread, -spread, 0],
            [spread, spread, 0],
            [-spread, spread, 0],
          ],
          faded,
          true,
        );
      }
    }
  }
}

export type PointLightOptions = LightOptions & {
  /** Distance at which the light has faded to a quarter of its brightness. */
  range?: number;
  show?: {
    /** A small star at the light's position. */
    star?: boolean;
    /** Rays radiating outwards, this many of them. */
    rays?: number;
    /** A ring at the range, showing where the falloff has bitten. */
    falloff?: boolean;
    length?: number;
  };
};

/**
 * Light radiating from a point in every direction, like a bare bulb.
 *
 * Here the position is everything and the orientation means nothing, which is
 * exactly the opposite of a directional light - so the gizmo radiates.
 */
export class PointLight extends Light {
  range: number;
  show: NonNullable<PointLightOptions["show"]>;

  constructor(options: PointLightOptions = {}) {
    super({ name: "point light", ...options });
    this.range = options.range ?? 8;
    this.show = { star: true, rays: 12, length: 0.9, ...options.show };
  }

  focusRadius() {
    return Math.max(1.5, (this.show.length ?? 0.9) * 2);
  }

  collect(collector: Collector) {
    collector.light({
      kind: "point",
      color: this.tinted(),
      position: [...this.worldPosition()] as [number, number, number],
      range: this.range,
    });

    const { lines } = collector;
    const length = this.show.length ?? 0.9;

    if (this.show.star) {
      const s = length * 0.35;
      for (const axis of [0, 1, 2]) {
        const a: [number, number, number] = [0, 0, 0];
        const b: [number, number, number] = [0, 0, 0];
        a[axis] = -s;
        b[axis] = s;
        lines.line(a, b, this.color);
      }
    }

    // Rays spread evenly over the sphere, so the picture does not suggest a
    // preferred direction the light does not have.
    const count = this.show.rays ?? 0;
    const faded: Color = [this.color[0], this.color[1], this.color[2], 0.7];
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * i + 1) / count;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963; // the golden angle, for an even spread
      const direction: [number, number, number] = [
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius,
      ];
      arrow(
        lines,
        [direction[0] * length * 0.4, direction[1] * length * 0.4, direction[2] * length * 0.4],
        [direction[0] * length, direction[1] * length, direction[2] * length],
        faded,
        length * 0.2,
      );
    }

    if (this.show.falloff) {
      const dim: Color = [this.color[0], this.color[1], this.color[2], 0.3];
      for (const axis of [0, 1, 2]) {
        const points = ring([0, 0, 0], this.range, 48).map((p) => {
          const v: [number, number, number] = [p[0], p[1], p[2]];
          if (axis === 0) return [0, v[0], v[1]] as [number, number, number];
          if (axis === 1) return [v[0], 0, v[1]] as [number, number, number];
          return v;
        });
        lines.polyline(points, dim, true);
      }
    }
  }
}

export type SpotLightOptions = LightOptions & {
  /** Half-angle of the cone, in degrees. */
  angle?: number;
  /** How many degrees of soft edge inside that angle. */
  penumbra?: number;
  range?: number;
  /** The direction the light travels. Alternative to `lookAt`. */
  direction?: Vec3Like;
  show?: {
    cone?: boolean;
    /** The bright core, inside the penumbra. */
    innerCone?: boolean;
    rays?: number;
    length?: number;
  };
};

/**
 * A cone of light: a point light with a direction and a limit on how far off
 * that direction it will go. Both of the other two types are visible in it,
 * which is why it makes a good third example.
 */
export class SpotLight extends Light {
  angle: number;
  penumbra: number;
  range: number;
  show: NonNullable<SpotLightOptions["show"]>;

  constructor(options: SpotLightOptions = {}) {
    super({ name: "spot light", ...options });
    this.angle = options.angle ?? 25;
    this.penumbra = options.penumbra ?? 8;
    this.range = options.range ?? 10;
    this.show = { cone: true, innerCone: true, rays: 6, length: 4, ...options.show };
    if (options.direction) this.setDirection(options.direction);
  }

  focusRadius() {
    return (this.show.length ?? 4) * 0.7;
  }

  collect(collector: Collector) {
    const outer = Math.cos(this.angle * DEG_TO_RAD);
    const inner = Math.cos(Math.max(0, this.angle - this.penumbra) * DEG_TO_RAD);

    collector.light({
      kind: "spot",
      color: this.tinted(),
      position: [...this.worldPosition()] as [number, number, number],
      direction: [...this.worldDirection()] as [number, number, number],
      range: this.range,
      cone: [outer, inner],
    });

    const { lines } = collector;
    const length = this.show.length ?? 4;

    if (this.show.cone) this.#cone(collector, this.angle, length, this.color);
    if (this.show.innerCone && this.penumbra > 0) {
      const dim: Color = [this.color[0], this.color[1], this.color[2], 0.45];
      this.#cone(collector, Math.max(0, this.angle - this.penumbra), length, dim);
    }

    const rays = this.show.rays ?? 0;
    if (rays > 0) {
      const faded: Color = [this.color[0], this.color[1], this.color[2], 0.55];
      const radius = Math.tan(this.angle * DEG_TO_RAD) * length;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const r = radius * 0.5;
        arrow(lines, [0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, -length], faded, 0.2);
      }
    }
  }

  #cone(collector: Collector, angle: number, length: number, color: Color) {
    const { lines } = collector;
    const radius = Math.tan(angle * DEG_TO_RAD) * length;

    // The cone opens along -z, so the rim sits at z = -length.
    const rim = ring([0, 0, -length], radius, 48);
    lines.polyline(rim, color, true);
    for (let i = 0; i < 4; i++) {
      lines.line([0, 0, 0], rim[Math.round((i / 4) * rim.length)], color);
    }
  }
}
