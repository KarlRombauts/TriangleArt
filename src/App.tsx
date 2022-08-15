import p5Types from "p5";
import React from 'react'
import Sketch from "react-p5";
import { getAverageBrightnessInTriangle } from "./Helpers/AveragePixelBrightness";
import { drawNode } from "./Helpers/Drawing";
import { createImageRectangle } from "./Helpers/Image";
import { TreeNode } from "./Helpers/Tree";
import { TuringImage } from "./Images/Turing";

export const App: React.FC = () => {
  let treeNode: TreeNode
  let img: p5Types.Image;

  const preload = (p5: p5Types) => {
    img = p5.loadImage(TuringImage)
  }

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(img.width, img.height).parent(canvasParentRef);
    treeNode = createImageRectangle(img)

    setTimeout(() => {
      let currentNode: TreeNode | undefined = treeNode
      const frontier = []
      const imageArea = img.width * img.height
      const brightnessThreshold = 0.01
      const maxSamples = 10

      for (let i = 0; i < 1_000_000; i++) {
        if (currentNode) {
          const brightness = getAverageBrightnessInTriangle(img, currentNode.points, maxSamples)

          if (brightness < (imageArea / currentNode.area) * brightnessThreshold) {
            currentNode = frontier.shift()
            continue
          }

          const newNodes: TreeNode[] = currentNode.divide()
          frontier.push(...newNodes)
          currentNode = frontier.shift()
        }
      }
    }, 200) // Set a short timeout to ensure image pixels are loaded correctly
  };

  const draw = (p5: p5Types) => {
    p5.background(0);
    drawNode(p5, treeNode)
  };

  return <Sketch preload={preload} setup={setup} draw={draw} />;
};
