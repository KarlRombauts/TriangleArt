export const DETAIL_MIN = 0.002;
export const DETAIL_MAX = 0.05;

// Cap the long edge of any loaded still image (sample or user upload) so
// generation and bitmap export stay bounded regardless of source resolution.
export const IMAGE_MAX_EDGE = 1600;

// Build pacing (segments drawn per animation frame on the main thread).
export const BUILD_BATCH = 1200;

// Webcam tuning.
export const WEBCAM_MAX_EDGE = 800; // cap long edge for performance
export const WEBCAM_THRESHOLD = 0.02; // coarser detail for smooth live frames
export const WEBCAM_MAX_SAMPLES = 6;
