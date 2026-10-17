const urlByBlob = new WeakMap<Blob, string>();

/**
 * Keeps one object URL per Blob for the whole session. Undo/redo and history
 * snapshots share Blobs, so URLs must stay valid even after an edit replaces
 * the current scene audio.
 */
export function audioUrlFor(blob?: Blob | null): string | undefined {
  if (!blob) return undefined;
  const cached = urlByBlob.get(blob);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  urlByBlob.set(blob, url);
  return url;
}

/** Only call during full teardown; history may still reference older blobs. */
export function releaseAudioUrl(blob?: Blob | null): void {
  if (!blob) return;
  const cached = urlByBlob.get(blob);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlByBlob.delete(blob);
  }
}
