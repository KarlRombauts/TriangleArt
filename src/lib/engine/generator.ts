import type { Segment } from "./geometry";
import { createImageRectangle, rectangleBorderSegments, TreeNode } from "./tree";
import { getAverageBrightnessInTriangle, type ImageLike } from "./brightness";

export type SubdivideOn = "bright" | "dark";

export type GeneratorOptions = {
  threshold: number;
  subdivideOn: SubdivideOn;
  maxSamples?: number;
  maxNodes?: number;
  minArea?: number;
};

/**
 * Stateful, incremental triangle subdivision. `reset` seeds the root rectangle;
 * `step(n)` processes up to n frontier nodes per call (drive it from a rAF loop).
 * The shared segment list is the single source of truth for both canvas
 * rendering and SVG export.
 */
export class TriangleGenerator {
  segments: Segment[] = [];
  done = true;

  private img!: ImageLike;
  private opts!: Required<GeneratorOptions>;
  private frontier: TreeNode[] = [];
  private head = 0;
  private imageArea = 0;
  private nodeCount = 0;

  reset(img: ImageLike, opts: GeneratorOptions): void {
    this.img = img;
    this.opts = { maxSamples: 10, maxNodes: 1_000_000, minArea: 1, ...opts };
    this.imageArea = img.width * img.height;
    const root = createImageRectangle(img.width, img.height);
    this.frontier = [root];
    this.head = 0;
    this.nodeCount = 1;
    this.segments = rectangleBorderSegments(root);
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
      if (node.area < this.opts.minArea) continue;

      const brightness = getAverageBrightnessInTriangle(
        this.img,
        node.points,
        this.opts.maxSamples,
      );
      const metric = this.opts.subdivideOn === "bright" ? brightness : 255 - brightness;
      // Threshold below which this node subdivides. Tagging each emitted segment
      // with it lets the renderer filter by detail level without recomputing.
      const cutoff = (metric * node.area) / this.imageArea;
      if (cutoff < this.opts.threshold) continue;

      const { children, segments } = node.divide();
      this.frontier.push(...children);
      this.nodeCount += children.length;
      for (const s of segments) {
        s.cutoff = cutoff;
        this.segments.push(s);
        emitted.push(s);
      }
    }
    if (this.head >= this.frontier.length) this.done = true;
    return emitted;
  }
}
