import { TriangleGenerator } from "../engine/generator";
import { encodeSegments, type WorkerRequest, type WorkerResponse } from "./protocol";

const gen = new TriangleGenerator();
// Id of the most recent request. The generator is shared, so a streaming `load`
// pump must stop as soon as a newer request arrives — otherwise the stale pump
// keeps stepping the (now re-initialised) generator and steals batches from the
// new build, producing missing lines when settings change quickly.
let currentId = -1;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  currentId = msg.id;
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
    if (msg.id === currentId) sendSegments(msg.id, gen.segments, true);
    return;
  }

  // load: send the border first (reset() seeds it), then stream build batches so
  // the main thread can animate the build off the critical path.
  sendSegments(msg.id, gen.segments, false);

  const pump = () => {
    if (msg.id !== currentId) return; // superseded by a newer request -> stop
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
