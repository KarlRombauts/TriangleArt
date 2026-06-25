import type { SubdivideOn } from "./generator";

/** Perceived luminance (0-255) of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Which tone should densify, given the chosen colours. Density is encoded by line
 * coverage, so if the line is lighter than the background, dense regions read as
 * bright -> subdivide bright regions; otherwise subdivide dark ones. This keeps
 * the result representational when the colours are inverted.
 */
export function derivePolarity(line: string, background: string): SubdivideOn {
  return relativeLuminance(line) >= relativeLuminance(background) ? "bright" : "dark";
}
