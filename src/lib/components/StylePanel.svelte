<script lang="ts">
  import { settings } from "$lib/state.svelte";
  import { PRESETS } from "$lib/presets";
  import { DETAIL_MIN, DETAIL_MAX } from "$lib/constants";
  import { segmentsToSvg, downloadSvg } from "$lib/render/exportSvg";
  import { downloadCanvasPng } from "$lib/render/exportPng";
  import { Slider } from "$lib/components/ui/slider";
  import { Button } from "$lib/components/ui/button";
  import type { CanvasApi } from "./canvasApi";

  let { canvasApi, presetsLayout = "grid" }: { canvasApi: CanvasApi; presetsLayout?: "grid" | "strip" } =
    $props();

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

  const STYLE_MOTIF: [number, number, number, number][] = [
    [1, 1, 47, 1], [47, 1, 47, 47], [47, 47, 1, 47], [1, 47, 1, 1], [1, 1, 47, 47],
    [47, 1, 24, 24], [1, 47, 24, 24], [47, 1, 36, 12], [36, 12, 24, 24], [36, 12, 47, 24],
    [24, 24, 47, 24], [1, 47, 12, 36], [12, 36, 24, 24], [12, 36, 24, 47], [24, 24, 24, 47],
  ];
</script>

<div class="space-y-6">
  <!-- LOOKS -->
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Looks</h2>
    {#if presetsLayout === "strip"}
      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {#each PRESETS as p (p.name)}
          <button
            type="button"
            onclick={() => applyPreset(p)}
            title={p.name}
            class="relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border transition-all {isActivePreset(p)
              ? 'border-primary ring-2 ring-primary/50'
              : 'border-border'}"
          >
            <svg viewBox="0 0 48 48" class="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="48" height="48" fill={p.background} />
              <g stroke={p.line} stroke-width={Math.max(0.4, p.lineWidth * 0.5)} stroke-linecap="round">
                {#each STYLE_MOTIF as [x1, y1, x2, y2]}<line {x1} {y1} {x2} {y2} />{/each}
              </g>
            </svg>
            <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pt-2 pb-0.5 text-left text-[10px] font-medium text-white">{p.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-3 gap-2">
        {#each PRESETS as p (p.name)}
          <button
            type="button"
            onclick={() => applyPreset(p)}
            title={p.name}
            class="group relative aspect-square overflow-hidden rounded-md border transition-all {isActivePreset(p)
              ? 'border-primary ring-2 ring-primary/50'
              : 'border-border hover:border-primary/60'}"
          >
            <svg viewBox="0 0 48 48" class="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="48" height="48" fill={p.background} />
              <g stroke={p.line} stroke-width={Math.max(0.4, p.lineWidth * 0.5)} stroke-linecap="round">
                {#each STYLE_MOTIF as [x1, y1, x2, y2]}<line {x1} {y1} {x2} {y2} />{/each}
              </g>
            </svg>
            <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-3 pb-1 text-left text-[11px] font-medium text-white">{p.name}</span>
          </button>
        {/each}
      </div>
    {/if}
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
      <div class="flex justify-between text-[11px] text-muted-foreground/70"><span>Coarse</span><span>Fine</span></div>
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
        <input type="color" class="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" bind:value={settings.background} />
        Background
      </label>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input type="color" class="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" bind:value={settings.line} />
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
