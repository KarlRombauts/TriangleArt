import { add, dot, mag, normalize, scale, sub, type Point, type Segment } from "./geometry";

export class TreeNode {
  parent: TreeNode | null;
  points: Point[];
  children: TreeNode[] = [];
  depth: number;

  constructor(parent: TreeNode | null, points: Point[]) {
    this.parent = parent;
    this.points = points;
    this.depth = 1 + (parent?.depth ?? 0);
  }

  get area(): number {
    const p = this.points;
    if (p.length === 3) {
      // Right-angle triangle: legs run from p0 to p1 and p0 to p2.
      return (mag(sub(p[1], p[0])) * mag(sub(p[2], p[0]))) / 2;
    }
    // Rectangle: adjacent edges from p0 are p0->p1 and p0->p3 (p2 is the diagonal corner).
    return mag(sub(p[1], p[0])) * mag(sub(p[3], p[0]));
  }

  divide(): { children: TreeNode[]; segments: Segment[] } {
    if (this.points.length === 4) return this.divideRectangle();
    if (this.points.length === 3) return this.divideTriangle();
    throw new Error("Cannot divide polygon with more than 4 sides");
  }

  private divideRectangle(): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    this.children = [
      new TreeNode(this, [p[1], p[2], p[0]]),
      new TreeNode(this, [p[3], p[0], p[2]]),
    ];
    // The two triangles share the rectangle's diagonal p0 -> p2.
    const seg: Segment = { x1: p[0].x, y1: p[0].y, x2: p[2].x, y2: p[2].y };
    return { children: this.children, segments: [seg] };
  }

  private divideTriangle(): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    const hyp = sub(p[2], p[1]);
    const side = sub(p[0], p[1]);
    const unit = normalize(hyp);
    const bisector = add(scale(unit, dot(unit, side)), p[1]);
    this.children = [
      new TreeNode(this, [bisector, p[0], p[1]]),
      new TreeNode(this, [bisector, p[0], p[2]]),
    ];
    // The new dividing line shared by both children is bisector -> p0.
    const seg: Segment = { x1: bisector.x, y1: bisector.y, x2: p[0].x, y2: p[0].y };
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
    return { x1: pt.x, y1: pt.y, x2: n.x, y2: n.y };
  });
}
