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

/**
 * The address bar decides which scene is showing, so a demo can be linked to
 * directly. A playground appends its viewpoint after a "?", which makes it
 * possible to link to a particular view of a particular scene.
 *
 *   #viz-view-frustum?view=7.3,6.9,10.4,0,1,0
 */
function sceneIdFromUrl() {
  return decodeURIComponent(location.hash.replace(/^#/, "").split("?")[0]);
}

function showScene(sceneId: string) {
  if (!sceneId || sceneId === currentSceneId) return;
  currentSceneId = sceneId;
  document.querySelector("scene-view")?.setAttribute("scene", sceneId);
}

document.querySelector("nav")?.addEventListener("click", (e) => {
  const sceneId = (e.target as HTMLElement).dataset?.["scene"];
  if (!sceneId) return;

  // Dropping any old "?view=" is deliberate: the saved viewpoint belongs to
  // the scene it was saved from.
  if (sceneIdFromUrl() === sceneId) showScene(sceneId);
  else location.hash = `#${sceneId}`;
});

window.addEventListener("hashchange", () => showScene(sceneIdFromUrl()));
showScene(sceneIdFromUrl());
