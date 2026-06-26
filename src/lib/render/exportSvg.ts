import type { Segment } from "../engine/geometry";
import type { RenderStyle } from "./canvasRenderer";

export function segmentsToSvg(
  segments: Segment[],
  width: number,
  height: number,
  style: RenderStyle,
): string {
  const lines = segments
    .map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" />`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${style.background}" />` +
    `<g stroke="${style.line}" stroke-width="${style.lineWidth}" stroke-linecap="round">${lines}</g>` +
    `</svg>`
  );
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
