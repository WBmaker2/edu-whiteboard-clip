import type { AssetMeta, Project } from "../types/project";
import { uid } from "./time";
import type { DecodedVisual } from "./renderer/core";

const blobKeys = new WeakMap<Blob, string>();
let blobCounter = 0;

/** Stable identity for a Blob within the session, used as a cache key. */
export function blobKey(blob?: Blob | null): string {
  if (!blob) return "none";
  const existing = blobKeys.get(blob);
  if (existing) return existing;
  blobCounter += 1;
  const key = `blob_${blobCounter}`;
  blobKeys.set(blob, key);
  return key;
}

const imageCache = new WeakMap<Blob, Promise<HTMLImageElement | null>>();

export function decodeBlobImage(blob: Blob): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(blob);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
  imageCache.set(blob, promise);
  return promise;
}

async function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const image = await decodeBlobImage(blob);
  return {
    width: image?.naturalWidth ?? 0,
    height: image?.naturalHeight ?? 0,
  };
}

export async function createImageAssetFromFile(file: File): Promise<AssetMeta> {
  const { width, height } = await readImageSize(file);
  return {
    id: uid("asset"),
    kind: "image",
    source: "upload",
    mime: file.type || "image/png",
    blob: file,
    name: file.name,
    width: width || undefined,
    height: height || undefined,
  };
}

export function createFormulaAsset(
  latex: string,
  png: Blob,
  width?: number,
  height?: number,
): AssetMeta {
  return {
    id: uid("asset"),
    kind: "formula",
    source: "formula",
    mime: "image/png",
    blob: png,
    latex,
    width,
    height,
  };
}

export async function preloadProjectImages(
  project: Project,
): Promise<Map<string, DecodedVisual>> {
  const images = new Map<string, DecodedVisual>();
  await Promise.all(
    Object.entries(project.assets ?? {}).map(async ([id, asset]) => {
      if (!asset.blob) return;
      const image = await decodeBlobImage(asset.blob);
      if (!image) return;
      images.set(id, {
        source: image,
        width: image.naturalWidth || asset.width || 1,
        height: image.naturalHeight || asset.height || 1,
      });
    }),
  );
  return images;
}
