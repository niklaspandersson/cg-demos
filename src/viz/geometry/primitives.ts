import type { MeshData } from "../render/mesh";

/**
 * Geometry for the shapes a playground needs, as plain numbers.
 *
 * Every shape comes in two forms: a solid `MeshData` for shaded surfaces, and
 * `...Edges()`, a flat list of xyz pairs for the wireframe version. The
 * wireframes are what most illustrations use, because you can see through them.
 *
 * All shapes are built at unit size around the origin, so scaling a node is
 * the only thing needed to resize them.
 */

/** Unit cube, from -0.5 to +0.5 on every axis. */
export function boxMesh(): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Each face gets its own four vertices so the normals stay flat.
  const faces: { normal: [number, number, number]; corners: [number, number, number][] }[] = [
    { normal: [0, 0, 1], corners: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { normal: [0, 0, -1], corners: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { normal: [1, 0, 0], corners: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { normal: [-1, 0, 0], corners: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, 1, 0], corners: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, -1, 0], corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  ];

  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face.corners) {
      positions.push(...corner);
      normals.push(...face.normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return { positions, normals, indices };
}

export function boxEdges(): number[] {
  const c: [number, number, number][] = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const pairs = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // the four connecting edges
  ];

  return pairs.flatMap(([a, b]) => [...c[a], ...c[b]]);
}

/** Unit square in the xy plane, facing +z. Rotate it to lie flat. */
export function planeMesh(): MeshData {
  return {
    positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

export function planeEdges(): number[] {
  const c: [number, number, number][] = [
    [-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0],
  ];
  return [[0, 1], [1, 2], [2, 3], [3, 0]].flatMap(([a, b]) => [...c[a], ...c[b]]);
}

/** Unit sphere (radius 0.5) built from latitude/longitude bands. */
export function sphereMesh(segments = 24, rings = 16): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring++) {
    const phi = (ring / rings) * Math.PI;
    for (let segment = 0; segment <= segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      normals.push(x, y, z);
      positions.push(x * 0.5, y * 0.5, z * 0.5);
    }
  }

  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = ring * stride + segment;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return { positions, normals, indices };
}

/** Three circles, one per axis - enough to read as a sphere in wireframe. */
export function sphereEdges(segments = 32): number[] {
  const edges: number[] = [];
  const radius = 0.5;

  for (const axis of [0, 1, 2]) {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const b = ((i + 1) / segments) * Math.PI * 2;
      edges.push(...circlePoint(axis, a, radius), ...circlePoint(axis, b, radius));
    }
  }

  return edges;
}

function circlePoint(axis: number, angle: number, radius: number): [number, number, number] {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (axis === 0) return [0, x, y];
  if (axis === 1) return [x, 0, y];
  return [x, y, 0];
}

/** A grid of lines in the xz plane, centred on the origin. */
export function gridEdges(size: number, step: number): number[] {
  const edges: number[] = [];
  const half = size / 2;

  for (let offset = -half; offset <= half + 1e-6; offset += step) {
    edges.push(offset, 0, -half, offset, 0, half);
    edges.push(-half, 0, offset, half, 0, offset);
  }

  return edges;
}
