<script lang="ts">
  import { onMount } from "svelte";
  import { GeneratorClient } from "$lib/worker/generatorClient";
  import { redrawAll, drawSegments, clearCanvas, type RenderStyle } from "$lib/render/canvasRenderer";
  import { loadImageFromSrc, loadImageFromFile } from "$lib/image/loadImage";
  import { derivePolarity } from "$lib/engine/polarity";
  import { settings } from "$lib/state.svelte";
  import { DEFAULT_SAMPLE } from "$lib/samples";
  import { DETAIL_MIN } from "$lib/constants";
  import CompareSlider from "./CompareSlider.svelte";
  import type { ImageLike } from "$lib/engine/brightness";
  import type { Segment } from "$lib/engine/geometry";

  let canvasEl = $state<HTMLCanvasElement>();
  let dragging = $state(false);
  let ctx: CanvasRenderingContext2D | null = null;
  const client = new GeneratorClient();
  let current: ImageLike | null = null;
  let allSegments: Segment[] = [];
  let originalSrc = $state("");

  const style = (): RenderStyle => ({
    background: settings.background,
    line: settings.line,
    lineWidth: settings.lineWidth,
  });

  export function getCanvas() {
    return canvasEl!;
  }
  export function getSegments(): Segment[] {
    return allSegments.filter((s) => s.cutoff >= settings.threshold);
  }
  export function getSize() {
    return { width: current?.width ?? 0, height: current?.height ?? 0 };
  }
  export function getOriginalSrc() {
    return originalSrc;
  }

  function redraw() {
    if (ctx && current) redrawAll(ctx, allSegments, style(), settings.threshold);
  }

  // Build to the finest detail (DETAIL_MIN) once; the slider then filters by
  // cutoff without recomputing. The worker streams batches we draw as they land.
  function build() {
    if (!ctx || !current) return;
    allSegments = [];
    clearCanvas(ctx, style());
    client.load(
      current,
      { subdivideOn: derivePolarity(settings.line, settings.background), threshold: DETAIL_MIN, maxSamples: 10 },
      (segs) => {
        allSegments.push(...segs);
        if (ctx) drawSegments(ctx, segs, style(), settings.threshold);
      },
    );
  }

  export async function loadSrc(src: string) {
    const { image, width, height } = await loadImageFromSrc(src);
    originalSrc = src;
    applyImage(image, width, height);
  }
  export async function loadFile(file: File) {
    const { image, width, height } = await loadImageFromFile(file);
    originalSrc = URL.createObjectURL(file);
    applyImage(image, width, height);
  }
  function applyImage(image: ImageLike, width: number, height: number) {
    current = image;
    if (canvasEl) {
      canvasEl.width = width;
      canvasEl.height = height;
    }
    build();
  }

  onMount(() => {
    ctx = canvasEl!.getContext("2d");
    void loadSrc(DEFAULT_SAMPLE.src);
    return () => client.dispose();
  });

  // Reactive rules: polarity flip rebuilds; threshold/colour/width just redraw
  // (filtered) — no recompute, no flicker.
  let lastThreshold = settings.threshold;
  let lastPolarity = derivePolarity(settings.line, settings.background);
  let lastLineWidth = settings.lineWidth;
  let lastBackground = settings.background;
  let lastLine = settings.line;

  $effect(() => {
    const t = settings.threshold;
    const polarity = derivePolarity(settings.line, settings.background);
    const lw = settings.lineWidth;
    const bg = settings.background;
    const ln = settings.line;

    if (!ctx || !current) return;

    if (polarity !== lastPolarity) {
      lastPolarity = polarity;
      lastThreshold = t;
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      build();
    } else if (t !== lastThreshold) {
      lastThreshold = t;
      redraw();
    } else if (lw !== lastLineWidth || bg !== lastBackground || ln !== lastLine) {
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      redraw();
    }
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  }
</script>

<div
  class="relative inline-block leading-none rounded-lg ring-1 ring-border transition-shadow"
  class:ring-2={dragging}
  class:ring-primary={dragging}
  role="img"
  aria-label="Triangle art canvas — drop an image to load it"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <canvas bind:this={canvasEl} class="max-w-full h-auto rounded-lg block"></canvas>
  <CompareSlider src={originalSrc} active={settings.compare} />
  {#if dragging}
    <div
      class="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium rounded-lg pointer-events-none"
    >
      Drop image to triangulate
    </div>
  {/if}
</div>
