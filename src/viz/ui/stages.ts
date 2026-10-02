import type { ParameterDescriptor } from "../../gl";

export type Stage = {
  /** A few words, shown in the panel and in the picker. */
  title: string;
  /** One or two sentences: what this step is about, in the lecture's words. */
  caption: string;
};

export type StagesOptions = {
  /** Which step to start on. */
  start?: number;
  /** The word used for a step in the panel. */
  noun?: string;
};

/**
 * A demo that is a sequence of steps, with the text that belongs to each one.
 *
 * A lecture does not change subject; it adds to one. The scene stays on screen
 * and the step decides how much of it is built, which is why this is a control
 * over one playground rather than a list of separate demos: the box that was
 * eight points in step one is still the same box when it is lit in step nine.
 *
 * The step is reachable three ways - the arrows in the panel, the left and
 * right keys, and the picker in the controls panel - because one of them is
 * always the wrong one. Arrow keys are no use on a phone, and a lecturer
 * walking a room is not going to hunt for a dropdown.
 */
export class Stages {
  readonly stages: readonly Stage[];

  #index = 0;
  #onChange: (index: number) => void;
  #noun: string;

  #root: HTMLElement;
  #counter: HTMLElement;
  #title: HTMLElement;
  #caption: HTMLElement;
  #back: HTMLButtonElement;
  #forward: HTMLButtonElement;
  #fold: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    stages: readonly Stage[],
    onChange: (index: number) => void,
    options: StagesOptions = {},
  ) {
    this.stages = stages;
    this.#onChange = onChange;
    this.#noun = options.noun ?? "Step";
    this.#index = this.#clamp(options.start ?? 0);

    this.#root = document.createElement("div");
    this.#root.className = "viz-stages";

    const header = document.createElement("header");

    this.#back = this.#button("←", "Previous step", () => this.previous());
    this.#forward = this.#button("→", "Next step", () => this.next());

    this.#counter = document.createElement("span");
    this.#counter.className = "viz-stage-counter";

    this.#title = document.createElement("h4");
    this.#title.className = "viz-stage-title";

    this.#caption = document.createElement("p");
    this.#caption.className = "viz-stage-caption";

    // On a phone the caption would cover most of the scene it is describing,
    // so there it starts folded away and the title alone is left showing.
    this.#fold = this.#button("\u25be", "Hide the description", () => this.toggleCaption());
    this.#fold.classList.add("viz-stage-fold");

    header.append(this.#back, this.#counter, this.#forward, this.#fold);
    this.#root.append(header, this.#title, this.#caption);
    container.appendChild(this.#root);

    if (window.matchMedia("(max-width: 860px)").matches) this.toggleCaption(false);

    document.addEventListener("keydown", this.#onKeyDown);
    this.#refresh();
  }

  get index() {
    return this.#index;
  }

  /** Show or hide the step's description. Without an argument, flips it. */
  toggleCaption(show?: boolean) {
    const open = show ?? this.#root.classList.contains("is-folded");
    this.#root.classList.toggle("is-folded", !open);
    this.#fold.textContent = open ? "\u25be" : "\u25b8";
    this.#fold.setAttribute(
      "aria-label",
      open ? "Hide the description" : "Show the description",
    );
    return this;
  }

  get current(): Stage {
    return this.stages[this.#index];
  }

  /** True once the demo has reached a given step, by title. */
  reached(title: string) {
    const at = this.stages.findIndex((stage) => stage.title === title);
    return at >= 0 && this.#index >= at;
  }

  go(index: number) {
    const next = this.#clamp(index);
    if (next === this.#index) return this;

    this.#index = next;
    this.#refresh();
    this.#onChange(next);
    return this;
  }

  next() {
    return this.go(this.#index + 1);
  }

  previous() {
    return this.go(this.#index - 1);
  }

  /**
   * The step chooser, as a control in the panel beside the sliders. A demo puts
   * this first in its own `params`, and appends whatever the current step needs.
   */
  picker(title = this.#noun): ParameterDescriptor {
    return {
      title,
      type: "select",
      initial: this.#index,
      options: this.stages.map((stage, index) => ({
        label: `${index + 1}. ${stage.title}`,
        value: index,
      })),
      update: (value: number) => this.go(Number(value)),
    };
  }

  dispose() {
    document.removeEventListener("keydown", this.#onKeyDown);
    this.#root.remove();
  }

  #clamp(index: number) {
    return Math.max(0, Math.min(Math.round(index), this.stages.length - 1));
  }

  #refresh() {
    const stage = this.current;
    this.#counter.textContent = `${this.#noun} ${this.#index + 1} of ${this.stages.length}`;
    this.#title.textContent = stage.title;
    this.#caption.textContent = stage.caption;
    this.#back.disabled = this.#index === 0;
    this.#forward.disabled = this.#index === this.stages.length - 1;
  }

  #button(label: string, description: string, onClick: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = description;
    button.setAttribute("aria-label", description);
    button.addEventListener("click", onClick);
    return button;
  }

  #onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

    // A slider and a dropdown both use the arrow keys themselves, so stepping
    // the demo must not take them while one of those has the focus.
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;

    if (e.key === "ArrowRight" || e.key === "PageDown") this.next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") this.previous();
    else return;

    e.preventDefault();
  };
}
