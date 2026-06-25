export type Settings = {
  threshold: number;
  buildSpeed: number;
  lineWidth: number;
  background: string;
  line: string;
};

export const settings: Settings = $state({
  threshold: 0.01,
  buildSpeed: 800,
  lineWidth: 1.5,
  background: "#000000",
  line: "#ffffff",
});
