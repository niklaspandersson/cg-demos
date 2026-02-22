import "./elements/sceneview.ts";
import "./elements/shader-editor.ts";
import { toControl } from "./elements/controls.ts";
import { GLScene, GLSLProgram } from "./gl/index.ts";
import { ShaderEditor } from "./elements/shader-editor.ts";

const sceneView = document.querySelector("scene-view");
const shaderEditor = document.querySelector<ShaderEditor>("shader-editor");

let currentSceneId = "";

sceneView?.addEventListener("scene-loaded", ((e: CustomEvent) => {
  const scene: GLScene = e.detail.scene;
  const programs: readonly GLSLProgram[] = e.detail.programs ?? [];

  if (scene) {
    const params = scene.params || [];
    document
      .querySelector(".controls")
      ?.replaceChildren(...params.map(toControl));
  }

  if (shaderEditor) {
    if (programs.length > 0) {
      shaderEditor.hidden = false;
      shaderEditor.loadProgram(currentSceneId, programs[0]);
    } else {
      shaderEditor.hidden = true;
    }
  }
}) as EventListener);

/** Setup nav */
document.querySelector("nav")?.addEventListener("click", (e) => {
  const sceneId = (e.target as HTMLElement).dataset?.["scene"];
  if (sceneId) {
    currentSceneId = sceneId;
    document.querySelector("scene-view")?.setAttribute("scene", sceneId);
  }
});
