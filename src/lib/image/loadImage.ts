import type { ImageLike } from "../engine/brightness";
import { IMAGE_MAX_EDGE } from "../constants";

export type LoadedImage = { image: ImageLike; width: number; height: number };

function imageToData(img: HTMLImageElement): LoadedImage {
  // Cap the long edge so generation stays bounded and the bitmap export stays a
  // sensible size, no matter how large the source (sample or user upload) is.
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return {
    image: { data: data.data, width, height },
    width,
    height,
  };
}

export function loadImageFromSrc(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        resolve(imageToData(img));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}`));
    img.src = src;
  });
}

export function loadImageFromFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadImageFromSrc(reader.result as string).then(resolve, reject);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
