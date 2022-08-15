import {Vector} from "p5"

export class TreeNode {
  public parent: TreeNode | null
  public points: Vector[];
  public children: TreeNode[]
  public depth: number

  constructor(parent: TreeNode | null, points: Vector[]) {
    this.parent = parent
    this.points = points
    this.children = []
    this.depth = 1 + (this.parent?.depth || 0)
  }

  public divide() {
    switch (this.points.length) {
      case 4:
        this.divideRectangle()
        break
      case 3:
        this.divideTriangle()
        break
      default:
        throw new Error("Cannot divide polygon with more than 4 sides")
    }
    return this.children
  }

  private divideTriangle() {
    const p = this.points
    const hypotenuse = Vector.sub(p[2], p[1])
    const side = Vector.sub(p[0], p[1])
    const bisectorPoint = hypotenuse.setMag(hypotenuse.normalize().dot(side)).add(p[1])

    this.children = [
      new TreeNode(this, [bisectorPoint, p[0], p[1]]),
      new TreeNode(this, [bisectorPoint, p[0], p[2]])
    ]
  }

  private divideRectangle() {
    const p = this.points
    this.children = [
      new TreeNode(this, [p[1], p[2], p[0]]),
      new TreeNode(this, [p[3], p[0], p[2]]),
    ]
    console.log(this)
  }

  public get area() {
    const p = this.points
    const area = p[1].copy().sub(p[0]).mag() * p[2].copy().sub(p[0]).mag()
    if (p.length === 3) {
      return area / 2
    }
    return area
  }

  isFirstChild() {
    return this.parent?.children.indexOf(this) === 0;
  }
}

export function createRectangle(center: Vector, width: number, height: number) {
  const halfHeight = height / 2
  const halfWidth = width / 2

  const p0 = center.copy().add(-halfWidth, -halfHeight)
  const p1 = center.copy().add(-halfWidth, halfHeight)
  const p2 = center.copy().add(halfWidth, halfHeight)
  const p3 = center.copy().add(halfWidth, -halfHeight)
  return new TreeNode(null, [p0, p1, p2, p3])
}

