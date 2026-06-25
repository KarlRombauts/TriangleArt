<script lang="ts">
  import { onMount } from "svelte";
  import { GeneratorClient } from "$lib/worker/generatorClient";
  import { redrawAll, drawSegments, clearCanvas, type RenderStyle } from "$lib/render/canvasRenderer";
  import { loadImageFromSrc, loadImageFromFile } from "$lib/image/loadImage";
  import { derivePolarity } from "$lib/engine/polarity";
  import { settings } from "$lib/state.svelte";
  import { DEFAULT_SAMPLE } from "$lib/samples";
  import { DETAIL_MIN, WEBCAM_MAX_EDGE, WEBCAM_THRESHOLD, WEBCAM_MAX_SAMPLES } from "$lib/constants";
  import { startCamera, captureFrame, imageToDataUrl } from "$lib/webcam";
  import CompareSlider from "./CompareSlider.svelte";
  import type { ImageLike } from "$lib/engine/brightness";
  import type { Segment } from "$lib/engine/geometry";

  let canvasEl = $state<HTMLCanvasElement>();
  let dragging = $state(false);
  let ctx: CanvasRenderingContext2D | null = null;
  const client = new GeneratorClient();
  let current: ImageLike | null = null;
  let allSegments: Segment[] = [];
  let originalSrc = $state("");

  let isWebcam = $state(false);
  let webcamError = $state("");
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let webcamRunning = false;

  const style = (): RenderStyle => ({
    background: settings.background,
    line: settings.line,
    lineWidth: settings.lineWidth,
  });

  export function getCanvas() {
    return canvasEl!;
  }
  export function getSegments(): Segment[] {
    return allSegments.filter((s) => s.cutoff >= settings.threshold);
  }
  export function getSize() {
    return { width: current?.width ?? 0, height: current?.height ?? 0 };
  }
  export function getOriginalSrc() {
    return originalSrc;
  }
  export function getIsWebcam() {
    return isWebcam;
  }
  export function getWebcamError() {
    return webcamError;
  }

  export async function startWebcam() {
    webcamError = "";
    try {
      stream = await startCamera();
    } catch {
      webcamError = "Camera access was denied or unavailable.";
      return;
    }
    video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    settings.compare = false;
    isWebcam = true;
    webcamRunning = true;
    void pumpWebcam();
  }

  async function pumpWebcam() {
    if (!webcamRunning || !video || !ctx || !canvasEl) return;
    const cap = captureFrame(video, WEBCAM_MAX_EDGE);
    if (cap) {
      if (canvasEl.width !== cap.width || canvasEl.height !== cap.height) {
        canvasEl.width = cap.width;
        canvasEl.height = cap.height;
      }
      current = cap.image;
      const segs = await client.frame(cap.image, {
        subdivideOn: derivePolarity(settings.line, settings.background),
        threshold: WEBCAM_THRESHOLD,
        maxSamples: WEBCAM_MAX_SAMPLES,
      });
      if (webcamRunning && ctx) {
        allSegments = segs;
        redrawAll(ctx, segs, style(), -Infinity);
      }
    }
    if (webcamRunning) requestAnimationFrame(() => void pumpWebcam());
  }

  export function freezeWebcam() {
    webcamRunning = false;
    stopStream();
    // Turn the frozen frame into a normal editable still: this re-enables the
    // style/detail controls and restores "Start webcam" so it can be resumed.
    isWebcam = false;
    if (current) {
      originalSrc = imageToDataUrl(current);
      lastPolarity = derivePolarity(settings.line, settings.background);
      lastThreshold = settings.threshold;
      lastLineWidth = settings.lineWidth;
      lastBackground = settings.background;
      lastLine = settings.line;
      build(); // rebuild at full detail so the Detail slider spans its full range
    }
  }
  export function stopWebcam() {
    webcamRunning = false;
    isWebcam = false;
    stopStream();
    void loadSrc(DEFAULT_SAMPLE.src);
  }
  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video = null;
  }

  function redraw() {
    if (ctx && current) redrawAll(ctx, allSegments, style(), settings.threshold);
  }

  // Build to the finest detail (DETAIL_MIN) once; the slider then filters by
  // cutoff without recomputing. The worker streams batches we draw as they land.
  function build() {
    if (!ctx || !current) return;
    allSegments = [];
    clearCanvas(ctx, style());
    client.load(
      current,
      { subdivideOn: derivePolarity(settings.line, settings.background), threshold: DETAIL_MIN, maxSamples: 10 },
      (segs) => {
        allSegments.push(...segs);
        if (ctx) drawSegments(ctx, segs, style(), settings.threshold);
      },
    );
  }

  export async function loadSrc(src: string) {
    const { image, width, height } = await loadImageFromSrc(src);
    originalSrc = src;
    applyImage(image, width, height);
  }
  export async function loadFile(file: File) {
    const { image, width, height } = await loadImageFromFile(file);
    originalSrc = URL.createObjectURL(file);
    applyImage(image, width, height);
  }
  function applyImage(image: ImageLike, width: number, height: number) {
    current = image;
    if (canvasEl) {
      canvasEl.width = width;
      canvasEl.height = height;
    }
    build();
  }

  onMount(() => {
    ctx = canvasEl!.getContext("2d");
    void loadSrc(DEFAULT_SAMPLE.src);
    return () => {
      webcamRunning = false;
      stopStream();
      client.dispose();
    };
  });

  // Reactive rules: polarity flip rebuilds; threshold/colour/width just redraw
  // (filtered) — no recompute, no flicker.
  let lastThreshold = settings.threshold;
  let lastPolarity = derivePolarity(settings.line, settings.background);
  let lastLineWidth = settings.lineWidth;
  let lastBackground = settings.background;
  let lastLine = settings.line;

  $effect(() => {
    const t = settings.threshold;
    const polarity = derivePolarity(settings.line, settings.background);
    const lw = settings.lineWidth;
    const bg = settings.background;
    const ln = settings.line;

    if (!ctx || !current || isWebcam) return;

    if (polarity !== lastPolarity) {
      lastPolarity = polarity;
      lastThreshold = t;
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      build();
    } else if (t !== lastThreshold) {
      lastThreshold = t;
      redraw();
    } else if (lw !== lastLineWidth || bg !== lastBackground || ln !== lastLine) {
      lastLineWidth = lw;
      lastBackground = bg;
      lastLine = ln;
      redraw();
    }
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  }
</script>

<div
  class="relative inline-block leading-none rounded-lg ring-1 ring-border transition-shadow"
  class:ring-2={dragging}
  class:ring-primary={dragging}
  role="img"
  aria-label="Triangle art canvas — drop an image to load it"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <canvas
    bind:this={canvasEl}
    class="block w-auto h-auto max-w-full max-h-[82vh] rounded-[10px]"
  ></canvas>
  <CompareSlider src={originalSrc} active={settings.compare && !isWebcam} />
  {#if dragging}
    <div
      class="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium rounded-lg pointer-events-none"
    >
      Drop image to triangulate
    </div>
  {/if}
</div>
