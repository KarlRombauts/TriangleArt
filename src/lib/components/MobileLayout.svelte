<script lang="ts">
  import Canvas from "./Canvas.svelte";
  import ImagePicker from "./ImagePicker.svelte";
  import StylePanel from "./StylePanel.svelte";
  import BottomSheet from "./BottomSheet.svelte";
  import type { CanvasApi } from "./canvasApi";

  let canvasComp = $state<CanvasApi>();
  let step = $state<"choose" | "result">("choose");
  let sheetOpen = $state(false);
</script>

<div class="flex h-[100dvh] flex-col overflow-hidden">
  <header class="flex items-baseline gap-2 border-b border-border/60 px-4 py-3">
    <h1 class="font-display text-xl leading-none font-semibold tracking-tight">Triangle&nbsp;Art</h1>
    <span class="text-xs text-muted-foreground">{step === "choose" ? "Choose an image" : ""}</span>
  </header>

  <!-- Result stage: always mounted (so the canvas API exists for the picker); hidden on the choose step. -->
  <div class="relative flex min-h-0 flex-1 flex-col" class:hidden={step === "choose"}>
    <div class="flex items-center border-b border-border/60 px-2 py-2">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        onclick={() => (step = "choose")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Change image
      </button>
    </div>

    <div class="grid min-h-0 flex-1 place-items-center p-3">
      <Canvas bind:this={canvasComp} />
    </div>

    <button
      type="button"
      class="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/40"
      onclick={() => (sheetOpen = true)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
      Adjust
    </button>
  </div>

  <!-- Choose step -->
  {#if step === "choose"}
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      {#if canvasComp}
        <ImagePicker canvasApi={canvasComp} onPick={() => (step = "result")} />
      {/if}
    </div>
  {/if}

  <BottomSheet open={sheetOpen} onClose={() => (sheetOpen = false)}>
    {#if canvasComp}
      <StylePanel canvasApi={canvasComp} presetsLayout="strip" />
    {/if}
  </BottomSheet>
</div>
