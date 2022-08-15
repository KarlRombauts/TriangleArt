import p5Types, { Vector } from "p5";
import { TreeNode } from "./Tree";

export function drawLine(p5: p5Types, start: Vector, end: Vector) {
  p5.stroke(255);
  p5.strokeWeight(1.5)
  p5.line(start.x, start.y, end.x, end.y);
}

export function drawNode(p5: p5Types, node: TreeNode) {
  const p = node.points
  if (!node.parent) {
    // If there is no parent (first node) we draw all the edges
    for (let i = 0; i < p.length; i++) {
      drawLine(p5, p[i], p[(i + 1) % p.length])
    }
  } else {
    if (node.depth === 2 && node.isFirstChild()) {
      // If one of the first triangles (children of rectangle) draw the hypotenuse
      drawLine(p5, p[1], p[2])
    }
  }

  if (node.isFirstChild()) {
    // If any other child node, only draw the new dividing line. Note that this line is shared between two triangles
    // So we only draw the line of the first child
    drawLine(p5, p[0], p[1])
  }

  // Recursively draw the children
  for (const child of node.children) {
    drawNode(p5, child)
  }
}