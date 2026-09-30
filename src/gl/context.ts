import * as glMath from "gl-matrix";
import { createCube } from "../cube.geo";
import { createPlane } from "../plane.geo";
import { GLSLProgram } from "./program";
import type { BuildProps as GLSLProgramProps } from "./program";
import { loadTexture } from "./texture";

const geometry = {
  createCube,
  createPlane,
};

type CreateProgramProps = Omit<GLSLProgramProps, "gl">;

/** A rectangle on the canvas, in drawing-buffer pixels, origin bottom left. */
export type InsetRect = { x: number; y: number; width: number; height: number };

/**
 * A second, smaller picture drawn on top of the main one - a
 * picture-in-picture. Each frame the scene's `renderFrame` runs once more,
 * confined to `rect`, between `begin` and `end`.
 */
export type Inset = {
  /** Where to draw this frame, or null to skip it. */
  rect(gl: WebGL2RenderingContext): InsetRect | null;
  /** Colour of the frame drawn around the inset. */
  borderColor?: [number, number, number, number];
  /** Width of that frame, in drawing-buffer pixels. */
  borderWidth?: number;
  begin?(): void;
  end?(): void;
};

export class GLContext {
  get linalg() {
    return glMath;
  }

  #context: WebGL2RenderingContext;
  get gl() {
    return this.#context;
  }

  #programs: GLSLProgram[] = [];
  get programs(): readonly GLSLProgram[] {
    return this.#programs;
  }

  get geometry() {
    return geometry;
  }

  #clearColor: [number, number, number, number] = [0, 0, 0, 1];
  /** Background colour used by the render loop. Set it before rendering starts. */
  set clearColor(color: [number, number, number, number]) {
    this.#clearColor = color;
  }

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("webgl2");
    if (!context) throw new Error("Failed to create webgl2 context");

    this.#context = context;
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
  }

  async createProgram(opts: CreateProgramProps) {
    const program = new GLSLProgram(this.#context);
    await program.build(opts);
    this.#programs.push(program);
    return program;
  }

  loadTexture(url: string) {
    return loadTexture(this.gl, url);
  }

  #insets = new Set<Inset>();
  /**
   * Draw the scene a second time into a corner of the canvas. Returns a
   * function that removes the inset again.
   */
  addInset(inset: Inset) {
    this.#insets.add(inset);
    return () => {
      this.#insets.delete(inset);
    };
  }

  #drawInset(
    inset: Inset,
    onFrame: (ctx: GLContext, dt: number, time: number) => void,
    time: number,
  ) {
    const gl = this.#context;
    const rect = inset.rect(gl);
    if (!rect || rect.width < 1 || rect.height < 1) return;

    gl.enable(gl.SCISSOR_TEST);

    // The border is just a slightly larger clear behind the inset.
    const border = inset.borderWidth ?? 0;
    if (border > 0) {
      gl.scissor(rect.x - border, rect.y - border, rect.width + 2 * border, rect.height + 2 * border);
      gl.clearColor(...(inset.borderColor ?? [1, 1, 1, 1]));
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(rect.x, rect.y, rect.width, rect.height);
    gl.clearColor(...this.#clearColor);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    inset.begin?.();
    try {
      // dt is 0: time already moved on in the main pass.
      onFrame(this, 0, time);
    } finally {
      inset.end?.();
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
  }

  #frameRequestId: number | null = null;
  render(onFrame: (ctx: GLContext, dt: number, time: number) => void) {
    const gl = this.#context;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1.0);

    let accTime = 0;
    let lastTime: number | undefined;
    const frameCallback: FrameRequestCallback = (timestamp) => {
      const ts = timestamp / 1000;
      lastTime ??= ts;
      const dt = ts - lastTime;
      accTime += dt;

      // The canvas may be resized at any time, so the viewport is refreshed
      // every frame rather than once at startup.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(...this.#clearColor);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      onFrame(this, dt, accTime);
      for (const inset of this.#insets) this.#drawInset(inset, onFrame, accTime);
      this.#frameRequestId = requestAnimationFrame(frameCallback);
      lastTime = ts;
    };
    this.#frameRequestId = requestAnimationFrame(frameCallback);
  }

  stopRendering() {
    if (this.#frameRequestId) cancelAnimationFrame(this.#frameRequestId);
    this.#frameRequestId = null;
    this.#programs = [];
    this.#insets.clear();
  }
}
