export const DETAIL_MIN = 0.002;
export const DETAIL_MAX = 0.05;

// Build pacing (segments drawn per animation frame on the main thread).
export const BUILD_BATCH = 1200;

// Webcam tuning.
export const WEBCAM_MAX_EDGE = 480; // cap long edge for performance
export const WEBCAM_THRESHOLD = 0.02; // coarser detail for smooth live frames
export const WEBCAM_MAX_SAMPLES = 6;
