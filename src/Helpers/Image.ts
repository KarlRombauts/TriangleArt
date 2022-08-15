import { Image, Vector } from "p5"
import { createRectangle, TreeNode } from "./Tree";

export function getImageCenter(img: Image): Vector {
  return new Vector(img.width/2, img.height/2)
}

export function createImageRectangle(img: Image): TreeNode {
  return createRectangle(getImageCenter(img), img.width, img.height)
}
