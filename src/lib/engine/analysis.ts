import {
  add,
  scale,
  sub,
  triangleArea,
  longestEdge,
  triangleMinAngleDeg,
  raySegmentParam,
  type Point,
} from "./geometry";

export type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number };
export type TriangleAnalysis = { score: number; splitParam: number };

const BINS = 24;
const MAX_STRIDE = 3;
const MIN_ANGLE_DEG = 10;

function sign(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

/**
 * Find the best longest-edge split for a triangle: the cut (cevian from the
 * vertex opposite the longest edge) that maximizes the brightness difference
 * between the two halves (1-D Otsu over the fan coordinate), subject to a minimum
 * child angle. The returned `score` is the triangle's edge strength (between-class
 * variance); `splitParam` is where on the longest edge to cut. Returns null if the
 * triangle is below `minArea`, has too few samples, or has no valid (non-sliver)
 * split.
 */
export function analyzeTriangle(
  img: ImageLike,
  points: Point[],
  minArea = 1,
): TriangleAnalysis | null {
  const [A, B, C] = points;
  const area = triangleArea(A, B, C);
  if (area < minArea) return null;

  const { v, e0, e1 } = longestEdge(A, B, C);
  const { data, width, height } = img;
  const maxX = width - 1;
  const maxY = height - 1;

  const minBx = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)));
  const maxBx = Math.min(maxX, Math.ceil(Math.max(A.x, B.x, C.x)));
  const minBy = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)));
  const maxBy = Math.min(maxY, Math.ceil(Math.max(A.y, B.y, C.y)));

  let stride = Math.round(Math.sqrt(area / 64));
  if (stride > MAX_STRIDE) stride = MAX_STRIDE;
  if (stride < 1) stride = 1;

  const binCount = new Float64Array(BINS);
  const binSum = new Float64Array(BINS);
  let total = 0;
  let totalSum = 0;

  for (let y = minBy; y <= maxBy; y += stride) {
    for (let x = minBx; x <= maxBx; x += stride) {
      const d1 = sign(x, y, A.x, A.y, B.x, B.y);
      const d2 = sign(x, y, B.x, B.y, C.x, C.y);
      const d3 = sign(x, y, C.x, C.y, A.x, A.y);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (hasNeg && hasPos) continue; // outside the triangle

      const idx = (y * width + x) * 4;
      const b = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const u = raySegmentParam(v, { x, y }, e0, e1);
      let k = Math.floor(u * BINS);
      if (k >= BINS) k = BINS - 1;
      if (k < 0) k = 0;
      binCount[k]++;
      binSum[k] += b;
      total++;
      totalSum += b;
    }
  }
  if (total < 2) return null;

  let leftCount = 0;
  let leftSum = 0;
  let bestScore = -1;
  let bestS = 0.5;
  for (let k = 0; k < BINS - 1; k++) {
    leftCount += binCount[k];
    leftSum += binSum[k];
    const rightCount = total - leftCount;
    if (leftCount === 0 || rightCount === 0) continue;
    const s = (k + 1) / BINS;
    const m = add(e0, scale(sub(e1, e0), s));
    if (
      triangleMinAngleDeg(v, e0, m) < MIN_ANGLE_DEG ||
      triangleMinAngleDeg(v, m, e1) < MIN_ANGLE_DEG
    )
      continue;
    const m1 = leftSum / leftCount;
    const m2 = (totalSum - leftSum) / rightCount;
    const w1 = leftCount / total;
    const w2 = rightCount / total;
    const score = w1 * w2 * (m1 - m2) * (m1 - m2);
    if (score > bestScore) {
      bestScore = score;
      bestS = s;
    }
  }
  if (bestScore < 0) return null; // no valid (non-sliver) split
  return { score: bestScore, splitParam: bestS };
}
