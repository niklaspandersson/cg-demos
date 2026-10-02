import { vec3 } from "gl-matrix";
import type { GLContext, ParameterDescriptor } from "../../gl";
import {
  DirectionalLight,
  GeometryNode,
  MeshNode,
  Node,
  Playground,
  PointLight,
  SceneCamera,
  axes,
  checkerTexture,
  grid,
  setFiltering,
  type Collector,
  type Color,
  type Label,
  type Stage,
  type Stages,
} from "../../viz";
import { bladeMesh, groundMesh, hubMesh, roofMesh, towerMesh } from "./geometry";

/**
 * The whole course, on one windmill.
 *
 * Each step adds one idea to the scene that is already there, in the order the
 * lectures introduce them: a handful of points becomes triangles, the triangles
 * get moved into place by a matrix, the matrices get nested, a camera is put in
 * front of the result, the triangles become pixels, the pixels get lit, and the
 * surfaces get an image. Nothing is ever thrown away and restarted, which is
 * the argument: these are not ten topics, they are one pipeline.
 *
 * Step with the arrow keys, the arrows in the panel, or the picker in the
 * controls. The usual playground controls still apply, so at any point in the
 * story you can fly around and look at the thing from behind.
 */

const STAGES: Stage[] = [
  {
    title: "Vertices",
    caption:
      "An object starts as nothing but points in space. Eight of them, each one three numbers, and the mill's body is already decided - there is just nothing stretched between them yet.",
  },
  {
    title: "Triangles",
    caption:
      "A triangle names three of those points. Twelve triangles cover the eight corners, and the order the three are named in decides which side is the front. Reveal them one at a time and watch the surface close up.",
  },
  {
    title: "Transformations",
    caption:
      "The roof is a second object, built around its own origin, with no idea a tower exists. A matrix puts it there. Slide it into place: the five points never change, only what is multiplied with them.",
  },
  {
    title: "Coordinate spaces",
    caption:
      "The same corner has one description in the roof's own space and another in the world's. Turn the roof and watch the world numbers change while the object numbers sit perfectly still.",
  },
  {
    title: "Hierarchies",
    caption:
      "The sails are children of the axle, the axle is a child of the mill. Each one knows only where it sits relative to its parent, so turning the axle swings four sails and nobody had to be told.",
  },
  {
    title: "Scene and camera",
    caption:
      "A scene is a tree of objects in one shared world. A camera is one more object in it - what makes it a camera is that we take the inverse of where it stands, which brings the world into its view instead.",
  },
  {
    title: "Projection",
    caption:
      "The frustum is the piece of the world the camera can turn into a picture. Perspective makes distant sails smaller; orthographic does not. The inset is what this camera actually produces.",
  },
  {
    title: "Rasterisation",
    caption:
      "Triangles do not reach the screen - pixels do. Make the pixels big enough to count, and you can see the rasteriser deciding which samples fall inside each triangle, which triangle won at each pixel, and which faces were never drawn at all.",
  },
  {
    title: "Lighting",
    caption:
      "Until now every surface has been its flat colour. Now brightness is computed per pixel from the surface normal and the direction light arrives from - and the normals we chose in step two start to matter.",
  },
  {
    title: "Texturing",
    caption:
      "The last gap between a shape and a thing: each corner of each triangle also carries a position in an image, and the rasteriser interpolates between them. Same twelve triangles as step two, now made of brick.",
  },
];

const VERTICES = 0;
const TRIANGLES = 1;
const TRANSFORMATIONS = 2;
const SPACES = 3;
const HIERARCHIES = 4;
const SCENE = 5;
const PROJECTION = 6;
const RASTERISATION = 7;
const LIGHTING = 8;
const TEXTURING = 9;

/** Where the roof belongs once the transformation step has done its work. */
const ROOF_LIFT = 2.2;

/** Where it starts in that step, so that there is something to correct. */
const ROOF_START = { lift: 1.45, turn: 28, scale: 1.3 };

