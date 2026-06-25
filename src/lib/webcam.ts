import type { ImageLike } from "./engine/analysis";

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

/** Encodes a captured frame as a PNG data URL (used to keep the original of a
 *  frozen webcam frame for the before/after compare). */
export function imageToDataUrl(image: ImageLike): string {
  if (!scratch) return "";
  scratch.width = image.width;
  scratch.height = image.height;
  const ctx = scratch.getContext("2d");
  if (!ctx) return "";
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  out.set(image.data as ArrayLike<number>);
  ctx.putImageData(new ImageData(out, image.width, image.height), 0, 0);
  return scratch.toDataURL("image/png");
}
