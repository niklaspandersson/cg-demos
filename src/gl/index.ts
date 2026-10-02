import { GLContext } from "./context";
import { GLSLProgram, type RebuildResult } from "./program";

type ParameterOption = {
  label: string;
  value: number | string;
};

type ParameterDescriptor = {
  title: string;
  description?: string;
  type: "number" | "color" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  initial?: number | string | boolean | [number, number, number];
  /** The choices, for a "select". */
  options?: ParameterOption[];
  update: (value: any) => void;
};

interface GLScene {
  init: (ctx: GLContext) => Promise<void>;
  renderFrame: (
    ctx: GLContext,
    dt: number,
    time: number,
  ) => void | PromiseLike<void>;

  /**
   * The controls shown beside the scene. Read when the scene loads, and again
   * whenever the scene dispatches a "scene-params" event - a demo whose
   * controls depend on which step it is showing needs the second one.
   */
  params?: ParameterDescriptor[];

  /**
   * How the scene wants its canvas sized.
   *  - "fixed" (default): the canvas keeps its intrinsic 512x512 size.
   *  - "fill": the canvas fills the surrounding panel and follows the device
   *    pixel ratio. Scenes that ask for this must derive their aspect ratio
   *    from the drawing buffer instead of assuming 1:1.
   */
  layout?: "fixed" | "fill";

  /**
   * Called when the scene is replaced by another one. Anything the scene
   * attached to the outside world - event listeners, observers, timers - has
   * to be released here, otherwise it keeps running after the scene is gone.
   */
  dispose?: () => void;
}

export {
  GLContext,
  GLSLProgram,
  type GLScene,
  type ParameterDescriptor,
  type ParameterOption,
  type RebuildResult,
};
