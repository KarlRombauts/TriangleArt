import type { Segment } from "../engine/geometry";

export type RenderStyle = {
  background: string;
  line: string;
  lineWidth: number;
};

export function clearCanvas(ctx: CanvasRenderingContext2D, style: RenderStyle): void {
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** Strokes the given segments without clearing (used incrementally per frame). */
export function drawSegments(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  style: RenderStyle,
): void {
  ctx.strokeStyle = style.line;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const s of segments) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
}

/** Clears then redraws every segment (used on style change / full redraw). */
export function redrawAll(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  style: RenderStyle,
): void {
  clearCanvas(ctx, style);
  drawSegments(ctx, segments, style);
}
