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

/**
 * Cleanup all blob URLs for a project
 */
export function releaseProjectBlobUrls(project: any): void {
  if (!project) return;
  try {
    if (project.audioUrl && project.audioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(project.audioUrl);
    }
    if (Array.isArray(project.scenes)) {
      for (const scene of project.scenes) {
        if (scene?.audioUrl && scene.audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(scene.audioUrl);
        }
      }
    }
    if (project.assets && typeof project.assets === "object") {
      for (const asset of Object.values(project.assets)) {
        const a = asset as any;
        if (a?.url && typeof a.url === "string" && a.url.startsWith("blob:")) {
          URL.revokeObjectURL(a.url);
        }
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Track blob URLs for cleanup
 */
const trackedUrls = new Set<string>();

export function trackBlobUrl(url: string): string {
  if (url && url.startsWith("blob:")) {
    trackedUrls.add(url);
  }
  return url;
}

export function cleanupAllTrackedUrls(): void {
  for (const url of trackedUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  trackedUrls.clear();
}

/**
 * Enhanced cleanup with timeout tracking
 */
const urlTimestamps = new Map<string, number>();

export function trackBlobUrlWithTTL(url: string, ttlMs = 60000): string {
  if (url && url.startsWith("blob:")) {
    trackedUrls.add(url);
    urlTimestamps.set(url, Date.now() + ttlMs);
  }
  return url;
}

export function cleanupExpiredUrls(): void {
  const now = Date.now();
  for (const [url, expires] of urlTimestamps.entries()) {
    if (now > expires) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      trackedUrls.delete(url);
      urlTimestamps.delete(url);
    }
  }
}
