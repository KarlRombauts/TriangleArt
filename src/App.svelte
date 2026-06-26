<script lang="ts">
  import { onMount } from "svelte";
  import Canvas from "$lib/components/Canvas.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import MobileLayout from "$lib/components/MobileLayout.svelte";
  import * as Card from "$lib/components/ui/card";
  import type { CanvasApi } from "$lib/components/canvasApi";

  let canvasComp = $state<CanvasApi>();
  let isMobile = $state(false);

  onMount(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
</script>

{#if isMobile}
  <MobileLayout />
{:else}
  <div class="flex h-screen flex-col overflow-hidden">
    <header class="flex items-baseline gap-3 border-b border-border/60 px-6 py-4">
      <h1 class="font-display text-2xl leading-none font-semibold tracking-tight">Triangle&nbsp;Art</h1>
      <p class="hidden text-sm text-muted-foreground sm:block">Generative image triangulation</p>
      <span class="ml-auto text-xs text-muted-foreground/70">
        Pick a look, drop a photo, or try your camera
      </span>
    </header>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section class="grid min-h-0 flex-1 place-items-center p-4 sm:p-6">
        <Canvas bind:this={canvasComp} />
      </section>

      <aside
        class="w-full shrink-0 overflow-y-auto border-t border-border/60 bg-card/40 p-6 backdrop-blur lg:w-[360px] lg:border-t-0 lg:border-l"
      >
        {#if canvasComp}
          <Controls canvasApi={canvasComp} />
        {/if}
      </aside>
    </div>
  </div>
{/if}
