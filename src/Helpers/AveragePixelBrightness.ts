import p5Types, { Vector } from "p5";

export function lerp(A: number, B: number, t: number): number {
  return A + (B - A) * t;
}

function pixelBrightness(pixel: number[]) {
  const r = pixel[0]
  const g = pixel[1]
  const b = pixel[2]
  return Math.floor((r + g + b) / 3);
}

export function getAverageBrightnessInTriangle(img: p5Types.Image, corners: Vector[], maxSample = 1000): number {
  const p = corners
  const base = Vector.sub(p[1], p[0])
  const height = Vector.sub(p[2], p[0])
  const baseMag = base.mag()
  const heightMag = height.mag()

  const totalPixels = Math.abs(baseMag * heightMag / 2)
  const stepSize = Math.round(Math.sqrt(totalPixels / Math.min(totalPixels, maxSample)))

  let sum = 0
  let total = 0
  for (let i = 0; i < baseMag; i += stepSize) {
    const baseCompletion = i / baseMag
    const verticalPixels = lerp(heightMag, 1, baseCompletion)
    for (let j = 0; j < verticalPixels; j += stepSize) {
      const heightCompletion = j / heightMag
      const position = p[0].copy()
        .add(height.copy().mult(heightCompletion))
        .add(base.copy().mult(baseCompletion))

      const x = Math.round(position.x)
      const y = Math.round(position.y)
      const pixel = img.get(x,y)

      sum += pixel[0] + pixel[1] + pixel[2]
      total++
    }
  }
  return sum / (total * 3) // multiply by three as there are three colour channels
}

function getAverageBrightnessInRect(img: p5Types.Image, corner: Vector, width: number, height: number) {
  const totalPixels = width * height
  let sum = 0;

  for (let i = 0; i < Math.abs(width); i++) {
    for (let j = 0; j < Math.abs(height); j++) {
      const x = corner.x + Math.sign(width) * i
      const y = corner.y + Math.sign(height) * j
      sum += pixelBrightness(img.get(x,y))
    }
  }
  return sum / totalPixels
}
