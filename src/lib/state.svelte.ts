export type Settings = {
  threshold: number;
  lineWidth: number;
  background: string;
  line: string;
  compare: boolean;
};

export const settings: Settings = $state({
  threshold: 6,
  lineWidth: 1.5,
  background: "#000000",
  line: "#ffffff",
  compare: false,
});
