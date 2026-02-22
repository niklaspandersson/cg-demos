export function extractShaderProgramUrl(url: string): string {
  const startIndex = url.indexOf("scenes/");
  const endIndex = url.lastIndexOf("/");
  return url.substring(startIndex, endIndex);
}
