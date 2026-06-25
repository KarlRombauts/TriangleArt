import { mag, sub, type Point } from "./geometry";

// ImageLike now lives in analysis.ts; re-exported here so existing importers keep
// compiling until they are repointed (this file is deleted in a later task).
export type { ImageLike } from "./analysis";
import type { ImageLike } from "./analysis";

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Maximum gap (in pixels) between samples. Capping the stride means even a very
// large triangle samples every few pixels, so it can't skip over thin features
// (which caused big triangles to straddle sharp edges) and its mean is stable
// in noisy regions (which caused speckle artifacts). Large triangles are few, so
// the extra samples are cheap.
const MAX_STRIDE = 3;

/**
 * Mean brightness (0-255) of pixels sampled across a triangle.
 *
 * Coordinates are clamped to [0, width-1] x [0, height-1] before indexing the
 * raw pixel array: triangle corners sit on the image edges, so samples can round
 * to x === width or y === height. An out-of-range read on a flat pixel array
 * returns `undefined`, which poisons the sum with NaN and (because `NaN < x` is
 * always false) drives unbounded subdivision. The clamp matches the old
 * `img.get()` behaviour.
 */
export function getAverageBrightnessInTriangle(
  img: ImageLike,
  corners: Point[],
  maxSample = 1000,
): number {
  const p = corners;
  const base = sub(p[1], p[0]);
  const height = sub(p[2], p[0]);
  const baseMag = mag(base);
  const heightMag = mag(height);

  const totalPixels = Math.abs((baseMag * heightMag) / 2);
  let stepSize = Math.round(Math.sqrt(totalPixels / Math.min(totalPixels, maxSample)));
  if (stepSize > MAX_STRIDE) stepSize = MAX_STRIDE;
  if (stepSize < 1) stepSize = 1;

  const { data, width } = img;
  const maxX = width - 1;
  const maxY = img.height - 1;

  let sum = 0;
  let total = 0;
  for (let i = 0; i < baseMag; i += stepSize) {
    const baseCompletion = i / baseMag;
    const verticalPixels = lerp(heightMag, 1, baseCompletion);
    for (let j = 0; j < verticalPixels; j += stepSize) {
      const heightCompletion = j / heightMag;

      let x = Math.round(p[0].x + height.x * heightCompletion + base.x * baseCompletion);
      let y = Math.round(p[0].y + height.y * heightCompletion + base.y * baseCompletion);
      if (x < 0) x = 0;
      else if (x > maxX) x = maxX;
      if (y < 0) y = 0;
      else if (y > maxY) y = maxY;

      const idx = (y * width + x) * 4;
      sum += data[idx] + data[idx + 1] + data[idx + 2];
      total++;
    }
  }
  return sum / (total * 3);
}
