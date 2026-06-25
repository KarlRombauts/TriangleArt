<script lang="ts">
  import { settings } from "$lib/state.svelte";
  import { SAMPLES } from "$lib/samples";
  import { segmentsToSvg, downloadSvg } from "$lib/render/exportSvg";
  import { downloadCanvasPng } from "$lib/render/exportPng";
  import { Slider } from "$lib/components/ui/slider";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
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
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <Label>Detail <span class="text-muted-foreground">({settings.threshold.toFixed(3)})</span></Label>
    <Slider type="single" min={0.001} max={0.05} step={0.001} bind:value={settings.threshold} />
  </div>

  <div class="space-y-2">
    <Label>Build speed <span class="text-muted-foreground">({settings.buildSpeed}/frame)</span></Label>
    <Slider type="single" min={50} max={3000} step={50} bind:value={settings.buildSpeed} />
  </div>

  <div class="space-y-2">
    <Label>Line weight <span class="text-muted-foreground">({settings.lineWidth.toFixed(2)})</span></Label>
    <Slider type="single" min={0.25} max={5} step={0.25} bind:value={settings.lineWidth} />
  </div>

  <div class="flex gap-6">
    <label class="flex items-center gap-2 text-sm">
      <input type="color" class="h-7 w-9 rounded border border-border bg-transparent" bind:value={settings.background} />
      Background
    </label>
    <label class="flex items-center gap-2 text-sm">
      <input type="color" class="h-7 w-9 rounded border border-border bg-transparent" bind:value={settings.line} />
      Line
    </label>
  </div>

  <div class="space-y-2">
    <Label>Image</Label>
    <div class="flex flex-wrap gap-2">
      {#each SAMPLES as s (s.name)}
        <Button variant="outline" size="sm" onclick={() => canvasApi.loadSrc(s.src)}>{s.name}</Button>
      {/each}
    </div>
    <input
      type="file"
      accept="image/*"
      onchange={onFile}
      class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground hover:file:bg-secondary/80"
    />
    <p class="text-xs text-muted-foreground">…or drag an image onto the canvas.</p>
  </div>

  <div class="flex gap-2">
    <Button onclick={exportPng}>Download PNG</Button>
    <Button variant="secondary" onclick={exportSvg}>Download SVG</Button>
  </div>
</div>
