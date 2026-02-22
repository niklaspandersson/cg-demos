import "./elements/sceneview.ts";
import { toControl } from "./elements/controls.ts";
import { GLScene, GLSLProgram } from "./gl/index.ts";
import hljs from "highlight.js/lib/core";
import glsl from "highlight.js/lib/languages/glsl";
import "highlight.js/styles/github.css";

hljs.registerLanguage("glsl", glsl);

const sceneView: any = document.querySelector("scene-view");
const sourcesDiv = document.querySelector<HTMLDivElement>(".sources");
const sourceCodeDiv = document.querySelector<HTMLDivElement>(".source-code");

// sceneView?.setAttribute('scene', 'texturing-basics')

let currentSources: Record<string, string> = {};

function showSource(source: string) {
  if (!sourceCodeDiv) return;
  sourceCodeDiv.innerHTML = hljs.highlight(source, { language: "glsl" }).value;
}

function displayShaderSources(programs: readonly GLSLProgram[]) {
  if (!sourcesDiv || !sourceCodeDiv) return;

  if (programs.length === 0) {
    sourcesDiv.hidden = true;
    return;
  }

  const program = programs[0];
  currentSources = {
    vertex: program.vertexShaderSource,
    fragment: program.fragmentShaderSource,
  };

  sourcesDiv.hidden = false;

  const tabs = sourcesDiv.querySelectorAll<HTMLLIElement>(".tabs li");
  tabs.forEach((li) => {
    li.classList.toggle("active", li.dataset.shader === "fragment");
  });
  showSource(currentSources.fragment);
}

sourcesDiv?.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLLIElement>(
    "[data-shader]",
  );
  if (!target || !sourceCodeDiv) return;

  const shaderType = target.dataset.shader!;
  if (!currentSources[shaderType]) return;

  sourcesDiv.querySelectorAll<HTMLLIElement>(".tabs li").forEach((li) => {
    li.classList.toggle("active", li === target);
  });
  showSource(currentSources[shaderType]);
});

sceneView?.addEventListener("scene-loaded", (e: CustomEvent) => {
  const scene: GLScene = e.detail.scene;
  const programs: readonly GLSLProgram[] = e.detail.programs ?? [];

  if (scene) {
    const params = scene.params || [];
    document
      .querySelector(".controls")
      ?.replaceChildren(...params.map(toControl));
  }

  displayShaderSources(programs);
});

/** Setup nav */
document.querySelector("nav")?.addEventListener("click", (e) => {
  const sceneId = (e.target as HTMLElement).dataset?.["scene"];
  if (sceneId) {
    document.querySelector("scene-view")?.setAttribute("scene", sceneId);
  }
});
