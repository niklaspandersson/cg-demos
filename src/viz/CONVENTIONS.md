# Conventions used by `src/viz`

Every value in this library follows these rules. If something here surprises
you, that is a bug in the library, not in your demo.

## The two cameras

This is the distinction that causes the most confusion, so the library keeps
the two apart by name, everywhere:

| | `Viewer` | `SceneCamera` |
| --- | --- | --- |
| What it is | the camera **you look through** | a camera **you are looking at** |
| Part of the scene? | no | yes, it is a `Node` |
| Drawn? | never | yes, with its frustum and axes |
| Belongs to | the `Playground` | the `VizScene` |
| How many | exactly one | zero or more |

A demo about, say, field of view has one `Viewer` (so you can walk around and
look at things) and one `SceneCamera` (whose field of view is the subject).

## Space

* Right-handed, **y up**, **-z forward**.
* A camera - either kind - looks along **its own -z axis**. That is the same
  direction `mat4.lookAt` looks along, and the reason `Transform.lookAt()`
  aims -z at its target.
* The ground plane is **xz**, at y = 0. `grid()` lies in it.

## Matrices

* All matrices are `gl-matrix` `mat4`: column-major, applied as `M * v`.
* A node's world matrix is `parentWorld * local`, rebuilt once per frame by
  `VizScene.update()`. Nothing is cached between frames, so you can change a
  transform at any point and the next frame picks it up.
* Normalised device coordinates run from **-1 to +1 on all three axes**,
  including z. This is the OpenGL/WebGL convention; Direct3D, Vulkan and WebGPU
  use 0..1 for depth instead. Anything that unprojects NDC corners - the
  frustum gizmo above all - depends on this.

## Units

* **Angles in the public API are degrees.** `fov: 45`, `rotation: [0, 90, 0]`.
  Radians only appear inside the library, immediately before a call that needs
  them.
* Rotations are given as Euler angles in degrees, in `gl-matrix`'s default
  order. For anything where the order would matter, use `lookAt` instead.
* Distances are unitless. Treat 1 as "about the size of one object", and keep
  scenes within roughly 10 units of the origin so the default viewer framing
  works.

## Colours

* `[r, g, b]` or `[r, g, b, a]`, each channel 0..1.
* An alpha below 1 puts a surface in the transparent pass, which is drawn back
  to front and does not write depth.

## Geometry

* Primitives are built at **unit size, centred on the origin**: the box runs
  from -0.5 to +0.5, the sphere has radius 0.5, the plane is a unit square in
  xy facing +z. Scale the node to resize them.
* Gizmos push their lines in the **local space of their node**. The renderer
  applies the world matrix, so a wireframe cube really is just the twelve edges
  of a unit cube.