const TOWER_COLOR: Color = [0.86, 0.72, 0.52];
const ROOF_COLOR: Color = [0.76, 0.33, 0.28];
const BLADE_COLOR: Color = [0.92, 0.9, 0.85];
const HUB_COLOR: Color = [0.55, 0.58, 0.66];
const GROUND_COLOR: Color = [0.33, 0.44, 0.3];

/** A colour per face of the tower, so the twelve triangles stay apart. */
const FACE_TINTS: Color[] = [
  [0.95, 0.62, 0.35],
  [0.55, 0.78, 0.95],
  [0.65, 0.85, 0.5],
  [0.95, 0.85, 0.4],
  [0.8, 0.6, 0.95],
  [0.5, 0.85, 0.8],
];

/** The second triangle of a face is the same colour, a shade darker. */
const darker = (color: Color): Color => [color[0] * 0.78, color[1] * 0.78, color[2] * 0.78];

/** Which images the last step puts on the mill. */
type TextureChoice = "mixed" | "checker" | "none";

const format = (v: vec3) =>
  `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`;

/**
 * Two dashed lines to one corner of the roof: one from the world's origin and
 * one from the roof's own. The corner is a single point either way; the step
 * about coordinate spaces is the step about there being two ways to say where
 * it is.
 */
class VertexProbe extends Node {
  constructor(
    private readonly subject: GeometryNode,
    private readonly vertex: () => number,
  ) {
    super({ visible: false });
  }

  /** Where the chosen corner has ended up, in world space. */
  worldPoint(out: vec3 = vec3.create()): vec3 {
    const local = this.subject.mesh.vertices[this.vertex()] as vec3;
    return vec3.transformMat4(out, local, this.subject.worldMatrix);
  }

  /** The chosen corner as the mesh stores it. */
  localPoint(out: vec3 = vec3.create()): vec3 {
    return vec3.copy(out, this.subject.mesh.vertices[this.vertex()] as vec3);
  }

  collect(collector: Collector) {
    const point = this.worldPoint();
    const origin = this.subject.worldPosition();

    const lines = collector.seeThroughLines;
    lines.dashed([0, 0, 0], point, [0.4, 0.85, 0.45], 0.12);
    lines.dashed(origin, point, [1, 0.72, 0.3], 0.1);
    collector.points.point(point, [1, 1, 1], 11);
    collector.points.point(origin, [1, 0.72, 0.3], 9);
  }
}

export default class Scene extends Playground {
  #stages!: Stages;

  #tower!: GeometryNode;
  #roof!: GeometryNode;
  #hub!: Node;
  #hubBody!: GeometryNode;
  #blades: GeometryNode[] = [];
  #mill!: Node;
  #farHub!: Node;
  #ground!: GeometryNode;
  #scenery!: Node;
  #sceneryMeshes: MeshNode[] = [];
  #farTower!: GeometryNode;
  #farRoof!: GeometryNode;
  #farParts: GeometryNode[] = [];
  #worldAxes!: Node;
  #millAxes!: Node;
  #roofAxes!: Node;
  #grid!: Node;

  #camera!: SceneCamera;
  #sun!: DirectionalLight;
  #lamp!: PointLight;
  #probe!: VertexProbe;

  #vertexLabels: Label[] = [];
  #partLabels: Label[] = [];
  #objectLabel!: Label;
  #worldLabel!: Label;

  #bricks: WebGLTexture | null = null;
  #checker: WebGLTexture | null = null;
  #tiles: WebGLTexture | null = null;
  #grass: WebGLTexture | null = null;
  #gl: WebGL2RenderingContext | null = null;

  /** How far the axle has turned, in degrees. */
  #hubAngle = 0;

  // Everything a slider can change lives here, so that re-entering a step puts
  // its controls back to the state the step is written around.
  #revealVertices = 8;
  #revealTriangles = 12;
  #roofLift = ROOF_LIFT;
  #roofTurn = 0;
  #roofScale = 1;
  #vertexIndex = 4;
  #spinning = false;
  #spin = 18;
  #cameraTurn = 35;
  #cameraHeight = 2.4;
  #sunTurn = 62;
  #sunHeight = 42;
  #lampOn = false;
  #smoothNormals = false;
  #showNormals = false;
  #showEdges = true;
  #tiling = 2;
  #smoothFiltering = true;
  #textures: TextureChoice = "mixed";

