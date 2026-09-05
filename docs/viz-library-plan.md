# Plan: `src/viz` — a reusable scene-visualisation library

## 1. Goal

A small library, living in this repository, for building **interactive illustrations of
computer-graphics concepts**: a scene containing cameras, lights, planes and boxes, that you
fly around and inspect, where each entity can draw its own "explanation" — a view frustum, a
near/far plane, a light direction, a set of axes.

It is aimed at first-year students, so two constraints drive every decision below:

* **The library source is teaching material too.** A student who opens `frustum.ts` should be
  able to read it. That rules out a heavy engine and rules out clever abstractions.
* **A demo should be ~30 lines.** Writing a new illustration must be cheap enough that you do
  it during lecture prep, not as a weekend project.

### The two cameras

The single most important naming decision in this plan. The library keeps them apart everywhere
— in type names, in file names, and in the docs:

| Concept | Type | Role |
| --- | --- | --- |
| The camera **you look through** | `Viewer` | Not part of the scene. Belongs to the playground. Driven by mouse/keyboard. Never drawn. |
| A camera **you are looking at** | `SceneCamera` | An ordinary node in the scene, with a position, a projection, and gizmos. It is the *subject* of the illustration. |

A demo may contain zero, one or several `SceneCamera`s. There is always exactly one `Viewer`.

---

## 2. What already exists

The library is designed to slot into the current structure rather than replace it.

* `src/gl/context.ts` — `GLContext`: owns the WebGL2 context, the program list, and the
  `requestAnimationFrame` loop.
* `src/gl/program.ts` — `GLSLProgram`: compile/link, live rebuild, a `Proxy`-based uniform
  setter (`uniforms.uProjectionMatrix = m`), and fixed attribute locations
  (`aPosition`=0, `aNormal`=1, `aColor`=2, `aTexCoord`=3).
* `src/gl/index.ts:15` — the `GLScene` interface: `init(ctx)`, `renderFrame(ctx, dt, time)`,
  optional `params`.
* `src/elements/sceneview.ts` — the `<scene-view>` custom element: dynamically imports
  `src/scenes/<id>/index.ts` when its `scene` attribute changes.
* `src/elements/controls.ts` — turns `params` into sliders/checkboxes/colour pickers.
* `gl-matrix` is already a dependency.

**A visualisation demo will be a normal `GLScene`.** The nav in `index.html`, the controls
panel, the shader editor and the deploy workflow all keep working untouched.

### Why not three.js?

It would give us most of Phase 1–2 for free. It is still the wrong choice here:

* The course is *about* the matrices that three.js hides. `camera.projectionMatrix` as an opaque
  object is exactly the thing students must not be handed.
* It would be the only dependency in the repo an undergraduate cannot read.
* Our needs are narrow: lines, a few flat-shaded solids, and one orbit controller. That is maybe
  1200 lines of our own code, and every one of those lines is potentially lecture material.

Cost of the decision: we write and maintain our own controls, picking and line rendering. That is
accepted, and it is why the phases below are ordered so that a useful subset ships early.

---

## 3. Conventions (write these down once, in `src/viz/CONVENTIONS.md`)

Students get lost on conventions more than on anything else, so the library states them and never
deviates:

* Right-handed, **y up**, −z forward.
* A camera looks down **−z in its own space** (matching `mat4.lookAt`).
* Matrices are `gl-matrix` `mat4`, column-major, applied as `M * v`.
* NDC is `[-1,1]` on all three axes (WebGL/OpenGL, *not* the `[0,1]` depth of D3D/Vulkan/WebGPU).
* Angles in the **public API are degrees**; everything internal is radians. `fov: 45` is what a
  lecturer types.
* Colours are `[r, g, b]` in 0..1, with optional `[r, g, b, a]`.

---

## 4. Architecture

Four layers, bottom to top. Each is independently understandable.

