import { MeshNode, Node, Playground, axes, grid } from "../../viz";
import type { ParameterDescriptor } from "../../gl";

/**
 * What "parent" means for a transform.
 *
 * A three-link arm. Each joint carries its own set of axes, and each one is
 * placed relative to its parent - never relative to the world. Rotating the
 * shoulder moves the whole arm, because every child's world matrix is its own
 * transform composed with everything above it. Rotating the wrist moves only
 * the hand.
 *
 * The axes are the point: watch a child's axes swing when you rotate its
 * parent, while the numbers describing that child never change.
 */
export default class Scene extends Playground {
  #shoulder!: Node;
  #elbow!: Node;
  #wrist!: Node;

  setup() {
    this.viewer.set({ target: [0, 1.8, 0], fov: 48 });
    this.viewer.setOrbit(38, 12, 8.5);

    this.scene.add(grid({ size: 10, step: 1 }));
    this.scene.add(axes({ name: "world", size: 1.5 }));

    // A joint's -z is "along the limb", so the base tips the whole chain
    // upright without any of the joints having to know about it.
    const base = this.scene.add(new Node());
    base.transform.setPosition([0, 0.4, 0]).setEuler([90, 0, 0]);

    this.#shoulder = this.#joint("shoulder", base, [0, 0, 0], [0.95, 0.72, 0.3]);
    this.#elbow = this.#joint("elbow", this.#shoulder, [0, 0, -1], [0.45, 0.85, 0.6]);
    this.#wrist = this.#joint("wrist", this.#elbow, [0, 0, -1], [0.6, 0.7, 1]);

    // A hand, so the far end of the chain is easy to follow.
    const hand = this.#wrist.add(
      new MeshNode({ shape: "sphere", wireframe: false, scale: 0.45, color: [1, 0.5, 0.5] }),
    );
    hand.transform.setPosition([0, 0, -1]);

    this.label("shoulder", this.#shoulder, { offset: [0, 0.45, 0] });
    this.label("elbow", this.#elbow, { offset: [0, 0.45, 0] });
    this.label("wrist", this.#wrist, { offset: [0, 0.45, 0] });
  }

  /**
   * A joint is an unscaled node; the box that makes it visible hangs off it
   * as a child.
   *
   * That separation matters. Scale is inherited like everything else, so
   * putting it on the joint itself would stretch every joint below it, and
   * the arm would fold into a heap. Keep transforms that mean "where this
   * part is" apart from transforms that mean "what this part looks like".
   */
  #joint(name: string, parent: Node, position: [number, number, number], color: [number, number, number]) {
    const joint = parent.add(new Node({ name }));
    joint.transform.setPosition(position);
    joint.add(axes({ size: 0.8 }));

    const limb = joint.add(new MeshNode({ shape: "box", scale: [0.3, 0.3, 1], color }));
    limb.transform.setPosition([0, 0, -0.5]);

    return joint;
  }

  #slider(title: string, node: () => Node, axis: 0 | 1): ParameterDescriptor {
    return {
      title,
      type: "number",
      min: -120,
      max: 120,
      step: 1,
      initial: 0,
      update: (value: number) => {
        const euler: [number, number, number] = [0, 0, 0];
        euler[axis] = value;
        node().transform.setEuler(euler);
      },
    };
  }

  get params(): ParameterDescriptor[] {
    return [
      this.#slider("Shoulder", () => this.#shoulder, 1),
      this.#slider("Shoulder lift", () => this.#shoulder, 0),
      this.#slider("Elbow", () => this.#elbow, 0),
      this.#slider("Wrist", () => this.#wrist, 0),
    ];
  }
}
