import { TriangleMesh, type Triangle, type UV, type Vertex } from "../../viz";

/**
 * The windmill, written out by hand.
 *
 * This file is lesson material rather than library code: it is the answer to
 * "where does a 3D object actually come from?". Every shape here is a list of
 * points and a list of faces, short enough to read out loud. Nothing is
 * generated, nothing is loaded, and no modelling tool was involved.
 *
 * Faces are given as quads and split into triangles below, because quads are
 * what you would say out loud ("the front of the tower is these four corners")
 * and triangles are what the hardware draws. The splitting is four lines long,
 * which is a fair price for data that reads like a description of the object.
 */

/** Four corner indices, listed counter-clockwise seen from outside. */
type Quad = readonly [number, number, number, number];

/**
 * Turn quads into triangles, with texture coordinates for each corner.
 *
 * The winding - the order the corners are listed in - is what decides which
 * side of a face is the front. Keep every quad counter-clockwise seen from
 * outside and the normals all point out, back face culling throws away exactly
 * the faces you cannot see, and the lighting works. List one of them backwards
 * and that one face turns inside out, which is worth doing on purpose once.
 */
function fromQuads(name: string, vertices: readonly Vertex[], quads: readonly Quad[]) {
  const triangles: Triangle[] = [];
  const uvs: [UV, UV, UV][] = [];

  for (const [a, b, c, d] of quads) {
    // a is the bottom left corner of the face, and the rest follow round it,
    // so the image lands on the face the same way up every time.
    triangles.push([a, b, c], [a, c, d]);
    uvs.push([[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [0, 1]]);
  }

  return new TriangleMesh({ name, vertices, triangles, uvs });
}

/**
 * The mill's body: a box with a smaller top than bottom, standing on the
 * ground with its base at y = 0.
 *
 * Eight points and twelve triangles. That is the whole shape - and the number
 * to remember, because every later step still works on these same eight points.
 */
export function towerMesh() {
  const base = 0.75;
  const top = 0.58;
  const height = 2.2;

  const vertices: Vertex[] = [
    [-base, 0, -base], // 0  back left, on the ground
    [base, 0, -base],  // 1  back right
    [base, 0, base],   // 2  front right
    [-base, 0, base],  // 3  front left
    [-top, height, -top], // 4  back left, at the eaves
    [top, height, -top],  // 5  back right
    [top, height, top],   // 6  front right
    [-top, height, top],  // 7  front left
  ];

  // Front first, then round the sides, then the lid and the floor: the order
  // the faces appear in when a slider reveals them one at a time.
  const quads: Quad[] = [
    [3, 2, 6, 7], // front  (+z)
    [2, 1, 5, 6], // right  (+x)
    [1, 0, 4, 5], // back   (-z)
    [0, 3, 7, 4], // left   (-x)
    [4, 7, 6, 5], // top    (+y), hidden once the roof is on
    [0, 1, 2, 3], // bottom (-y)
  ];

  return fromQuads("tower", vertices, quads);
}

/**
 * The roof: four triangles meeting at a point, plus a square underneath.
 *
 * Built around its own origin with the base at y = 0, like every other part.
 * It has no idea it belongs on top of a tower - putting it there is the job of
 * a transformation, which is the next step.
 */
export function roofMesh() {
  const eave = 0.85;
  const height = 1.0;

  const vertices: Vertex[] = [
    [-eave, 0, -eave], // 0
    [eave, 0, -eave],  // 1
    [eave, 0, eave],   // 2
    [-eave, 0, eave],  // 3
    [0, height, 0],    // 4  the ridge point
  ];

  // The four sloping sides are triangles already, so they are listed directly
  // rather than squeezed into the quad helper.
  const triangles: Triangle[] = [
    [3, 2, 4], // facing +z
    [2, 1, 4], // facing +x
    [1, 0, 4], // facing -z
    [0, 3, 4], // facing -x
    [0, 1, 2], // the square underneath, facing down
    [0, 2, 3],
  ];

  const slope: [UV, UV, UV] = [[0, 0], [1, 0], [0.5, 1]];
  const uvs: [UV, UV, UV][] = [
    slope,
    slope,
    slope,
    slope,
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 1], [0, 1]],
  ];

  return new TriangleMesh({ name: "roof", vertices, triangles, uvs });
}

/** A box, for the axle the sails turn on. */
export function hubMesh() {
  const r = 0.16;
  const front = 0.22;
  const back = -0.1;

  const vertices: Vertex[] = [
    [-r, -r, back], [r, -r, back], [r, r, back], [-r, r, back],
    [-r, -r, front], [r, -r, front], [r, r, front], [-r, r, front],
  ];

  const quads: Quad[] = [
    [4, 5, 6, 7], // front
    [5, 1, 2, 6], // right
    [1, 0, 3, 2], // back
    [0, 4, 7, 3], // left
    [7, 6, 2, 3], // top
    [0, 1, 5, 4], // bottom
  ];

  return fromQuads("hub", vertices, quads);
}

/**
 * One sail: a thin slab reaching out from the axle along +x.
 *
 * All four sails share this one mesh. Four objects, one set of vertices, four
 * different transforms - which is the point of separating the two.
 */
export function bladeMesh() {
  const near = 0.12;
  const far = 1.55;
  const halfWidth = 0.17;
  const halfThickness = 0.035;

  const vertices: Vertex[] = [
    [near, -halfWidth, -halfThickness], // 0
    [far, -halfWidth, -halfThickness],  // 1
    [far, halfWidth, -halfThickness],   // 2
    [near, halfWidth, -halfThickness],  // 3
    [near, -halfWidth, halfThickness],  // 4
    [far, -halfWidth, halfThickness],   // 5
    [far, halfWidth, halfThickness],    // 6
    [near, halfWidth, halfThickness],   // 7
  ];

  const quads: Quad[] = [
    [4, 5, 6, 7], // front
    [5, 1, 2, 6], // outer end
    [1, 0, 3, 2], // back
    [0, 4, 7, 3], // inner end
    [7, 6, 2, 3], // top
    [0, 1, 5, 4], // bottom
  ];

  return fromQuads("blade", vertices, quads);
}

/**
 * The ground: one square, two triangles, lying in the xz plane.
 *
 * Its texture coordinates run 0..1 across the whole square, so the only way to
 * get grass rather than one enormous blade of grass is to repeat the image -
 * which is what the tiling slider in the last step does.
 */
export function groundMesh(half = 9) {
  const vertices: Vertex[] = [
    [-half, 0, half],  // 0
    [half, 0, half],   // 1
    [half, 0, -half],  // 2
    [-half, 0, -half], // 3
  ];

  const triangles: Triangle[] = [
    [0, 1, 2],
    [0, 2, 3],
  ];

  const uvs: [UV, UV, UV][] = [
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 1], [0, 1]],
  ];

  return new TriangleMesh({ name: "ground", vertices, triangles, uvs });
}