```
src/viz/
  index.ts              public API — the only import a demo needs

  core/
    transform.ts        position / rotation / scale -> local matrix, lookAt()
    node.ts             Node: transform, parent, children, world matrix, visible
    scene.ts            VizScene: root node, add/remove, traverse, find by name
    playground.ts       Playground: implements GLScene; owns scene + viewer + renderer

  render/
    mesh.ts             GpuMesh: VAO + VBO + IBO, draw()
    lines.ts            LineBatch: push(a, b, color) -> one dynamic buffer, one draw call
    renderer.ts         VizRenderer: solid pass, transparent pass, line pass
    programs/
      line.vs/.fs       position + colour
      surface.vs/.fs    position + normal + colour, ambient + lambert, or unlit

  camera/
    viewer.ts           Viewer: the camera you look through (pose + projection)
    controls.ts         ViewerControls: orbit + fly + focus, pointer/keyboard handling

  entities/
    meshnode.ts         MeshNode: a box / plane / sphere, solid or wireframe
    scenecamera.ts      SceneCamera: the camera you look at
    lights.ts           DirectionalLight, PointLight, SpotLight

  gizmos/
    frustum.ts          frustum, near/far planes, image plane — from any projection matrix
    lightgizmos.ts      arrows, ray bundles, spot cone, point-light star
    helpers.ts          axes, grid, wire box, arrow, dashed line, ring

  geometry/
    primitives.ts       box, plane, sphere, cone, cylinder — solid and wire index sets

  ui/
    labels.ts           HTML overlay labels projected to screen space
    hud.ts              legend / entity list / "look through" toggle
```

### 4.1 The central insight: almost everything is lines

Frustums, grids, axes, wire cubes, wire planes, light directions, spot cones, normals, "eye to
target" indicators — all of them are line segments. So the renderer's hot path is a single
`LineBatch`:

```ts
class LineBatch {
  clear(): void;
  line(a: vec3, b: vec3, color: Color): void;
  dashed(a: vec3, b: vec3, color: Color, dash?: number): void;
  polyline(points: vec3[], color: Color, closed?: boolean): void;
  // uploaded once per frame, drawn with a single gl.drawArrays(gl.LINES, ...)
}
```

Every gizmo is then a *pure function* `(node, batch) => void` that pushes world-space segments.
No gizmo owns GPU resources, none needs cleanup, and any of them can be read in isolation. This
is the property that makes the library small.

**Line width caveat.** `gl.lineWidth()` is clamped to 1.0 in every modern browser. Phase 1 ships
1-pixel lines, which is honest and legible. Phase 6 adds an optional thick-line mode (expand each
segment into a screen-space quad in the vertex shader, instanced) behind the *same* `LineBatch`
API, so no demo changes when we turn it on.

### 4.2 Transform and Node

```ts
type TransformOptions = {
  position?: vec3;              // default [0,0,0]
  rotation?: vec3;              // Euler XYZ in DEGREES — students can type these
  scale?: vec3 | number;        // default 1
  lookAt?: vec3;                // convenience: derive rotation from a target point
  up?: vec3;                    // default [0,1,0]
};

class Node {
  name: string;
  transform: Transform;
  visible: boolean;
  readonly children: readonly Node[];
  add<T extends Node>(child: T): T;
  worldMatrix(): mat4;          // cached, invalidated when the transform changes
  worldPosition(): vec3;
}
```

Euler angles in degrees, not quaternions: at this level a student wants to type `rotation: [0, 45, 0]`
and see what happens. Parenting is included from the start because the repo already teaches
transformation hierarchies (`src/scenes/transformation-hierarchies`) and this makes an
illustration for that lecture trivial.

### 4.3 The frustum is derived, never special-cased

This is the pedagogical heart of the library, so it gets one function that handles every case:

```ts
/** The 8 corners of a projection's frustum, in the camera's local space. */
export function frustumCorners(projection: mat4): vec3[] {
  const inv = mat4.invert(mat4.create(), projection);
  return NDC_CORNERS.map(c => {           // (±1, ±1, ±1)
    const p = vec4.transformMat4(vec4.create(), [...c, 1], inv);
    return [p[0] / p[3], p[1] / p[3], p[2] / p[3]];   // the perspective divide, visible
  });
}
```

Consequences, all of them free:

* **Perspective and orthographic frustums use identical code** — one draws a truncated pyramid,
  the other a box, from the same eight lines. Toggling projection type in a demo becomes a
  one-line `params` entry, and the shape morphs. That single interaction explains more than a
  slide.
* Moving the near or far plane just changes `projection`, and the drawing follows.
* An **image plane** at any view depth `d` is the same code: project `(0,0,-d,1)` to get its NDC
  z, then unproject the four NDC corners at that z. Works for both projections.
* The perspective divide, the thing students find hardest, appears literally on line 5.

### 4.4 SceneCamera

```ts
class SceneCamera extends Node {
  fov: number;                  // degrees, perspective
  aspect: number;
  near: number; far: number;
  projectionType: "perspective" | "orthographic";
  orthoHeight: number;          // ortho half-height; width follows from aspect

  projectionMatrix(): mat4;
  viewMatrix(): mat4;           // = inverse(worldMatrix())

  show: {
    body?: boolean;             // small wire "camera" shape so it reads as a camera
    axes?: boolean;             // its local basis — where -z actually points
    frustum?: boolean;
    nearPlane?: boolean;        // filled, semi-transparent
    farPlane?: boolean;
    imagePlane?: number | false;// a plane at this view-space depth
    lookAtLine?: boolean;       // dashed line from eye to target
    up?: boolean;               // the up vector, the other thing lookAt() needs
  };
  color: Color;                 // one colour identifies this camera everywhere
}
```

