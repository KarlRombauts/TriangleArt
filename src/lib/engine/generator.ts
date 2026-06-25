import type { Segment } from "./geometry";
import { createImageRectangle, rectangleBorderSegments, TreeNode } from "./tree";
import { analyzeTriangle, type ImageLike } from "./analysis";

export type SubdivideOn = "bright" | "dark";
export type GeneratorOptions = {
  threshold: number;
  subdivideOn?: SubdivideOn;
  maxNodes?: number;
  minArea?: number;
};

/**
 * Adaptive, edge-following triangle subdivision. The seed rectangle splits along
 * its diagonal; each triangle is then split across its longest edge at the point
 * of strongest brightness change (`analyzeTriangle`), as long as that edge
 * strength clears the threshold. Emitted segment cutoffs are capped to the
 * parent's so they stay monotone — letting the renderer filter by detail without
 * recomputing, exactly equal to a fresh build at that threshold.
 */
export class TriangleGenerator {
  segments: Segment[] = [];
  done = true;

  private img!: ImageLike;
  private opts!: Required<GeneratorOptions>;
  private frontier: TreeNode[] = [];
  private head = 0;
  private nodeCount = 0;
  private imageArea = 1;

  reset(img: ImageLike, opts: GeneratorOptions): void {
    this.img = img;
    this.opts = { maxNodes: 1_000_000, minArea: 1, subdivideOn: "bright", ...opts };
    this.imageArea = Math.max(1, img.width * img.height);
    const root = createImageRectangle(img.width, img.height);
    root.inheritedCutoff = Infinity;
    this.frontier = [root];
    this.head = 0;
    this.nodeCount = 1;
    this.segments = rectangleBorderSegments(root); // cutoff Infinity
    this.done = false;
  }

  step(n: number): Segment[] {
    const emitted: Segment[] = [];
    let processed = 0;
    while (processed < n && this.head < this.frontier.length) {
      if (this.nodeCount >= this.opts.maxNodes) {
        this.done = true;
        break;
      }
      const node = this.frontier[this.head++];
      processed++;

      if (node.points.length === 4) {
        // Seed rectangle -> two triangles along the diagonal (always).
        const { children, segments } = node.divideRectangle();
        for (const c of children) c.inheritedCutoff = Infinity;
        for (const s of segments) {
          this.segments.push(s);
          emitted.push(s);
        }
        this.frontier.push(...children);
        this.nodeCount += children.length;
        continue;
      }

      const analysis = analyzeTriangle(this.img, node.points, this.opts.minArea);
      if (!analysis) continue; // too small / can't sample
      // Density follows luminosity weighted by area. `subdivideOn` flips which
      // tone densifies so the result stays representational when colours invert
      // (line lighter than background -> "bright"; darker -> "dark").
      const metric = this.opts.subdivideOn === "bright" ? analysis.mean : 255 - analysis.mean;
      const cutoff = (metric * node.area) / this.imageArea;
      const effective = Math.min(node.inheritedCutoff, cutoff);
      if (effective < this.opts.threshold) continue;

      const { children, segments } = node.splitTriangle(analysis.splitParam);
      for (const c of children) c.inheritedCutoff = effective;
      for (const s of segments) {
        s.cutoff = effective;
        this.segments.push(s);
        emitted.push(s);
      }
      this.frontier.push(...children);
      this.nodeCount += children.length;
    }
    if (this.head >= this.frontier.length) this.done = true;
    return emitted;
  }
}
