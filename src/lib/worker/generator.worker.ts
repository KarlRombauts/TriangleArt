import { TriangleGenerator } from "../engine/generator";
import { encodeSegments, type WorkerRequest, type WorkerResponse } from "./protocol";

const gen = new TriangleGenerator();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const img = {
    data: new Uint8ClampedArray(msg.buffer),
    width: msg.width,
    height: msg.height,
  };
  gen.reset(img, {
    threshold: msg.opts.threshold,
    subdivideOn: msg.opts.subdivideOn,
    contrast: msg.opts.contrast,
  });

  if (msg.type === "frame") {
    while (!gen.done) gen.step(5000);
    sendSegments(msg.id, gen.segments, true);
    return;
  }

  // load: send the border first (reset() seeds it), then stream build batches so
  // the main thread can animate the build off the critical path.
  sendSegments(msg.id, gen.segments, false);

  const pump = () => {
    const fresh = gen.step(msg.batch);
    sendSegments(msg.id, fresh, gen.done);
    if (!gen.done) setTimeout(pump, 0);
  };
  pump();
};

function sendSegments(id: number, segments: Parameters<typeof encodeSegments>[0], done: boolean) {
  const buffer = encodeSegments(segments).buffer as ArrayBuffer;
  const res: WorkerResponse = { type: "segments", id, buffer, done };
  (self as unknown as Worker).postMessage(res, [buffer]);
}
