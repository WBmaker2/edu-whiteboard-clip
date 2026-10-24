import type { Project } from "../types/project";

const urlByBlob = new WeakMap<Blob, string>();

/**
 * Keeps one object URL per Blob for the whole session. Undo/redo and history
 * snapshots share Blobs, so URLs must stay valid even after an edit replaces
 * the current asset.
 */
export function blobUrlFor(blob?: Blob | null): string | undefined {
  if (!blob) return undefined;
  const cached = urlByBlob.get(blob);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  urlByBlob.set(blob, url);
  return url;
}

/** Only call during full teardown; history may still reference older blobs. */
export function releaseBlobUrl(blob?: Blob | null): void {
  if (!blob) return;
  const cached = urlByBlob.get(blob);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlByBlob.delete(blob);
  }
}

/** Releases audio and asset URLs after a project is closed and its history cleared. */
export function releaseProjectUrls(project?: Project | null): void {
  if (!project) return;
  for (const scene of project.scenes) releaseBlobUrl(scene.audioBlob);
  for (const asset of Object.values(project.assets ?? {})) {
    releaseBlobUrl(asset.blob);
  }
}
