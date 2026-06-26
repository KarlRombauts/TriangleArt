<script lang="ts">
  import { uploads } from "$lib/state.svelte";
  import { SAMPLES } from "$lib/samples";
  import type { CanvasApi } from "./canvasApi";

  let { canvasApi, onPick }: { canvasApi: CanvasApi; onPick?: () => void } = $props();

  function pick(src: string) {
    canvasApi.loadSrc(src);
    onPick?.();
  }
  function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      canvasApi.loadFile(file);
      onPick?.();
    }
  }
</script>

<div class="space-y-2.5">
  <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
    {#each [...SAMPLES, ...uploads] as s (s.src)}
      <button
        type="button"
        onclick={() => pick(s.src)}
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
</div>
