// Tuning values for the capture → upload path. Kept in one place so the
// reasoning behind each number lives next to it instead of at the call site.

/** Long edge cap before upload. Document AI reads small print well below this,
 *  and 2400px keeps a JPEG under the 5MiB transport limit with room to spare. */
export const MAX_PHOTO_EDGE_PX = 2400;

/** Re-encode quality after resizing. Lower values start to blur thin strokes. */
export const UPLOAD_JPEG_QUALITY = 0.85;

/** Capture quality before resizing. Higher than the upload quality so the
 *  resize step has detail to work with. */
export const CAPTURE_JPEG_QUALITY = 0.9;

/** Transport limit. The server rejects anything larger with INVALID_IMAGE,
 *  so the app checks first and avoids a pointless round trip. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Mock requests settle within seconds; ten seconds only trips the timeout scenario. */
export const MOCK_TIMEOUT_MS = 10_000;

/** Remote budget. Sits above the server's 35s HTTP limit and the SDK's 25s
 *  deadline so the server's own error reaches the user before the app gives up. */
export const REMOTE_TIMEOUT_MS = 40_000;
