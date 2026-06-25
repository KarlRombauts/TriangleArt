import { triangleArea, type Point } from "./geometry";

export type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number };
/** `mean` is the triangle's average luminosity; the generator multiplies it by area. */
export type TriangleAnalysis = { mean: number };

const MAX_STRIDE = 3;

function sign(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

/**
 * Average luminosity of a triangle (sampled across its interior with a capped
 * stride so large triangles can't skip over features). Coordinates are clamped to
 * image bounds. Returns null if the triangle is below `minArea` or can't be
 * sampled.
 */
export function analyzeTriangle(
  img: ImageLike,
  points: Point[],
  minArea = 1,
): TriangleAnalysis | null {
  const [A, B, C] = points;
  const area = triangleArea(A, B, C);
  if (area < minArea) return null;

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

  let total = 0;
  let sum = 0;
  for (let y = minBy; y <= maxBy; y += stride) {
    for (let x = minBx; x <= maxBx; x += stride) {
      const d1 = sign(x, y, A.x, A.y, B.x, B.y);
      const d2 = sign(x, y, B.x, B.y, C.x, C.y);
      const d3 = sign(x, y, C.x, C.y, A.x, A.y);
      if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue; // outside
      const idx = (y * width + x) * 4;
      sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      total++;
    }
  }
  if (total < 2) return null;
  return { mean: sum / total };
}
