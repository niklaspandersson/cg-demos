import './elements/sceneview.ts'
import { toControl } from './elements/controls.ts'
import { GLScene } from './gl/index.ts';

const sceneView: any = document.querySelector('scene-view')

sceneView?.setAttribute('scene', 'texturing-basics')

sceneView?.addEventListener('scene-loaded', (e: CustomEvent) => {
  const scene: GLScene = e.detail.scene;
  if (scene) {
    const params = scene.params || [];
    document.querySelector('.controls')?.replaceChildren(...params.map(toControl));
  }
});

/** Setup nav */
document.querySelector('nav')?.addEventListener('click', (e) => {
  const sceneId = (e.target as HTMLElement).dataset?.['scene']
  if (sceneId) {
    document.querySelector('scene-view')?.setAttribute('scene', sceneId)
  }
});