# The course in one scene

`#course-tour` is a single windmill that the whole course is built on. Each
step adds one idea to the scene already on screen, in the order the lectures
introduce them, and nothing is ever cleared away and restarted. That is the
argument the demo is making: these are not ten topics, they are one pipeline.

Step with the **left and right arrow keys**, the arrows in the panel, or the
**Step** picker in the controls. Every step brings its own sliders, and every
step reframes the view on what it is about - `R` returns to that step's view
after you have flown off somewhere.

## What each step is for

| Step | On screen | The point to make |
| --- | --- | --- |
| 1. Vertices | Eight labelled dots | An object is a list of positions. Nothing else has happened yet. |
| 2. Triangles | The dots fill in, one triangle at a time | A triangle names three of the points. The order names the front. |
| 3. Transformations | A roof, deliberately too low, turned and too big | The five points of the roof never change; the matrix does. Slide it into place. |
| 4. Coordinate spaces | One corner, with both of its descriptions | Turn the roof: the world numbers change, the object numbers do not. |
| 5. Hierarchies | Axle and four sails, turning | Each part is placed relative to its parent. Turn the axle and four sails follow. |
| 6. Scene and camera | Ground, trees, a second mill, a camera with its frustum | A camera is an object in the scene; its view matrix is the inverse of where it stands. The inset is what it sees. |
| 7. Projection | The frustum changing shape | Perspective against orthographic, field of view, near and far - with the resulting image beside it. |
| 8. Rasterisation | The scene made of countable pixels | Triangles do not reach the screen. Turn off the depth buffer and watch draw order decide. Turn on culling and watch half the triangles go. |
| 9. Lighting | The first shading in the demo | Brightness from the normal and the light direction. Switch to averaged normals and watch a box try to look round. |
| 10. Texturing | Brick, tiles and grass | The same twelve triangles as step two, with an image position at every corner. |

## Things worth doing live

* **Step 2, slowly.** Drag the triangle slider one notch at a time. The newest
  triangle is outlined, and the two triangles of each face are two shades of
  the same colour, so the quad-to-triangles split is visible without saying it.
* **Step 3, overshoot deliberately.** Scale the roof to 1.8 and leave it - it
  is the clearest statement that the mesh and its placement are separate.
* **Step 4, turn the roof with a base corner selected** rather than the apex.
  The apex only changes height; a base corner swings through all three numbers.
* **Step 8, pixel size 12 with the depth buffer off.** Then back on. Then back
  off. Nothing else makes the depth buffer feel as necessary.
* **Step 9, averaged normals on the mill.** It looks wrong, and being able to
  say *why* it looks wrong is the whole of the normals lecture.
* **Step 10, "Test pattern" with the repeats slider.** The marked square shows
  which way the image is lying on each face.

## Where the geometry lives

`src/scenes/course-tour/geometry.ts` is lesson material: every shape in the
demo is a hand-written list of corners and a hand-written list of faces, short
enough to read out loud. It is worth putting on screen next to the running
demo at least once - the tower on screen and the eight lines of numbers that
produced it.

The parts of the library this demo leans on are documented in
`src/viz/CONVENTIONS.md`: `TriangleMesh` and `GeometryNode` for geometry that
is itself the subject, `useStages()` for the stepping, and `pixelSize` for
step 8.
