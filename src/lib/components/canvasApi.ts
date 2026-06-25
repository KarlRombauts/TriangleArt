import type { Segment } from "$lib/engine/geometry";

export type CanvasApi = {
  getCanvas: () => HTMLCanvasElement;
  getSegments: () => Segment[];
  getSize: () => { width: number; height: number };
  loadSrc: (src: string) => void;
  loadFile: (file: File) => void;
};
