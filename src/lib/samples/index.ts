import { TuringImage } from "./turing";
import sample2Url from "./sample2.jpg?url";
import sample3Url from "./sample3.jpg?url";
import sample4Url from "./sample4.jpg?url";
import sample5Url from "./sample5.jpg?url";

export type Sample = { name: string; src: string };

export const DEFAULT_SAMPLE: Sample = { name: "Turing", src: TuringImage };
export const SAMPLES: Sample[] = [
  DEFAULT_SAMPLE,
  { name: "Photo", src: sample2Url },
  { name: "Portrait", src: sample3Url },
  { name: "Landscape", src: sample4Url },
  { name: "Scene", src: sample5Url },
];
