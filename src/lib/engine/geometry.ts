export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v: Point, s: number): Point => ({ x: v.x * s, y: v.y * s });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const mag = (v: Point): number => Math.sqrt(v.x * v.x + v.y * v.y);

export const normalize = (v: Point): Point => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
