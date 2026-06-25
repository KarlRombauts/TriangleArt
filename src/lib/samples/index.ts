import { TuringImage } from "./turing";
import leaf from "./leaf.jpg?url";
import dog from "./dog.jpg?url";
import building from "./building.jpg?url";
import road from "./road.jpg?url";
import swan from "./swan.jpg?url";

export type Sample = { name: string; src: string };

export const DEFAULT_SAMPLE: Sample = { name: "Turing", src: TuringImage };
export const SAMPLES: Sample[] = [
  DEFAULT_SAMPLE,
  { name: "Leaf", src: leaf },
  { name: "Dog", src: dog },
  { name: "Building", src: building },
  { name: "Road", src: road },
  { name: "Swan", src: swan },
];