**Look-through inset.** A `SceneCamera` can be rendered *from*: the renderer already takes a
(view, projection) pair, so drawing the scene a second time into a corner of the canvas with
`gl.viewport` + `gl.scissor` costs about 20 lines. The payoff is large — the student sees the
frustum in the main view and simultaneously what that camera captures, with the two views
sharing highlight colours. This is the feature most likely to make a concept click, so it is
scheduled early (Phase 3) rather than as polish.

### 4.5 Lights

Each light is a `Node` whose gizmo shows the property that matters for its type:

```ts
new DirectionalLight({
  direction: [-1, -2, -0.5],
  color: [1, 0.95, 0.8],
  show: { arrow: true, rays: 5, plane: true },   // a grid of parallel rays: "no position, only direction"
});

new PointLight({
  position: [0, 3, 0],
  show: { star: true, rays: 16, falloff: true }, // rays in all directions; optional falloff rings
});

new SpotLight({
  position: [0, 4, 0], lookAt: [0, 0, 0],
  angle: 30, penumbra: 10,
  show: { cone: true, innerCone: true, rays: 8 },
});
```

The gizmos are chosen to make the *distinction* between light types visible: parallel rays vs.
radiating rays vs. a cone. A `DirectionalLight` deliberately draws its rays as a bundle offset in
space rather than from a point, because "a directional light has no position" is the thing
students get wrong.

Lights also feed the `surface` shader, so the shaded boxes in the scene actually respond to them.
Phase 1 supports one directional + one point light in the shader (enough for illustration); more
would mean a uniform-array design that is not worth the complexity here.

### 4.6 Viewer and controls

```ts
class Viewer {
  position: vec3; target: vec3; up: vec3;
  fov: number; near: number; far: number;
  viewMatrix(): mat4; projectionMatrix(aspect: number): mat4;
}

class ViewerControls {
  mode: "orbit" | "fly";
  focus(node: Node | vec3, opts?: { distance?: number }): void;  // smooth tween
  reset(): void;
  attach(canvas: HTMLCanvasElement): void;
  dispose(): void;                                               // removes every listener
}
```

Input map (documented on-screen via the HUD, because undiscoverable controls are useless in a
lecture):

| Input | Orbit mode | Fly mode |
| --- | --- | --- |
| Left drag | orbit around target | mouse-look |
| Right drag / middle drag | pan | pan |
| Wheel | dolly | change speed |
| `W A S D` | — | move; `Q`/`E` down/up; `Shift` faster |
| `F` | toggle fly mode | toggle back |
| Double-click entity | orbit that entity | orbit that entity |
| `R` | reset view | reset view |

Both modes share one state (position + target); switching modes does not jump the camera. Motion
is damped/smoothed — a camera that snaps looks broken on a projector.

**"Orbit various entities"** is served three ways, cheapest first:
1. `viewer.focus(node)` from code or from a `params` dropdown of entity names.
2. Double-click picking by **screen-space proximity**: project each focusable node's world origin,
   pick the nearest within ~20 px. Roughly 20 lines, no ray/mesh intersection, good enough for
   scenes with a handful of objects.
3. (Optional, later) ray-vs-AABB picking if proximity ever proves too coarse.

### 4.7 Labels

Text matters here — "near", "far", "eye", "L" — and a font atlas is a disproportionate amount of
work. Instead: **HTML `<div>`s positioned over the canvas**, projected each frame with the
viewer's view-projection matrix, hidden when behind the camera. Crisp at any DPI, styleable in
`style.css`, zero GPU work, ~60 lines. Requires `<scene-view>` to wrap the canvas in a
`position: relative` container.

---

## 5. What a demo looks like

The target API. This is the acceptance criterion for the whole plan — if a demo does not read
roughly like this, the design is wrong.

