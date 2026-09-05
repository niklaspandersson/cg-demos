import { mat4, vec3, vec4 } from "gl-matrix";
import type { Node } from "../core/node";
import { rgba, type Color, type Vec3Like } from "../types";

/** What a label is attached to: a node, a fixed point, or a moving one. */
export type LabelTarget = Node | Vec3Like | (() => Vec3Like);

export type LabelOptions = {
  color?: Color;
  /** Nudge in world units, to keep the text off the thing it names. */
  offset?: Vec3Like;
};

export type Label = {
  element: HTMLElement;
  target: LabelTarget;
  offset: vec3;
  remove: () => void;
};

const toCss = (color: Color) => {
  const [r, g, b, a] = rgba(color);
  const channel = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${a})`;
};

/**
 * Text drawn over the scene as ordinary HTML.
 *
 * Rendering text in WebGL means a font atlas or signed distance fields, which
 * is a lot of machinery for a handful of words. Absolutely positioned divs
 * are crisp at any resolution, styleable from the stylesheet, and cost
 * nothing on the GPU. The only work per frame is projecting a point.
 */
export class LabelOverlay {
  #root: HTMLElement;
  #labels: Label[] = [];

  #world = vec3.create();
  #clip = vec4.create();

  constructor(container: HTMLElement) {
    this.#root = document.createElement("div");
    this.#root.className = "viz-labels";
    container.appendChild(this.#root);
  }

  add(text: string, target: LabelTarget, options: LabelOptions = {}): Label {
    const element = document.createElement("span");
    element.className = "viz-label";
    element.textContent = text;
    if (options.color) element.style.color = toCss(options.color);
    this.#root.appendChild(element);

    const label: Label = {
      element,
      target,
      offset: options.offset ? vec3.clone(options.offset as vec3) : vec3.create(),
      remove: () => this.remove(label),
    };

    this.#labels.push(label);
    return label;
  }

  remove(label: Label) {
    const index = this.#labels.indexOf(label);
    if (index >= 0) {
      this.#labels.splice(index, 1);
      label.element.remove();
    }
  }

  clear() {
    for (const label of this.#labels) label.element.remove();
    this.#labels.length = 0;
  }

  /** Project every label to where its point lands on screen. */
  update(viewProjection: mat4, cssWidth: number, cssHeight: number) {
    for (const label of this.#labels) {
      this.#resolve(label);

      vec4.set(this.#clip, this.#world[0], this.#world[1], this.#world[2], 1);
      vec4.transformMat4(this.#clip, this.#clip, viewProjection);

      // w is the view-space depth: at or behind the eye there is nothing to
      // project onto, and dividing by it would put the label somewhere absurd.
      const w = this.#clip[3];
      if (w <= 0.0001) {
        label.element.style.display = "none";
        continue;
      }

      const x = this.#clip[0] / w;
      const y = this.#clip[1] / w;
      if (x < -1.2 || x > 1.2 || y < -1.2 || y > 1.2) {
        label.element.style.display = "none";
        continue;
      }

      label.element.style.display = "";
      label.element.style.left = `${(x * 0.5 + 0.5) * cssWidth}px`;
      label.element.style.top = `${(1 - (y * 0.5 + 0.5)) * cssHeight}px`;
    }
  }

  dispose() {
    this.clear();
    this.#root.remove();
  }

  #resolve(label: Label) {
    const target = label.target;

    if (typeof target === "function") vec3.copy(this.#world, target());
    else if (Array.isArray(target) || target instanceof Float32Array)
      vec3.copy(this.#world, target as Vec3Like);
    else (target as Node).worldPosition(this.#world);

    vec3.add(this.#world, this.#world, label.offset);
  }
}
