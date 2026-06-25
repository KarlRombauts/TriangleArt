import type { Segment } from "$lib/engine/geometry";

export type CanvasApi = {
  getCanvas: () => HTMLCanvasElement;
  getSegments: () => Segment[];
  getSize: () => { width: number; height: number };
  getOriginalSrc: () => string;
  loadSrc: (src: string) => void;
  loadFile: (file: File) => void;
  startWebcam: () => void;
  stopWebcam: () => void;
  freezeWebcam: () => void;
  getIsWebcam: () => boolean;
  getWebcamError: () => string;
};
