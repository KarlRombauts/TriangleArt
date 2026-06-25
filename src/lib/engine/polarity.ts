import type { SubdivideOn } from "./generator";

/** Perceived luminance (0-255) of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Subdivision direction is coupled to the colors: density of "ink" (lines) is
 * what encodes tone. If the line is lighter than the background, more lines read
 * as brighter, so we subdivide bright regions; otherwise we subdivide dark ones.
 */
export function derivePolarity(line: string, background: string): SubdivideOn {
  return relativeLuminance(line) >= relativeLuminance(background) ? "bright" : "dark";
}
