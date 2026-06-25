<script lang="ts">
  import Canvas from "$lib/components/Canvas.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import * as Card from "$lib/components/ui/card";
  import type { CanvasApi } from "$lib/components/canvasApi";

  let canvasComp = $state<CanvasApi>();
</script>

<main class="min-h-screen p-6 flex flex-col lg:flex-row gap-6 items-start">
  <div class="flex-1 flex justify-center w-full min-w-0">
    <Canvas bind:this={canvasComp} />
  </div>

  <Card.Root class="w-full lg:w-80 shrink-0">
    <Card.Header>
      <Card.Title>Triangle Art</Card.Title>
      <Card.Description>Recursive triangle subdivision driven by image brightness.</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if canvasComp}
        <Controls canvasApi={canvasComp} />
      {/if}
    </Card.Content>
  </Card.Root>
</main>
