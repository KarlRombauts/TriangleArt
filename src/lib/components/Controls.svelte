<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import ImagePicker from "./ImagePicker.svelte";
  import StylePanel from "./StylePanel.svelte";
  import type { CanvasApi } from "./canvasApi";

  let { canvasApi }: { canvasApi: CanvasApi } = $props();
</script>

<div class="space-y-7">
  <section class="space-y-2.5">
    <h2 class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Image</h2>
    <ImagePicker {canvasApi} />
    <p class="text-center text-xs text-muted-foreground/70">…or drag an image onto the canvas</p>
  </section>

  <!-- CAMERA (desktop only) -->
  <section class="space-y-2">
    {#if !canvasApi.getIsWebcam()}
      <Button variant="outline" class="w-full justify-center gap-2" onclick={() => canvasApi.startWebcam()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        Use webcam
      </Button>
      {#if canvasApi.getWebcamError()}
        <p class="text-center text-xs text-destructive">{canvasApi.getWebcamError()}</p>
      {/if}
    {:else}
      <div class="flex gap-2">
        <Button variant="secondary" class="flex-1 gap-2" onclick={() => canvasApi.freezeWebcam()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          Capture
        </Button>
        <Button variant="destructive" class="flex-1 gap-2" onclick={() => canvasApi.stopWebcam()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          Stop
        </Button>
      </div>
    {/if}
  </section>

  <StylePanel {canvasApi} />
</div>
