<script lang="ts">
  let { src, active }: { src: string; active: boolean } = $props();

  let pos = $state(50); // divider position, percent from left
  let wrap = $state<HTMLDivElement>();
  let drag = false;

  function move(clientX: number) {
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    pos = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
  }
  function onPointerDown(e: PointerEvent) {
    drag = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    move(e.clientX);
  }
  function onPointerMove(e: PointerEvent) {
    if (drag) move(e.clientX);
  }
  function onPointerUp() {
    drag = false;
  }
</script>

{#if active}
  <div
    bind:this={wrap}
    class="absolute inset-0 touch-none overflow-hidden rounded-lg select-none"
    role="group"
    aria-label="Before and after comparison"
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
  >
    <!-- Original image revealed from the left up to the divider. -->
    <img
      {src}
      alt="original"
      class="absolute inset-0 w-full h-full object-cover"
      style={`clip-path: inset(0 ${100 - pos}% 0 0)`}
      draggable="false"
    />
    <div class="absolute inset-y-0 w-0.5 bg-primary" style={`left:${pos}%`}>
      <button
        type="button"
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 touch-none rounded-full bg-primary text-primary-foreground text-sm grid place-items-center cursor-ew-resize shadow sm:size-7 sm:text-xs"
        aria-label="Drag to compare original and triangulated"
        onpointerdown={onPointerDown}
        onkeydown={(e) => {
          if (e.key === "ArrowLeft") pos = Math.max(0, pos - 2);
          if (e.key === "ArrowRight") pos = Math.min(100, pos + 2);
        }}>⇆</button
      >
    </div>
  </div>
{/if}
