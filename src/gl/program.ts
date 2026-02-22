export type BuildProps = {
  url?: string;
  vs?: string;
  fs?: string;
};

export type VertexAttribute = "aPosition" | "aNormal" | "aColor" | "aTexCoord";

const STANDARD_ATTRIB_LOCATIONS: Record<string, number> = {
  aPosition: 0,
  aNormal: 1,
  aColor: 2,
  aTexCoord: 3,
};

export type RebuildResult = {
  success: boolean;
  errors: string[];
};

export class GLSLProgram {
  #gl: WebGL2RenderingContext;
  #program: WebGLProgram;

  #vertexShaderSource = "";
  get vertexShaderSource() {
    return this.#vertexShaderSource;
  }

  #fragmentShaderSource = "";
  get fragmentShaderSource() {
    return this.#fragmentShaderSource;
  }

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    let program = gl.createProgram();
    if (!program) throw new Error("Failed to create webgl2 shader program");

    this.#program = program;
  }

  #_proxy: Record<string, any> | null = null;
  get #uniforms() {
    this.#_proxy ??= new Proxy(this, {
      get(target, p) {
        if (typeof p !== "string") throw new Error("invalid property name");
        return target.getUniformLocation(p);
      },

      set(target, p, newValue) {
        if (typeof p === "string") {
          const loc = target.getUniformLocation(p);
          if (!loc) return false;
          if (newValue instanceof Array || newValue instanceof Float32Array) {
            switch (newValue.length) {
              case 1:
                target.#gl.uniform1fv(loc, newValue);
                break;
              case 2:
                target.#gl.uniform2fv(loc, newValue);
                break;
              case 3:
                target.#gl.uniform3fv(loc, newValue);
                break;
              case 4:
                target.#gl.uniform4fv(loc, newValue);
                break;
              case 9:
                target.#gl.uniformMatrix3fv(loc, false, newValue);
                break;
              case 16:
                target.#gl.uniformMatrix4fv(loc, false, newValue);
                break;
              default:
                throw new Error("invalid array length");
            }
          } else if (typeof newValue === "number") {
            target.#gl.uniform1f(loc, newValue);
          }
        }
        return true;
      },
    });

    return this.#_proxy;
  }

  use() {
    this.#gl.useProgram(this.#program);
    return this.#uniforms;
  }

  async build({ url, vs, fs }: BuildProps = {}) {
    const gl = this.#gl;

    if (vs && fs) {
      this.#vertexShaderSource = vs;
      this.#fragmentShaderSource = fs;
    } else {
      url ??= "./";
      this.#vertexShaderSource = await this.#fetchShaderSource(
        url + "/vs.glsl",
      );
      this.#fragmentShaderSource = await this.#fetchShaderSource(
        url + "/fs.glsl",
      );
    }

    if (!this.#vertexShaderSource || !this.#fragmentShaderSource)
      throw new Error("invalid parameters. No shader source code provided");

    this.#attachShader(this.#program, gl.VERTEX_SHADER, this.#vertexShaderSource);
    this.#attachShader(this.#program, gl.FRAGMENT_SHADER, this.#fragmentShaderSource);

    this.#bindStandardAttribLocations(this.#program);
    gl.linkProgram(this.#program);
    {
      const message = gl.getProgramInfoLog(this.#program);
      if (message?.length) throw new Error("Failed to link webgl program");
    }
  }

  rebuild({ vs, fs }: { vs?: string; fs?: string } = {}): RebuildResult {
    const gl = this.#gl;
    const newVs = vs ?? this.#vertexShaderSource;
    const newFs = fs ?? this.#fragmentShaderSource;
    const errors: string[] = [];

    const newProgram = gl.createProgram();
    if (!newProgram) return { success: false, errors: ["Failed to create program"] };

    const vsShader = this.#compileShader(gl.VERTEX_SHADER, newVs);
    if (!vsShader.shader) {
      errors.push("Vertex: " + vsShader.error);
    }

    const fsShader = this.#compileShader(gl.FRAGMENT_SHADER, newFs);
    if (!fsShader.shader) {
      errors.push("Fragment: " + fsShader.error);
    }

    if (errors.length) {
      if (vsShader.shader) gl.deleteShader(vsShader.shader);
      if (fsShader.shader) gl.deleteShader(fsShader.shader);
      gl.deleteProgram(newProgram);
      return { success: false, errors };
    }

    gl.attachShader(newProgram, vsShader.shader!);
    gl.attachShader(newProgram, fsShader.shader!);
    this.#bindStandardAttribLocations(newProgram);
    gl.linkProgram(newProgram);

    const linkLog = gl.getProgramInfoLog(newProgram);
    if (linkLog?.length) {
      gl.deleteShader(vsShader.shader!);
      gl.deleteShader(fsShader.shader!);
      gl.deleteProgram(newProgram);
      return { success: false, errors: ["Link: " + linkLog] };
    }

    gl.deleteProgram(this.#program);
    this.#program = newProgram;
    this.#vertexShaderSource = newVs;
    this.#fragmentShaderSource = newFs;

    return { success: true, errors: [] };
  }

  getAttribLocations(names: VertexAttribute[]) {
    return names.reduce(
      (res, name) => {
        res[name] = this.#gl.getAttribLocation(this.#program, name);
        return res;
      },
      {} as Record<VertexAttribute, number>,
    );
  }

  getUniformLocation(name: string) {
    return this.#gl.getUniformLocation(this.#program, name);
  }

  async #fetchShaderSource(url: string) {
    const res = await fetch(url);
    return res.ok ? await res.text() : "";
  }

  #bindStandardAttribLocations(program: WebGLProgram) {
    for (const [name, loc] of Object.entries(STANDARD_ATTRIB_LOCATIONS)) {
      this.#gl.bindAttribLocation(program, loc, name);
    }
  }

  #compileShader(type: GLenum, source: string): { shader: WebGLShader | null; error: string } {
    const shader = this.#gl.createShader(type);
    if (!shader) return { shader: null, error: "Failed to create shader" };

    this.#gl.shaderSource(shader, source);
    this.#gl.compileShader(shader);

    if (!this.#gl.getShaderParameter(shader, this.#gl.COMPILE_STATUS)) {
      const error = this.#gl.getShaderInfoLog(shader) ?? "Unknown compilation error";
      this.#gl.deleteShader(shader);
      return { shader: null, error };
    }

    return { shader, error: "" };
  }

  #attachShader(program: WebGLProgram, type: GLenum, source: string) {
    const { shader, error } = this.#compileShader(type, source);
    if (!shader) throw new Error(error);
    this.#gl.attachShader(program, shader);
  }
}
