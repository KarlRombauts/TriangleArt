import type { ImageLike } from "../engine/brightness";

export type LoadedImage = { image: ImageLike; width: number; height: number };

function imageToData(img: HTMLImageElement): LoadedImage {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    image: { data: data.data, width: canvas.width, height: canvas.height },
    width: canvas.width,
    height: canvas.height,
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
