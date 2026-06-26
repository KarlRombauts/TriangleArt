<script lang="ts">
  import type { Snippet } from "svelte";

  let { open, onClose, children }: { open: boolean; onClose: () => void; children: Snippet } =
    $props();
</script>

{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    role="presentation"
    onclick={onClose}
  ></div>
  <div
    class="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-2 pb-6 shadow-2xl"
    role="dialog"
    aria-modal="true"
  >
    <div class="sticky top-0 -mx-4 mb-2 flex items-center justify-center bg-card pt-2 pb-3">
      <div class="h-1.5 w-10 rounded-full bg-border"></div>
      <button
        type="button"
        class="absolute right-3 top-1.5 rounded-md p-1 text-muted-foreground hover:text-foreground"
        aria-label="Close"
        onclick={onClose}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    {@render children()}
  </div>
{/if}
