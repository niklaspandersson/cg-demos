export type BuildProps = {
  url?: string;
  vs?: string,
  fs?: string
};

export type VertexAttribute = "aPosition" | "aNormal" | "aColor" | "aTexCoord";

export class GLSLProgram {
  #gl: WebGL2RenderingContext
  #program: WebGLProgram

  #vertexShaderSource = "";
  get vertexShaderSource() { return this.#vertexShaderSource; }

  #fragmentShaderSource = "";
  get fragmentShaderSource() { return this.#fragmentShaderSource; }

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl
    let program = gl.createProgram()
    if (!program)
      throw new Error('Failed to create webgl2 shader program')

    this.#program = program
  }

  #_proxy: Record<string, any> | null = null;
  get #uniforms() {
    this.#_proxy ??= new Proxy(this, {
      get(target, p) {
        if (typeof p !== 'string')
          throw new Error('invalid property name')
        return target.getUniformLocation(p);
      },

      set(target, p, newValue) {
        if (typeof p === 'string') {
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
                throw new Error('invalid array length');
            }
          }
          else if (typeof newValue === 'number') {
            target.#gl.uniform1f(loc, newValue);
          }
        }
        return true
      },
    });

    return this.#_proxy;
  }

  use() {
    this.#gl.useProgram(this.#program)
    return this.#uniforms;
  }

  async build({ url, vs, fs }: BuildProps = {}) {
    const gl = this.#gl;

    if (vs && fs) {
      this.#vertexShaderSource = vs;
      this.#fragmentShaderSource = fs;
    }
    else {
      url ??= './'
      this.#vertexShaderSource = await this.#fetchShaderSource(url + "/vs.glsl");
      this.#fragmentShaderSource = await this.#fetchShaderSource(url + "/fs.glsl");
    }

    if (!this.#vertexShaderSource || !this.#fragmentShaderSource)
      throw new Error('invalid parameters. No shader source code provided')

    this.#attachShader(gl.VERTEX_SHADER, this.#vertexShaderSource);
    this.#attachShader(gl.FRAGMENT_SHADER, this.#fragmentShaderSource);

    gl.linkProgram(this.#program)
    {
      const message = gl.getProgramInfoLog(this.#program);
      if (message?.length)
        throw new Error('Failed to link webgl program')
    }
  }

  getAttribLocations(names: VertexAttribute[]) {
    return names.reduce((res, name) => {
      res[name] = this.#gl.getAttribLocation(this.#program, name)
      return res;
    }, {} as Record<VertexAttribute, number>)
  }

  getUniformLocation(name: string) {
    return this.#gl.getUniformLocation(this.#program, name);
  }

  async #fetchShaderSource(url: string) {
    const res = await fetch(url);
    return (res.ok) ? await res.text() : '';
  }

  #attachShader(type: GLenum, source: string) {
    const shader = this.#gl.createShader(type);
    if (!shader)
      throw new Error('Failed to create webgl2 shader')

    this.#gl.shaderSource(shader, source);
    this.#gl.compileShader(shader);
    {
      const message = this.#gl.getShaderInfoLog(shader)
      if (message?.length)
        console.log(message)
    }
    this.#gl.attachShader(this.#program, shader);
  }
}