```ts
// src/scenes/viz-view-frustum/index.ts
import { Playground, SceneCamera, MeshNode, DirectionalLight, grid } from "../../viz";

export default class Scene extends Playground {
  #camera!: SceneCamera;

  setup() {
    this.viewer.set({ position: [8, 5, 10], target: [0, 0, 0] });
    this.scene.add(grid({ size: 10, step: 1 }));

    this.#camera = this.scene.add(new SceneCamera({
      name: "Camera A",
      position: [0, 1.5, 4],
      lookAt: [0, 0, 0],
      fov: 45, near: 1, far: 8,
      color: [0.2, 0.8, 1.0],
      show: { body: true, frustum: true, axes: true, nearPlane: true, farPlane: true, lookAtLine: true },
    }));

    this.scene.add(new MeshNode({ shape: "box", position: [0, 0.5, 0], wireframe: true }));
    this.scene.add(new MeshNode({ shape: "plane", scale: 6, rotation: [-90, 0, 0], wireframe: true }));
    this.scene.add(new DirectionalLight({ direction: [-1, -2, -1], show: { arrow: true, rays: 4 } }));

    this.lookThrough(this.#camera);   // picture-in-picture inset
  }

  get params() {
    return [
      { title: "Field of view", type: "number" as const, min: 10, max: 120, initial: 45,
        update: (v: number) => (this.#camera.fov = v) },
      { title: "Near plane", type: "number" as const, min: 0.1, max: 5, initial: 1,
        update: (v: number) => (this.#camera.near = v) },
      { title: "Far plane", type: "number" as const, min: 2, max: 20, initial: 8,
        update: (v: number) => (this.#camera.far = v) },
      { title: "Orthographic", type: "boolean" as const,
        update: (v: boolean) => (this.#camera.projectionType = v ? "orthographic" : "perspective") },
    ];
  }
}
```

Everything else — the render loop, the viewer controls, the gizmo drawing, the inset viewport —
comes from `Playground`.

---

## 6. Changes needed in the existing code

Small and additive. No existing scene changes behaviour.

1. **`GLScene.dispose?()`** (`src/gl/index.ts:15`) and a call to it in
   `GLSceneView.#renderScene` (`src/elements/sceneview.ts:42`) before loading the next scene.
   *Required* — the viewer controls add pointer and keyboard listeners, and without teardown they
   accumulate every time you click a different demo in the nav.

2. **Canvas sizing.** The canvas is fixed at 512×512 (`sceneview.ts:5`) and the viewport is set
   once (`context.ts:57`). An interactive playground wants to fill its panel and stay sharp on a
   HiDPI projector. Add a `ResizeObserver` in `<scene-view>` that sets
   `canvas.width = clientWidth * devicePixelRatio` (etc.), and move `gl.viewport(...)` into the
   frame callback. Existing scenes render identically as long as the aspect stays 1:1 in CSS, so
   gate the stretch behaviour behind an attribute (`<scene-view responsive>`) if it disturbs any
   of them.

3. **Pointer events on the canvas.** `touch-action: none` in CSS, `contextmenu` suppressed, and
   `setPointerCapture` for drags, so drag-off-canvas and touchpads behave.

4. **VAOs.** New `GpuMesh` in `src/viz/render/mesh.ts` using `gl.createVertexArray()`. The scene
   graph draws many objects per frame, and re-specifying attribute pointers per draw (as
   `cube.geo.ts` does) does not scale. **`cube.geo.ts` and `plane.geo.ts` stay exactly as they
   are** — they are deliberately explicit teaching code for the early lectures.

5. **Controls, minor** (`src/elements/controls.ts`):
   * add a `"select"` parameter type (choosing projection type, choosing which entity to orbit)
     and optionally `"vec3"` (three sliders, for positioning a light live);
   * number inputs listen to `change` (`controls.ts:42`) — switching to `input` makes sliders
     update while dragging, which matters a lot when demonstrating;
   * colour inputs ignore `param.initial` and always start red.

   Items 2 and 3 are small existing-behaviour fixes worth doing regardless of this library.

---

## 7. Phases

Each phase ends with something demonstrable in a lecture.

| Phase | Content | Ends with |
| --- | --- | --- |
| **0. Prep** (done) | `dispose()`, canvas resize + DPR, pointer events, `GpuMesh`/VAO | An empty resizable playground scene that clears to a background colour |
| **1. Core** (done) | `Transform`, `Node`, `VizScene`, `Viewer`, `LineBatch`, `VizRenderer`, line + surface shaders, primitives (grid, axes, wire box, wire plane, sphere) | A static scene of wireframe objects on a grid |
| **2. Viewer controls** (done) | `ViewerControls` (orbit + fly + damping), `focus()`, reset | You can fly and orbit the Phase 1 scene |
| **3. Scene cameras** (done) | `SceneCamera`, `frustumCorners()`, frustum / near / far / image-plane / axes / lookAt gizmos, **look-through inset viewport** | The "what is a view frustum" demo, perspective ⟷ orthographic |
| **4. Lights** (done) | `DirectionalLight`, `PointLight`, `SpotLight` + gizmos; lighting in the surface shader | The "three kinds of light" demo |
| **5. Interaction** (done) | HTML label overlay, double-click picking, HUD legend + entity list + controls help | Labelled diagrams; click any entity to orbit it |
| **6. Polish** (done) | X-ray line pass (`depthFunc(GREATER)`, dimmed) so a frustum is visible through objects; transparent plane sorting; thick lines; **camera pose in the URL hash** so you can link to an exact viewpoint from lecture notes | Presentation-quality output |
| **7. Demos** (done) | Author the scenes in §8 | The course material |

