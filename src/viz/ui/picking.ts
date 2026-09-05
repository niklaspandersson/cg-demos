import { mat4, vec3, vec4 } from "gl-matrix";
import type { Node } from "../core/node";

const world = vec3.create();
const clip = vec4.create();

/**
 * Which node is nearest a point on screen.
 *
 * This compares distances to each node's *origin* projected to screen space,
 * rather than casting a ray at its geometry. For scenes with a handful of
 * labelled objects that is indistinguishable from real picking, and it is
 * twenty lines instead of an intersection routine per shape.
 */
export function pickNode(
  nodes: readonly Node[],
  viewProjection: mat4,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  radius = 40,
): Node | null {
  let best: Node | null = null;
  let bestDistance = radius;

  for (const node of nodes) {
    if (!node.visible) continue;

    node.worldPosition(world);
    vec4.set(clip, world[0], world[1], world[2], 1);
    vec4.transformMat4(clip, clip, viewProjection);
    if (clip[3] <= 0.0001) continue;

    const x = (clip[0] / clip[3] / 2 + 0.5) * width;
    const y = (1 - (clip[1] / clip[3] / 2 + 0.5)) * height;
    const distance = Math.hypot(x - screenX, y - screenY);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }

  return best;
}
