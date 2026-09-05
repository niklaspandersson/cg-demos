import type { Node } from "../core/node";
import { rgba, type Color } from "../types";

const HELP = [
  "drag: orbit",
  "right-drag: pan",
  "scroll: zoom",
  "double-click: focus",
  "F: fly (WASD)",
  "R: reset view",
];

/** Nodes that carry a colour can show a swatch in the legend. */
function colorOf(node: Node): Color | null {
  const candidate = (node as unknown as { color?: Color }).color;
  return Array.isArray(candidate) ? candidate : null;
}

const toCss = (color: Color) => {
  const [r, g, b] = rgba(color);
  const channel = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
};

/**
 * A corner panel listing what is in the scene and how to move around it.
 *
 * The legend earns its place twice over: it names the entities using the same
 * colours their gizmos are drawn in, and clicking one flies the viewer to it,
 * which is a more discoverable way to orbit a particular thing than knowing
 * to double-click it.
 */
export class Hud {
  #root: HTMLElement;
  #legend: HTMLElement;
  #onSelect: (node: Node) => void;

  constructor(container: HTMLElement, onSelect: (node: Node) => void) {
    this.#onSelect = onSelect;

    this.#root = document.createElement("div");
    this.#root.className = "viz-hud";

    this.#legend = document.createElement("ul");
    this.#legend.className = "viz-legend";

    const help = document.createElement("p");
    help.className = "viz-help";
    help.textContent = HELP.join("  ·  ");

    this.#root.append(this.#legend, help);
    container.appendChild(this.#root);
  }

  /** Rebuild the legend from the nodes worth naming. */
  setEntries(nodes: readonly Node[]) {
    this.#legend.replaceChildren();

    for (const node of nodes) {
      const item = document.createElement("li");
      const color = colorOf(node);

      if (color) {
        const swatch = document.createElement("span");
        swatch.className = "viz-swatch";
        swatch.style.background = toCss(color);
        item.appendChild(swatch);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = node.name;
      button.addEventListener("click", () => this.#onSelect(node));
      item.appendChild(button);

      this.#legend.appendChild(item);
    }

    this.#root.classList.toggle("is-empty", nodes.length === 0);
  }

  dispose() {
    this.#root.remove();
  }
}
