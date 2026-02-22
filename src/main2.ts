import "./elements/sceneview.ts";

const sceneView: any = document.querySelector("scene-view");
sceneView?.setAttribute("scene", "visualization");

document.querySelector("nav")?.addEventListener("click", (e) => {
  const sceneId = (e.target as HTMLElement).dataset?.["scene"];
  if (sceneId) {
    document.querySelector("scene-view")?.setAttribute("scene", sceneId);
  }
});
