import { TuringImage } from "./turing";
import sample2Url from "./sample2.jpg?url";

export type Sample = { name: string; src: string };

export const DEFAULT_SAMPLE: Sample = { name: "Turing", src: TuringImage };
export const SAMPLES: Sample[] = [DEFAULT_SAMPLE, { name: "Photo", src: sample2Url }];
