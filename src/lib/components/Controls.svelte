<script lang="ts">
  import { settings } from "$lib/state.svelte";
  import { SAMPLES } from "$lib/samples";
  import { PRESETS } from "$lib/presets";
  import { DETAIL_MIN, DETAIL_MAX } from "$lib/constants";
  import { segmentsToSvg, downloadSvg } from "$lib/render/exportSvg";
  import { downloadCanvasPng } from "$lib/render/exportPng";
  import { Slider } from "$lib/components/ui/slider";
  import { Button } from "$lib/components/ui/button";
  import type { CanvasApi } from "./canvasApi";

  let { canvasApi }: { canvasApi: CanvasApi } = $props();

  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
  function exportPng() {
    downloadCanvasPng(canvasApi.getCanvas(), `triangles-${stamp()}.png`);
  }
  function exportSvg() {
    const { width, height } = canvasApi.getSize();
    const svg = segmentsToSvg(canvasApi.getSegments(), width, height, {
      background: settings.background,
      line: settings.line,
      lineWidth: settings.lineWidth,
    });
    downloadSvg(svg, `triangles-${stamp()}.svg`);
  }
  function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) canvasApi.loadFile(file);
  }

  // Detail slider runs intuitively: drag right (d=1) = MORE detail (lower threshold).
  const SPAN = DETAIL_MAX - DETAIL_MIN;
  const detailFromThreshold = (t: number) => (DETAIL_MAX - t) / SPAN;
  const thresholdFromDetail = (d: number) => DETAIL_MAX - d * SPAN;

  function applyPreset(p: (typeof PRESETS)[number]) {
    settings.threshold = p.threshold;
    settings.lineWidth = p.lineWidth;
    settings.background = p.background;
    settings.line = p.line;
  }
  const isActivePreset = (p: (typeof PRESETS)[number]) =>
    Math.abs(settings.threshold - p.threshold) < 1e-6 &&
    settings.lineWidth === p.lineWidth &&
    settings.background.toLowerCase() === p.background.toLowerCase() &&
    settings.line.toLowerCase() === p.line.toLowerCase();
</script>

<div class="space-y-7">
  <!-- LOOKS -->
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Looks</h2>
    <div class="flex flex-wrap gap-2">
      {#each PRESETS as p (p.name)}
        <button
          type="button"
          onclick={() => applyPreset(p)}
          class="rounded-full border px-3 py-1 text-sm transition-colors {isActivePreset(p)
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border hover:border-primary/60 hover:bg-accent'}"
        >
          {p.name}
        </button>
      {/each}
    </div>
  </section>

  <!-- IMAGE -->
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Image</h2>
    <div class="grid grid-cols-3 gap-2">
      {#each SAMPLES as s (s.name)}
        <button
          type="button"
          onclick={() => canvasApi.loadSrc(s.src)}
          title={s.name}
          class="group relative aspect-square overflow-hidden rounded-md border transition-all {canvasApi.getOriginalSrc() ===
          s.src
            ? 'border-primary ring-2 ring-primary/50'
            : 'border-border hover:border-primary/60'}"
        >
          <img src={s.src} alt={s.name} class="h-full w-full object-cover" />
          <span
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-3 pb-1 text-left text-[11px] font-medium text-white"
          >
            {s.name}
          </span>
        </button>
      {/each}
    </div>
    <label
      class="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      Upload a photo
      <input type="file" accept="image/*" onchange={onFile} class="hidden" />
    </label>
    <p class="text-center text-xs text-muted-foreground/70">…or drag an image onto the canvas</p>
  </section>

  <!-- ADJUST -->
  <section class="space-y-4">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Adjust</h2>

    <div class="space-y-1.5">
      <span class="text-sm">Detail</span>
      <Slider
        type="single"
        min={0}
        max={1}
        step={0.02}
        value={detailFromThreshold(settings.threshold)}
        onValueChange={(v: number) => (settings.threshold = thresholdFromDetail(v))}
      />
      <div class="flex justify-between text-[11px] text-muted-foreground/70">
        <span>Coarse</span><span>Fine</span>
      </div>
    </div>

    <div class="space-y-1.5">
      <span class="text-sm">Contrast</span>
      <Slider type="single" min={0.5} max={3} step={0.1} bind:value={settings.contrast} />
    </div>

    <div class="space-y-1.5">
      <span class="text-sm">Line weight</span>
      <Slider type="single" min={0.25} max={5} step={0.25} bind:value={settings.lineWidth} />
    </div>

    <div class="flex items-center gap-5">
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="color"
          class="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
          bind:value={settings.background}
        />
        Background
      </label>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="color"
          class="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
          bind:value={settings.line}
        />
        Line
      </label>
    </div>

    {#if !canvasApi.getIsWebcam()}
      <button
        type="button"
        onclick={() => (settings.compare = !settings.compare)}
        class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors {settings.compare
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border hover:bg-accent'}"
      >
        Compare with original
        <span class="text-xs text-muted-foreground">{settings.compare ? "On" : "Off"}</span>
      </button>
    {/if}
  </section>

  <!-- CAMERA -->
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Camera</h2>
    <div class="flex flex-wrap gap-2">
      {#if !canvasApi.getIsWebcam()}
        <Button variant="outline" size="sm" onclick={() => canvasApi.startWebcam()}>
          Start webcam
        </Button>
      {:else}
        <Button variant="outline" size="sm" onclick={() => canvasApi.freezeWebcam()}>
          Freeze frame
        </Button>
        <Button variant="destructive" size="sm" onclick={() => canvasApi.stopWebcam()}>Stop</Button>
      {/if}
    </div>
    {#if canvasApi.getWebcamError()}
      <p class="text-xs text-destructive">{canvasApi.getWebcamError()}</p>
    {:else}
      <p class="text-xs text-muted-foreground/70">Triangulates your camera in real time.</p>
    {/if}
  </section>

  <!-- EXPORT -->
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Export</h2>
    <div class="flex gap-2">
      <Button class="flex-1" onclick={exportPng}>PNG</Button>
      <Button class="flex-1" variant="secondary" onclick={exportSvg}>SVG</Button>
    </div>
    <p class="text-xs text-muted-foreground/70">SVG is true vector — scales to any size.</p>
  </section>
</div>
