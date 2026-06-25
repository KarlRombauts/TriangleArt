import type { ImageLike } from "../engine/analysis";
import type { Segment } from "../engine/geometry";
import { TriangleGenerator } from "../engine/generator";
import { BUILD_BATCH } from "../constants";
import {
  decodeSegments,
  type LoadOptions,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol";

type BatchCb = (segs: Segment[], done: boolean) => void;

/**
 * Main-thread wrapper around the generator worker. Streams segment batches for
 * still images (`load`) and returns a full segment list per webcam frame
 * (`frame`). Falls back to running the generator on the main thread if workers
 * are unavailable. A monotonic request id lets stale responses be ignored.
 */
export class GeneratorClient {
  private worker: Worker | null = null;
  private id = 0;
  private loadCbs = new Map<number, BatchCb>();
  private frameResolvers = new Map<number, (s: Segment[]) => void>();
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    try {
      this.worker = new Worker(new URL("./generator.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
      this.worker.onerror = () => {
        this.worker = null; // fall back on a runtime worker error
      };
    } catch {
      this.worker = null;
    }
  }

  private onMessage(res: WorkerResponse) {
    const segs = decodeSegments(new Float32Array(res.buffer));
    const frameResolve = this.frameResolvers.get(res.id);
    if (frameResolve) {
      this.frameResolvers.delete(res.id);
      frameResolve(segs);
      return;
    }
    const cb = this.loadCbs.get(res.id);
    if (!cb) return; // stale (superseded request)
    cb(segs, res.done);
    if (res.done) this.loadCbs.delete(res.id);
  }

  load(image: ImageLike, opts: LoadOptions, onBatch: BatchCb): void {
    const id = ++this.id;
    this.loadCbs.clear(); // supersede prior loads
    this.cancelFallback();
    if (this.worker) {
      this.loadCbs.set(id, onBatch);
      const buf = toBuffer(image);
      const req: WorkerRequest = {
        type: "load",
        id,
        width: image.width,
        height: image.height,
        buffer: buf,
        opts,
        batch: BUILD_BATCH,
      };
      this.worker.postMessage(req, [buf]);
    } else {
      this.runFallback(image, opts, onBatch);
    }
  }

  frame(image: ImageLike, opts: LoadOptions): Promise<Segment[]> {
    const id = ++this.id;
    if (this.worker) {
      const buf = toBuffer(image);
      return new Promise((resolve) => {
        this.frameResolvers.set(id, resolve);
        const req: WorkerRequest = {
          type: "frame",
          id,
          width: image.width,
          height: image.height,
          buffer: buf,
          opts,
        };
        this.worker!.postMessage(req, [buf]);
      });
    }
    const g = new TriangleGenerator();
    g.reset(image, { threshold: opts.threshold });
    while (!g.done) g.step(5000);
    return Promise.resolve(g.segments.map((s) => ({ ...s })));
  }

  private runFallback(image: ImageLike, opts: LoadOptions, onBatch: BatchCb): void {
    const g = new TriangleGenerator();
    g.reset(image, { threshold: opts.threshold });
    onBatch(g.segments.slice(), false); // border
    const pump = () => {
      const fresh = g.step(BUILD_BATCH);
      onBatch(fresh, g.done);
      if (!g.done) this.fallbackTimer = setTimeout(pump, 0);
    };
    this.fallbackTimer = setTimeout(pump, 0);
  }

  private cancelFallback(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  dispose(): void {
    this.cancelFallback();
    this.worker?.terminate();
    this.worker = null;
  }
}

function toBuffer(image: ImageLike): ArrayBuffer {
  const src =
    image.data instanceof Uint8ClampedArray ? image.data : new Uint8ClampedArray(image.data);
  return src.slice().buffer;
}
