import type { ImageLike } from "./engine/brightness";

export async function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
}

const scratch = typeof document !== "undefined" ? document.createElement("canvas") : null;

/**
 * Draws the current video frame to an offscreen canvas (scaled so its long edge
 * is at most `maxEdge`) and returns the pixel data for triangulation.
 */
export function captureFrame(
  video: HTMLVideoElement,
  maxEdge: number,
): { image: ImageLike; width: number; height: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !scratch) return null;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return { image: { data: data.data, width: w, height: h }, width: w, height: h };
}
