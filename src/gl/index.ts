import { GLContext } from "./context";
import { GLSLProgram } from "./program";

type ParameterDescriptor = {
  title: string;
  description?: string;
  type: 'number' | 'color' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  initial?: number | boolean | [number, number, number];
  update: (value: any) => void;
}

interface GLScene {
  init: (ctx: GLContext) => Promise<void>;
  renderFrame: (ctx: GLContext, dt: number, time: number) => void | PromiseLike<void>;

  params?: ParameterDescriptor[];
}

export {
  GLContext,
  GLSLProgram,
  type GLScene,
  type ParameterDescriptor,
}