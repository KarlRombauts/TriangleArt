// Detail threshold on the edge-strength scale (Otsu between-class variance,
// ~0..16256 for 0-255 brightness). Tuned visually against the sample images.
export const DETAIL_MIN = 3; // finest (lowest edge strength that still subdivides)
export const DETAIL_MAX = 300; // coarsest

// Cap the long edge of any loaded still image (sample or user upload) so
// generation and bitmap export stay bounded regardless of source resolution.
export const IMAGE_MAX_EDGE = 1600;

// Build pacing (segments drawn per animation frame on the main thread).
export const BUILD_BATCH = 1200;

// Webcam tuning.
export const WEBCAM_MAX_EDGE = 800; // cap long edge for performance
export const WEBCAM_THRESHOLD = 40; // coarser detail for smooth live frames
