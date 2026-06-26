<script lang="ts">
  import type { Snippet } from "svelte";

  let { open, onClose, children }: { open: boolean; onClose: () => void; children: Snippet } =
    $props();

  // Drag-to-dismiss: track the downward drag offset from the handle.
  let dragY = $state(0);
  let dragging = $state(false);
  let startY = 0;

  function onDown(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 90) onClose();
    dragY = 0;
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/20"
    role="presentation"
    onclick={onClose}
  ></div>
  <div
    class="fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl"
    style="transform: translateY({dragY}px); transition: {dragging ? 'none' : 'transform 0.2s ease'}"
    role="dialog"
    aria-modal="true"
  >
    <button
      type="button"
      class="absolute top-2 right-3 z-10 rounded-md p-1 text-muted-foreground hover:text-foreground"
      aria-label="Close"
      onclick={onClose}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
    <div
      class="flex shrink-0 cursor-grab touch-none items-center justify-center pt-2.5 pb-3 active:cursor-grabbing"
      style="touch-action: none"
      role="presentation"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    >
      <div class="h-1.5 w-12 rounded-full bg-border"></div>
    </div>
    <div class="overflow-y-auto px-4 pb-6">
      {@render children()}
    </div>
  </div>
{/if}
