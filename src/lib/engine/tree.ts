import {
  add,
  dot,
  mag,
  scale,
  sub,
  rotate,
  raySegmentParam,
  triangleArea,
  triangleMinAngleDeg,
  type Point,
  type Segment,
} from "./geometry";

const MIN_ANGLE_DEG = 10;
const JITTER_DEG = 10;

/** Deterministic pseudo-random in [0,1) from a point — keeps builds reproducible. */
function hash01(p: Point): number {
  const v = Math.sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Foot on segment e0-e1 of the ray from v through `aim`. */
function footOf(v: Point, aim: Point, e0: Point, e1: Point): Point {
  const u = raySegmentParam(v, aim, e0, e1);
  return add(e0, scale(sub(e1, e0), u));
}

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
   * Split a triangle with a cut from p0 to the opposite edge p1-p2. The base cut
   * is the perpendicular (altitude) foot — the classic right-angle bisection —
   * rotated about p0 by a deterministic ±JITTER_DEG to break up the rigid
   * pinwheel pattern. The jitter is reduced if it would push either child below
   * MIN_ANGLE_DEG (no slivers). Children are (foot,p0,p1) and (foot,p0,p2),
   * sharing the new edge foot->p0. cutoff is a placeholder; the generator sets it.
   */
  divideTriangle(): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    const e = sub(p[2], p[1]);
    const eLen2 = dot(e, e) || 1;
    const t0 = Math.max(0, Math.min(1, dot(sub(p[0], p[1]), e) / eLen2));
    const foot0 = add(p[1], scale(e, t0)); // perpendicular (altitude) foot

    const centroid = scale(add(add(p[0], p[1]), p[2]), 1 / 3);
    let delta = (hash01(centroid) * 2 - 1) * JITTER_DEG;
    let foot = delta === 0 ? foot0 : footOf(p[0], add(p[0], rotate(sub(foot0, p[0]), delta)), p[1], p[2]);

    let guard = 0;
    while (
      guard++ < 8 &&
      (triangleMinAngleDeg(foot, p[0], p[1]) < MIN_ANGLE_DEG ||
        triangleMinAngleDeg(foot, p[0], p[2]) < MIN_ANGLE_DEG)
    ) {
      delta *= 0.5;
      foot = delta === 0 ? foot0 : footOf(p[0], add(p[0], rotate(sub(foot0, p[0]), delta)), p[1], p[2]);
      if (Math.abs(delta) < 0.01) {
        foot = foot0;
        break;
      }
    }

    this.children = [new TreeNode(this, [foot, p[0], p[1]]), new TreeNode(this, [foot, p[0], p[2]])];
    const seg: Segment = { x1: foot.x, y1: foot.y, x2: p[0].x, y2: p[0].y, cutoff: Infinity };
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