Phases 0–3 are the ones that deliver the core request; 4–7 are increments on a working thing.
If time runs out, stopping after Phase 3 still leaves something genuinely useful.

**Phases 0 and 1 are implemented.** `Viewer` moved from Phase 2 into Phase 1, because the
renderer needs a view matrix before there is anything to look at; Phase 2 is now only the
interactive controls. Until those exist, `viz-sandbox` drives the viewer from sliders.

---

## 8. Demos

Built, under "Visualisations" in the nav:

* **The view frustum** (`viz-view-frustum`) - a camera with its view volume drawn and
  its picture in the inset. Field of view, near and far planes on sliders, and one
  checkbox that morphs the frustum between perspective and orthographic.
* **The projection plane** (`viz-projection-plane`) - lines from the eye through every
  corner of an object to where they cross the image plane. Slide the plane: the picture
  changes size but not shape.
* **The view transformation** (`viz-view-transformation`) - swing the camera around a
  stationary object and watch the object swing in the inset instead. Does the camera
  move, or does the world?
* **Frustum culling** (`viz-frustum-culling`) - a field of objects, green when they
  survive the six-plane test. The inset confirms the grey ones really are absent.
* **Transformation hierarchies** (`viz-hierarchy`) - a three-link arm with axes on every
  joint. Rotating the shoulder moves everything; rotating the wrist moves the hand.
* **Phong from the outside** (`viz-phong-vectors`) - N, L, V and R drawn at a point on a
  surface, with the two dot products as a live readout.
* **Kinds of light** (`viz-lights`) - directional, point and spot side by side, each
  switchable so you can see what it alone contributes.
* **Playground sandbox** (`viz-sandbox`) - every entity and gizmo in one scene. If it
  renders, the library works.

Still to write, when the course reaches them:

* Near and far planes, and field of view, as demos in their own right rather than sliders
  on the frustum demo.
* Shadow mapping - the light's own frustum, drawn with the same `SceneCamera` code, which
  is the point.

## 9. Risks and how the plan handles them

* **Scope creep into a game engine.** Mitigation: no materials system, no textures, no scene file
  format, no animation system, no physics. If a demo needs something exotic, it writes its own
  WebGL, exactly as the current scenes do.
* **The library becoming unreadable.** Mitigation: a soft budget of ~150 lines per file and no
  file that a student cannot read top to bottom. `LineBatch` + pure-function gizmos is what keeps
  this achievable.
* **1-pixel lines look thin on a projector.** Known; Phase 6 addresses it behind an unchanged API.
  Until then, colour and background contrast carry the legibility.
* **No test infrastructure in the repo.** Mitigation: (a) `yarn build` already runs `tsc`, so
  types are checked in CI on every push; (b) add one `viz-sandbox` demo scene that instantiates
  every entity and every gizmo — if it renders, the library works. Pure functions like
  `frustumCorners()` are the only things worth unit-testing, and can be checked against
  hand-computed corners if a test runner is ever added.
* **Performance.** Not a real risk at this scale — one line draw call, a handful of meshes, and
  one extra pass for the inset. If it ever matters, the `LineBatch` buffer is the only thing that
  needs an orphaning strategy.

---

## 10. Decisions

1. **Canvas size** - the playground fills its panel. A scene opts in with `layout: "fill"`;
   every other scene keeps the fixed 512x512 canvas. Its height comes from a 16:10 aspect ratio
   capped at `100vh - 180px` rather than from stretching, so the long navigation column cannot
   squeeze the playground into a tall narrow slot.
2. **Placement** - the same page, under a new "Visualisations" section in the nav.
3. **Naming** - as proposed: `Playground`, `VizScene`, `Viewer`, `SceneCamera`.
4. **Animation is deferred**, deliberately. A `SceneCamera` is static or slider-driven. There is
   a `Playground.update(dt, time)` hook for a demo that needs one, but no keyframe or path
   helper will be added to the library - that is exactly the feature creep this plan is trying
   to avoid.
