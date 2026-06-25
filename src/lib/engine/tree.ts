import { add, mag, scale, sub, longestEdge, triangleArea, type Point, type Segment } from "./geometry";

export class TreeNode {
  parent: TreeNode | null;
  points: Point[];
  children: TreeNode[] = [];
  depth: number;
  /** Cutoff cap inherited from ancestors; keeps emitted cutoffs monotone. */
  inheritedCutoff = Infinity;

  constructor(parent: TreeNode | null, points: Point[]) {
    this.parent = parent;
    this.points = points;
    this.depth = 1 + (parent?.depth ?? 0);
  }

  get area(): number {
    const p = this.points;
    if (p.length === 3) return triangleArea(p[0], p[1], p[2]);
    // Rectangle: adjacent edges from p0 are p0->p1 and p0->p3 (p2 is the diagonal corner).
    return mag(sub(p[1], p[0])) * mag(sub(p[3], p[0]));
  }

  /** Seed split: rectangle -> two triangles along its diagonal p0->p2. */
  divideRectangle(): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    this.children = [
      new TreeNode(this, [p[1], p[2], p[0]]),
      new TreeNode(this, [p[3], p[0], p[2]]),
    ];
    const seg: Segment = { x1: p[0].x, y1: p[0].y, x2: p[2].x, y2: p[2].y, cutoff: Infinity };
    return { children: this.children, segments: [seg] };
  }

  /**
   * Split the longest edge at parameter `s`: a cut from the opposite vertex `v`
   * to `m = e0 + s*(e1-e0)`. Children are (v,e0,m) and (v,m,e1), sharing the new
   * edge v->m. cutoff is a placeholder; the generator sets it.
   */
  splitTriangle(s: number): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    const { v, e0, e1 } = longestEdge(p[0], p[1], p[2]);
    const m = add(e0, scale(sub(e1, e0), s));
    this.children = [new TreeNode(this, [v, e0, m]), new TreeNode(this, [v, m, e1])];
    const seg: Segment = { x1: v.x, y1: v.y, x2: m.x, y2: m.y, cutoff: Infinity };
    return { children: this.children, segments: [seg] };
  }
}

export function createRectangle(center: Point, width: number, height: number): TreeNode {
  const hw = width / 2;
  const hh = height / 2;
  return new TreeNode(null, [
    { x: center.x - hw, y: center.y - hh },
    { x: center.x - hw, y: center.y + hh },
    { x: center.x + hw, y: center.y + hh },
    { x: center.x + hw, y: center.y - hh },
  ]);
}

export function createImageRectangle(width: number, height: number): TreeNode {
  return createRectangle({ x: width / 2, y: height / 2 }, width, height);
}

export function rectangleBorderSegments(node: TreeNode): Segment[] {
  const p = node.points;
  return p.map((pt, i) => {
    const n = p[(i + 1) % p.length];
    return { x1: pt.x, y1: pt.y, x2: n.x, y2: n.y, cutoff: Infinity };
  });
}
