import fixWebmDuration from "fix-webm-duration";

/**
 * MediaRecorder WebM files often miss the Segment Duration element, which
 * makes players report Infinity. This patches the duration in place.
 */
export async function withWebmDuration(
  blob: Blob,
  durationMs: number,
): Promise<Blob> {
  if (!blob || blob.size === 0 || durationMs <= 0) return blob;
  try {
    return await fixWebmDuration(blob, Math.round(durationMs), { logger: false });
  } catch {
    return blob;
  }
}