  async setup(ctx: GLContext) {
    this.#bricks = await this.#loadBricks(ctx);

    // One image with a marked corner, for showing what texture coordinates do,
    // and two quiet ones for when the mill is meant to look like a mill.
    this.#checker = checkerTexture(ctx.gl, { squares: 8 });
    this.#tiles = checkerTexture(ctx.gl, {
      squares: 6,
      light: "#8d3f35",
      dark: "#6b2d26",
      marker: false,
    });
    this.#grass = checkerTexture(ctx.gl, {
      squares: 4,
      light: "#6d8c50",
      dark: "#5a7746",
      marker: false,
    });

    this.#buildScene(ctx);
    this.#buildLabels();

    this.#stages = this.useStages(STAGES, (index) => this.#applyStage(index));
  }

  // ---------------------------------------------------------------- the scene

  #buildScene(_ctx: GLContext) {
    this.#grid = this.scene.add(grid({ size: 18, step: 1 }));
    this.#worldAxes = this.scene.add(
      axes({ name: "world origin", size: 1.6, seeThrough: true }),
    );

    const tower = towerMesh();
    tower.paint((i) => (i % 2 === 0 ? FACE_TINTS[i / 2] : darker(FACE_TINTS[(i - 1) / 2])));

    this.#mill = this.scene.add(new Node({ name: "mill" }));
    this.#millAxes = this.#mill.add(axes({ size: 1.1, seeThrough: true }));

    this.#tower = this.#mill.add(
      new GeometryNode({
        name: "tower",
        mesh: tower,
        color: TOWER_COLOR,
        vertices: true,
        edges: true,
      }),
    );

    this.#roof = this.#mill.add(
      new GeometryNode({
        name: "roof",
        mesh: roofMesh(),
        color: ROOF_COLOR,
        edges: true,
        position: [0, ROOF_LIFT, 0],
      }),
    );
    this.#roofAxes = this.#roof.add(axes({ size: 1, seeThrough: true }));

    // The axle and its four sails: one mesh, four nodes, four transforms. The
    // sails are children of the axle, so the axle's rotation is theirs too.
    this.#hub = this.#mill.add(new Node({ name: "axle", position: [0, 1.9, 0.63] }));
    this.#hubBody = this.#hub.add(new GeometryNode({ mesh: hubMesh(), color: HUB_COLOR, edges: true }));

    const blade = bladeMesh();
    for (let i = 0; i < 4; i++) {
      this.#blades.push(
        this.#hub.add(
          new GeometryNode({
            mesh: blade,
            color: BLADE_COLOR,
            edges: true,
            position: [0, 0, 0.2],
            rotation: [0, 0, i * 90],
          }),
        ),
      );
    }

    this.#ground = this.scene.add(
      new GeometryNode({ mesh: groundMesh(9), color: GROUND_COLOR, position: [0, -0.01, 0] }),
    );

    this.#scenery = this.scene.add(this.#buildScenery());

    this.#camera = this.scene.add(
      new SceneCamera({
        name: "camera",
        fov: 40,
        aspect: 1.6,
        near: 1.5,
        far: 11,
        orthoHeight: 2.6,
        color: [0.35, 0.8, 1],
        show: { body: true, frustum: true, lookAtLine: true },
      }),
    );

    this.#sun = this.scene.add(
      new DirectionalLight({
        name: "sun",
        color: [1, 0.95, 0.85],
        position: [3.5, 5, 3.5],
        show: { arrow: true, rays: 3, length: 3 },
      }),
    );

    this.#lamp = this.scene.add(
      new PointLight({
        name: "lamp",
        position: [-1.9, 1.1, 2.2],
        color: [1, 0.72, 0.4],
        range: 5,
      }),
    );

    this.#probe = this.scene.add(new VertexProbe(this.#roof, () => this.#vertexIndex));
  }

  /** Scenery: something for the camera to frame, and a second mill to catch. */
  #buildScenery() {
    const group = new Node();

    const far = this.#smallMill([-5.2, 0, -4.2], 0.55, -28);
    group.add(far);

    for (const [x, z, height] of [
      [3.4, -3.2, 1.5],
      [-3.6, 2.6, 1.2],
      [5.2, 1.4, 1.8],
    ] as const) {
      const tree = group.add(new Node({ position: [x, 0, z] }));
      const trunk = tree.add(
        new MeshNode({ shape: "box", wireframe: false, color: [0.42, 0.3, 0.22] }),
      );
      this.#sceneryMeshes.push(trunk);
      trunk.transform.setPosition([0, height * 0.3, 0]).setScale([0.16, height * 0.6, 0.16]);

      const crown = tree.add(
        new MeshNode({ shape: "sphere", wireframe: false, color: [0.3, 0.5, 0.3] }),
      );
      this.#sceneryMeshes.push(crown);
      crown.transform.setPosition([0, height * 0.8, 0]).setScale(height * 0.9);
    }

    return group;
  }

  /** The same mill again, smaller, to show that a mesh is reusable. */
  #smallMill(position: readonly [number, number, number], scale: number, turn: number) {
    const mill = new Node({ position, scale, rotation: [0, turn, 0] });

    this.#farTower = mill.add(new GeometryNode({ mesh: towerMesh(), color: TOWER_COLOR }));
    this.#farRoof = mill.add(
      new GeometryNode({ mesh: roofMesh(), color: ROOF_COLOR, position: [0, ROOF_LIFT, 0] }),
    );

    const hub = mill.add(new Node({ position: [0, 1.9, 0.63] }));
    this.#farParts.push(this.#farTower, this.#farRoof);
    this.#farParts.push(hub.add(new GeometryNode({ mesh: hubMesh(), color: HUB_COLOR })));

    const blade = bladeMesh();
    for (let i = 0; i < 4; i++) {
      this.#farParts.push(
        hub.add(
          new GeometryNode({
            mesh: blade,
            color: BLADE_COLOR,
            position: [0, 0, 0.2],
            rotation: [0, 0, i * 90 + 18],
          }),
        ),
      );
    }

    this.#farHub = hub;
    return mill;
  }

  #buildLabels() {
    const tower = this.#tower;
    for (let i = 0; i < tower.mesh.vertexCount; i++) {
      const at = vec3.create();
      const label = this.label(
        `v${i}`,
        () => vec3.transformMat4(at, tower.mesh.vertices[i] as vec3, tower.worldMatrix),
        { offset: [0, 0.16, 0], color: [1, 0.85, 0.45], visible: false },
      );
      if (label) this.#vertexLabels.push(label);
    }

    const part = (text: string, node: Node, offset: vec3) => {
      const label = this.label(text, node, { offset, visible: false });
      if (label) this.#partLabels.push(label);
    };
    part("mill", this.#mill, [0, -0.35, 0]);
    part("roof", this.#roof, [0, 1.25, 0]);
    part("axle", this.#hub, [0.1, 0.45, 0.3]);
    part("sail", this.#blades[0], [1.1, 0.4, 0]);

    const at = vec3.create();
    this.#objectLabel = this.label("", () => this.#probe.worldPoint(at), {
      offset: [0, 0.3, 0],
      color: [1, 0.78, 0.4],
      visible: false,
    })!;
    this.#worldLabel = this.label("", () => this.#probe.worldPoint(at), {
      offset: [0, 0.12, 0],
      color: [0.5, 0.9, 0.55],
      visible: false,
    })!;
  }

  // ---------------------------------------------------------------- the steps

  /**
   * Put the scene into the state one step wants.
   *
   * Every step sets everything it cares about rather than undoing what the
   * previous one did, so stepping backwards works as well as forwards and the
   * picker can jump straight to step nine.
   */
  #applyStage(index: number) {
    const geometryStep = index <= TRIANGLES;
    const lit = index >= LIGHTING;
    const worldStep = index >= SCENE;

    // Step defaults. A slider that belongs to this step starts where the step
    // is written around; one that belongs to an earlier step is left finished.
    this.#revealVertices = 8;
    this.#revealTriangles = index === TRIANGLES ? 1 : index === VERTICES ? 0 : 12;
    this.#showEdges = index <= RASTERISATION;
    this.#smoothNormals = false;
    this.#showNormals = false;
    this.#lampOn = false;
    this.#spinning = index >= HIERARCHIES;
    this.#textures = "mixed";
    this.#tiling = 2;
    this.#smoothFiltering = true;

    if (index === TRANSFORMATIONS) {
      this.#roofLift = ROOF_START.lift;
      this.#roofTurn = ROOF_START.turn;
      this.#roofScale = ROOF_START.scale;
    } else {
      this.#roofLift = ROOF_LIFT;
      this.#roofTurn = 0;
      this.#roofScale = 1;
    }

    // What exists at all.
    // At a big pixel size every grid line becomes a fat block of its own, so
    // the step about pixels keeps the ground and drops the grid over it.
    this.#grid.visible = !geometryStep && index !== RASTERISATION;
    this.#worldAxes.visible = index >= TRANSFORMATIONS && index <= HIERARCHIES;
    this.#millAxes.visible = index === SPACES || index === HIERARCHIES;
    this.#roofAxes.visible = index === TRANSFORMATIONS || index === SPACES;
    this.#roof.visible = index >= TRANSFORMATIONS;
    this.#hub.visible = index >= HIERARCHIES;
    this.#ground.visible = worldStep;
    this.#scenery.visible = worldStep;
    this.#camera.visible = index === SCENE || index === PROJECTION;
    this.#sun.visible = index >= LIGHTING;
    this.#lamp.visible = false;
    this.#probe.visible = index === SPACES;

    // How it is drawn.
    for (const node of this.#geometryNodes()) {
      node.unlit = !lit;
      node.edges = this.#showEdges;
      node.shading = "flat";
      node.normals = false;
      node.colorFaces = geometryStep;
      node.vertices = false;
      node.texture = null;
    }
    for (const mesh of this.#sceneryMeshes) mesh.unlit = !lit;
    this.#tower.vertices = geometryStep;
    this.#tower.reveal = this.#revealTriangles;
    this.#tower.revealVertices = this.#revealVertices;
    this.#tower.highlightLast = index === TRIANGLES;
    this.#tower.faces = index !== VERTICES;

    const renderer = this.renderer;
    renderer.cullBackFaces = false;
    renderer.depthTest = true;
    renderer.ambient = lit ? 0.22 : 1;
    renderer.lineThickness = geometryStep ? 2.2 : 1.6;
    this.pixelSize = 1;

    this.lookThrough(index === SCENE || index === PROJECTION ? this.#camera : null, {
      widthFraction: 0.32,
    });

    // The sun keeps working in the texturing step, but its bundle of rays would
    // only be in the way there, so only the light itself stays.
    this.#sun.show = index === LIGHTING
      ? { arrow: true, rays: 3, length: 3 }
      : { arrow: false, rays: 0, length: 3 };

    this.#camera.show = {
      body: true,
      frustum: true,
      axes: index === SCENE,
      lookAtLine: index === SCENE,
      nearPlane: index === PROJECTION,
      farPlane: index === PROJECTION,
    };

    // Labels belong to one step each; showing all of them at once would bury
    // the scene in text.
    for (const label of this.#vertexLabels) label.visible = geometryStep;
    for (const label of this.#partLabels) label.visible = index === HIERARCHIES;
    this.#objectLabel.visible = index === SPACES;
    this.#worldLabel.visible = index === SPACES;

    this.#applyRoof();
    this.#applyCamera();
    this.#applySun();
    this.#applyTextures();
    this.#frame(index);
    this.refreshLegend();
  }

  /** Where to stand to see what this step is about. */
  #frame(index: number) {
    if (index <= TRIANGLES) {
      this.viewer.set({ target: [0, 1.1, 0], fov: 45 });
      this.viewer.setOrbit(34, 16, 6.4);
    } else if (index <= SPACES) {
      this.viewer.set({ target: [0, 1.6, 0], fov: 45 });
      this.viewer.setOrbit(38, 14, 8);
    } else if (index === HIERARCHIES) {
      this.viewer.set({ target: [0, 1.9, 0.3], fov: 45 });
      this.viewer.setOrbit(22, 10, 8.5);
    } else if (index <= PROJECTION) {
      this.viewer.set({ target: [0, 1.4, 0], fov: 48 });
      this.viewer.setOrbit(56, 24, 17);
    } else if (index === RASTERISATION) {
      this.viewer.set({ target: [0, 1.5, 0], fov: 45 });
      this.viewer.setOrbit(30, 14, 9);
    } else {
      this.viewer.set({ target: [0, 1.5, 0], fov: 45 });
      this.viewer.setOrbit(26, 15, 9.5);
    }

    // "R" goes back to this step's view rather than to the first step's.
    this.controls.syncFromViewer().saveHome();
  }

  /** Everything drawn from a `TriangleMesh`, near mill and far one alike. */
  #geometryNodes(): GeometryNode[] {
    return [
      this.#tower,
      this.#roof,
      this.#hubBody,
      ...this.#blades,
      this.#ground,
      ...this.#farParts,
    ];
  }

  #applyRoof() {
    this.#roof.transform
      .setPosition([0, this.#roofLift, 0])
      .setEuler([0, this.#roofTurn, 0])
      .setScale(this.#roofScale);
  }

  #applyCamera() {
    const radians = (this.#cameraTurn * Math.PI) / 180;
    const distance = 6.5;
    this.#camera.transform.setPosition([
      Math.sin(radians) * distance,
      this.#cameraHeight,
      Math.cos(radians) * distance,
    ]);
    this.#camera.transform.lookAt([0, 1.5, 0]);
  }

  #applySun() {
    const azimuth = (this.#sunTurn * Math.PI) / 180;
    const elevation = (this.#sunHeight * Math.PI) / 180;
    const position: [number, number, number] = [
      Math.sin(azimuth) * Math.cos(elevation) * 5,
      Math.sin(elevation) * 5,
      Math.cos(azimuth) * Math.cos(elevation) * 5,
    ];

    this.#sun.transform.setPosition(position);
    // A directional light has no position - only the picture of it does - so
    // the direction is the one thing that has to be right.
    this.#sun.setDirection(vec3.negate(vec3.create(), position));
  }

  #applyTextures() {
    const textured = this.#stages?.index === TEXTURING && this.#textures !== "none";

    for (const node of this.#geometryNodes()) {
      node.texture = null;
      node.textureScale = [1, 1];
    }
    if (!textured) return;

    const pattern = this.#textures === "checker";

    this.#tower.texture = pattern ? this.#checker : this.#bricks;
    this.#tower.textureScale = [this.#tiling, this.#tiling];

    this.#roof.texture = pattern ? this.#checker : this.#tiles;
    this.#roof.textureScale = [this.#tiling, this.#tiling];

    // The ground is one square nine times the size of the mill, so it needs far
    // more repeats than a wall does to end up with squares of a similar size.
    this.#ground.texture = pattern ? this.#checker : this.#grass;
    this.#ground.textureScale = [this.#tiling * 4, this.#tiling * 4];

    // The mill down the field is the same two meshes, so it gets the same two
    // images - a demo that textured only the one in front would raise the
    // question of why.
    this.#farTower.texture = this.#tower.texture;
    this.#farTower.textureScale = this.#tower.textureScale;
    this.#farRoof.texture = this.#roof.texture;
    this.#farRoof.textureScale = this.#roof.textureScale;

    this.#setFiltering(this.#smoothFiltering);
  }

  protected update(dt: number) {
    if (this.#spinning) {
      const turn = (this.#spin * dt) % 360;
      this.#hub.transform.setEuler([0, 0, this.#hubAngle += turn]);
      this.#farHub.transform.setEuler([0, 0, (this.#hubAngle * 0.6) % 360]);
    }

    if (this.#stages?.index === SPACES) {
      this.#objectLabel.element.textContent = `roof space ${format(this.#probe.localPoint())}`;
      this.#worldLabel.element.textContent = `world ${format(this.#probe.worldPoint())}`;
    }
  }

  // ------------------------------------------------------------- the controls

  get params(): ParameterDescriptor[] {
    if (!this.#stages) return [];
    return [this.#stages.picker("Step"), ...this.#stageParams(this.#stages.index)];
  }

  #stageParams(index: number): ParameterDescriptor[] {
    switch (index) {
      case VERTICES:
        return [
          this.#slider("Vertices", 0, 8, 1, this.#revealVertices, (v) => {
            this.#revealVertices = v;
            this.#tower.revealVertices = v;
          }),
        ];

      case TRIANGLES:
        return [
          this.#slider("Triangles", 0, 12, 1, this.#revealTriangles, (v) => {
            this.#revealTriangles = v;
            this.#tower.reveal = v;
          }),
          this.#toggle("Vertices", this.#tower.vertices, (on) => {
            this.#tower.vertices = on;
            for (const label of this.#vertexLabels) label.visible = on;
          }),
        ];

      case TRANSFORMATIONS:
        return [
          this.#slider("Lift", 0, 3.2, 0.05, this.#roofLift, (v) => {
            this.#roofLift = v;
            this.#applyRoof();
          }),
          this.#slider("Turn", -90, 90, 1, this.#roofTurn, (v) => {
            this.#roofTurn = v;
            this.#applyRoof();
          }),
          this.#slider("Scale", 0.4, 1.8, 0.01, this.#roofScale, (v) => {
            this.#roofScale = v;
            this.#applyRoof();
          }),
        ];

      case SPACES:
        return [
          this.#slider("Corner", 0, 4, 1, this.#vertexIndex, (v) => {
            this.#vertexIndex = v;
          }),
          this.#slider("Turn the roof", -180, 180, 1, this.#roofTurn, (v) => {
            this.#roofTurn = v;
            this.#applyRoof();
          }),
          this.#slider("Lift the mill", 0, 2, 0.05, this.#mill.transform.position[1], (v) => {
            this.#mill.transform.setPosition([0, v, 0]);
          }),
        ];

      case HIERARCHIES:
        return [
          this.#toggle("Turning", this.#spinning, (on) => {
            this.#spinning = on;
          }),
          this.#slider("Speed", 0, 90, 1, this.#spin, (v) => {
            this.#spin = v;
          }),
          this.#slider("Axle angle", 0, 360, 1, this.#hubAngle % 360, (v) => {
            this.#hubAngle = v;
            this.#hub.transform.setEuler([0, 0, v]);
          }),
        ];

      case SCENE:
        return [
          this.#slider("Camera around", 0, 360, 1, this.#cameraTurn, (v) => {
            this.#cameraTurn = v;
            this.#applyCamera();
          }),
          this.#slider("Camera height", 0.3, 6, 0.1, this.#cameraHeight, (v) => {
            this.#cameraHeight = v;
            this.#applyCamera();
          }),
          this.#toggle("Look through it", true, (on) => {
            this.lookThrough(on ? this.#camera : null, { widthFraction: 0.32 });
          }),
        ];

      case PROJECTION:
        return [
          {
            title: "Projection",
            type: "select",
            initial: this.#camera.projectionType,
            options: [
              { label: "Perspective", value: "perspective" },
              { label: "Orthographic", value: "orthographic" },
            ],
            update: (value: string) => {
              this.#camera.projectionType = value === "orthographic" ? "orthographic" : "perspective";
            },
          },
          this.#slider("Field of view", 15, 100, 1, this.#camera.fov, (v) => {
            this.#camera.fov = v;
          }),
          this.#slider("Near", 0.3, 6, 0.1, this.#camera.near, (v) => {
            this.#camera.near = Math.min(v, this.#camera.far - 0.5);
          }),
          this.#slider("Far", 3, 20, 0.5, this.#camera.far, (v) => {
            this.#camera.far = Math.max(v, this.#camera.near + 0.5);
          }),
        ];

      case RASTERISATION:
        return [
          this.#slider("Pixel size", 1, 16, 1, this.pixelSize, (v) => {
            this.pixelSize = v;
          }),
          this.#toggle("Depth buffer", this.renderer.depthTest, (on) => {
            this.renderer.depthTest = on;
          }),
          this.#toggle("Cull back faces", this.renderer.cullBackFaces, (on) => {
            this.renderer.cullBackFaces = on;
          }),
          this.#toggle("Triangle edges", this.#showEdges, (on) => {
            this.#showEdges = on;
            for (const node of this.#geometryNodes()) node.edges = on;
          }),
        ];

      case LIGHTING:
        return [
          this.#slider("Sun around", 0, 360, 1, this.#sunTurn, (v) => {
            this.#sunTurn = v;
            this.#applySun();
          }),
          this.#slider("Sun height", 5, 85, 1, this.#sunHeight, (v) => {
            this.#sunHeight = v;
            this.#applySun();
          }),
          this.#slider("Ambient", 0, 0.6, 0.01, this.renderer.ambient, (v) => {
            this.renderer.ambient = v;
          }),
          this.#toggle("Averaged normals", this.#smoothNormals, (on) => {
            this.#smoothNormals = on;
            for (const node of this.#geometryNodes()) node.shading = on ? "smooth" : "flat";
          }),
          this.#toggle("Show normals", this.#showNormals, (on) => {
            this.#showNormals = on;
            this.#tower.normals = on;
            this.#roof.normals = on;
          }),
          this.#toggle("Lamp", this.#lampOn, (on) => {
            this.#lampOn = on;
            this.#lamp.visible = on;
          }),
        ];

      case TEXTURING:
        return [
          {
            title: "Images",
            type: "select",
            initial: this.#textures,
            options: [
              { label: "Brick and tiles", value: "mixed" },
              { label: "Test pattern", value: "checker" },
              { label: "None", value: "none" },
            ],
            update: (value: string) => {
              this.#textures = value as TextureChoice;
              this.#applyTextures();
            },
          },
          this.#slider("Repeats", 1, 6, 1, this.#tiling, (v) => {
            this.#tiling = v;
            this.#applyTextures();
          }),
          this.#toggle("Smooth filtering", this.#smoothFiltering, (on) => {
            this.#smoothFiltering = on;
            this.#setFiltering(on);
          }),
        ];

      default:
        return [];
    }
  }

  #slider(
    title: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    update: (value: number) => void,
  ): ParameterDescriptor {
    return { title, type: "number", min, max, step, initial, update };
  }

  #toggle(title: string, initial: boolean, update: (value: boolean) => void): ParameterDescriptor {
    return { title, type: "boolean", initial, update };
  }

  #setFiltering(smooth: boolean) {
    const gl = this.#gl;
    if (!gl) return;
    for (const texture of [this.#bricks, this.#checker, this.#tiles, this.#grass]) {
      if (texture) setFiltering(gl, texture, smooth);
    }
  }

  /**
   * The brick image, set to repeat. `loadTexture` clamps by default, which is
   * the safe choice for a single image on a single quad and the wrong one for a
   * wall that wants the same bricks four times across.
   */
  async #loadBricks(ctx: GLContext) {
    this.#gl = ctx.gl;
    try {
      const texture = await ctx.loadTexture("assets/bricks.jpg");
      const gl = ctx.gl;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return texture;
    } catch {
      // A missing image is not worth losing nine other steps over.
      return null;
    }
  }
}
