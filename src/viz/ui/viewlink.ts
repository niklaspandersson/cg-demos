import type { Viewer } from "../camera/viewer";

/**
 * The viewer's pose, kept in the address bar.
 *
 * The point is lecture notes: set up the view you want to talk about, copy
 * the URL, and the link opens on exactly that view of exactly that scene.
 *
 * The hash is `#<scene id>?view=px,py,pz,tx,ty,tz`. The scene id half belongs
 * to the navigation in main.ts; this only ever touches what follows the "?".
 */

const PRECISION = 2;

function splitHash(): { scene: string; view: string | null } {
  const raw = location.hash.replace(/^#/, "");
  const separator = raw.indexOf("?");
  if (separator < 0) return { scene: raw, view: null };

  const view = new URLSearchParams(raw.slice(separator + 1)).get("view");
  return { scene: raw.slice(0, separator), view };
}

/** Apply a viewpoint from the URL, if there is one. Returns whether it applied. */
export function readViewFromUrl(viewer: Viewer): boolean {
  const view = splitHash().view;
  if (!view) return false;

  const numbers = view.split(",").map(Number);
  if (numbers.length !== 6 || numbers.some((n) => !Number.isFinite(n))) return false;

  viewer.set({
    position: [numbers[0], numbers[1], numbers[2]],
    target: [numbers[3], numbers[4], numbers[5]],
  });
  return true;
}

/**
 * Write the viewpoint back, without adding a history entry - the back button
 * should leave the demo, not step through every frame of a camera move.
 */
export function writeViewToUrl(viewer: Viewer) {
  const round = (v: number) => Number(v.toFixed(PRECISION));
  const view = [...viewer.position, ...viewer.target].map(round).join(",");

  // Built by hand rather than with URLSearchParams, which would percent-
  // encode the commas and turn a readable link into noise.
  history.replaceState(null, "", `#${splitHash().scene}?view=${view}`);
}

/** True once the viewer has moved far enough to be worth writing again. */
export function viewChanged(viewer: Viewer, last: number[]): boolean {
  const now = [...viewer.position, ...viewer.target];
  return now.some((value, i) => Math.abs(value - (last[i] ?? Infinity)) > 0.01);
}
