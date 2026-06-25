export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number; cutoff: number };

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v: Point, s: number): Point => ({ x: v.x * s, y: v.y * s });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const mag = (v: Point): number => Math.sqrt(v.x * v.x + v.y * v.y);

export const normalize = (v: Point): Point => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};

export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

export function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs(cross(sub(b, a), sub(c, a))) / 2;
}

/** Returns the vertex `v` opposite the longest edge, and that edge's endpoints. */
export function longestEdge(a: Point, b: Point, c: Point): { v: Point; e0: Point; e1: Point } {
  const ab = mag(sub(b, a));
  const bc = mag(sub(c, b));
  const ca = mag(sub(a, c));
  if (ab >= bc && ab >= ca) return { v: c, e0: a, e1: b };
  if (bc >= ab && bc >= ca) return { v: a, e0: b, e1: c };
  return { v: b, e0: c, e1: a };
}

export function triangleMinAngleDeg(a: Point, b: Point, c: Point): number {
  const angleAt = (p: Point, q: Point, r: Point): number => {
    const m = mag(sub(q, p)) * mag(sub(r, p));
    if (m === 0) return 0;
    const cosA = dot(sub(q, p), sub(r, p)) / m;
    return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  };
  return Math.min(angleAt(a, b, c), angleAt(b, a, c), angleAt(c, a, b));
}

/** Parameter u in [0,1] (clamped) where the ray v→x crosses segment e0→e1. */
export function raySegmentParam(v: Point, x: Point, e0: Point, e1: Point): number {
  const d = sub(x, v);
  const e = sub(e1, e0);
  const denom = cross(e, d);
  if (denom === 0) return 0.5; // parallel: fall back to midpoint
  const u = cross(sub(v, e0), d) / denom;
  return u < 0 ? 0 : u > 1 ? 1 : u;
}
