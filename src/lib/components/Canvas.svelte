<script lang="ts">
  import { onMount } from "svelte";
  import { TriangleGenerator } from "$lib/engine/generator";
  import {
    redrawAll,
    drawSegments,
    type RenderStyle,
  } from "$lib/render/canvasRenderer";
  import { loadImageFromSrc, loadImageFromFile } from "$lib/image/loadImage";
  import { derivePolarity } from "$lib/engine/polarity";
  import { settings } from "$lib/state.svelte";
  import { DEFAULT_SAMPLE } from "$lib/samples";
  import type { ImageLike } from "$lib/engine/brightness";
  import type { Segment } from "$lib/engine/geometry";

  let canvasEl = $state<HTMLCanvasElement>();
  let dragging = $state(false);
  let ctx: CanvasRenderingContext2D | null = null;
  let gen = new TriangleGenerator();
  let current: ImageLike | null = null;
  let raf = 0;

  const style = (): RenderStyle => ({
    background: settings.background,
    line: settings.line,
    lineWidth: settings.lineWidth,
  });

  // Public API (accessible via bind:this from the parent).
  export function getCanvas(): HTMLCanvasElement {
    return canvasEl!;
  }
  export function getSegments(): Segment[] {
    return gen.segments;
  }
  export function getSize() {
    return { width: current?.width ?? 0, height: current?.height ?? 0 };
  }

  function regenerate() {
    if (!ctx || !current) return;
    gen.reset(current, {
      threshold: settings.threshold,
      subdivideOn: derivePolarity(settings.line, settings.background),
    });
    redrawAll(ctx, gen.segments, style()); // background + border, build continues in loop
  }

  export async function loadSrc(src: string) {
    const { image, width, height } = await loadImageFromSrc(src);
    applyImage(image, width, height);
  }
  export async function loadFile(file: File) {
    const { image, width, height } = await loadImageFromFile(file);
    applyImage(image, width, height);
  }
  function applyImage(image: ImageLike, width: number, height: number) {
    current = image;
    if (canvasEl) {
      canvasEl.width = width;
      canvasEl.height = height;
    }
    regenerate();
  }

  function loop() {
    if (ctx && !gen.done) {
      const fresh = gen.step(settings.buildSpeed);
      if (fresh.length) drawSegments(ctx, fresh, style());
    }
    raf = requestAnimationFrame(loop);
  }

  onMount(() => {
    ctx = canvasEl!.getContext("2d");
    void loadSrc(DEFAULT_SAMPLE.src);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  // Single reactive effect decides regen vs live redraw, so the two never race.
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

    if (t !== lastThreshold || polarity !== lastPolarity) {
      lastThreshold = t;
      lastPolarity = polarity;
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      regenerate();
    } else if (lw !== lastLineWidth || bg !== lastBackground || ln !== lastLine) {
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      redrawAll(ctx, gen.segments, style());
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
  {#if dragging}
    <div
      class="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium rounded-lg pointer-events-none"
    >
      Drop image to triangulate
    </div>
  {/if}
</div>
