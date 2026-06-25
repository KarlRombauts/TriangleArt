export type Preset = {
  name: string;
  threshold: number;
  lineWidth: number;
  background: string;
  line: string;
};

export const PRESETS: Preset[] = [
  { name: "Ink", threshold: 0.008, lineWidth: 1.0, background: "#000000", line: "#ffffff" },
  { name: "Blueprint", threshold: 0.01, lineWidth: 1.25, background: "#0b3d91", line: "#cfe3ff" },
  { name: "Newsprint", threshold: 0.012, lineWidth: 1.0, background: "#f5f5f0", line: "#111111" },
  { name: "Neon", threshold: 0.006, lineWidth: 1.5, background: "#0a0a0f", line: "#39ff14" },
  { name: "Heavy", threshold: 0.02, lineWidth: 3.0, background: "#101014", line: "#ffd447" },
];
