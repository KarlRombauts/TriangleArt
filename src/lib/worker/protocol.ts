import type { Segment } from "../engine/geometry";
import type { SubdivideOn } from "../engine/generator";

export type LoadOptions = { threshold: number; subdivideOn: SubdivideOn };

export type WorkerRequest =
  | {
      type: "load";
      id: number;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      opts: LoadOptions;
      batch: number;
    }
  | {
      type: "frame";
      id: number;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      opts: LoadOptions;
    };

export type WorkerResponse = { type: "segments"; id: number; buffer: ArrayBuffer; done: boolean };

const FLOATS_PER_SEGMENT = 5;

export function encodeSegments(segments: Segment[]): Float32Array {
  const arr = new Float32Array(segments.length * FLOATS_PER_SEGMENT);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const o = i * FLOATS_PER_SEGMENT;
    arr[o] = s.x1;
    arr[o + 1] = s.y1;
    arr[o + 2] = s.x2;
    arr[o + 3] = s.y2;
    arr[o + 4] = s.cutoff;
  }
  return arr;
}

export function decodeSegments(arr: Float32Array): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < arr.length; i += FLOATS_PER_SEGMENT) {
    out.push({
      x1: arr[i],
      y1: arr[i + 1],
      x2: arr[i + 2],
      y2: arr[i + 3],
      cutoff: arr[i + 4],
    });
  }
  return out;
}
