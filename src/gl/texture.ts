export async function loadTexture(gl: WebGL2RenderingContext, url: string) {
  const image = new Image();
  const textureLoaded = new Promise<WebGLTexture>((resolve, reject) => {
    image.onload = function () {
      try {
        const texture = gl.createTexture();
        if(!texture) {
          reject(new Error("Failed to create texture"));
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);

        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;

        gl.texImage2D(
          gl.TEXTURE_2D,
          level,
          internalFormat,
          srcFormat,
          srcType,
          image,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );

        resolve(texture);
      } catch (e) {
        reject(e);
      }
    };
    image.onerror = function () {
      reject(new Error(`Failed to load texture from ${url}`));
    };
  });

  image.src = url;
  return textureLoaded;
}
