import { useEffect, useRef, useState } from "react";
import type { Project } from "../types/project";
import { blobKey, preloadProjectImages } from "../lib/assets";
import type { DecodedVisual } from "../lib/renderer/core";

/** Decodes every asset blob of the project and keeps the map stable per asset revision. */
export function useAssetImages(project: Project | null): Map<string, DecodedVisual> {
  const projectRef = useRef(project);
  projectRef.current = project;
  const [images, setImages] = useState<Map<string, DecodedVisual>>(() => new Map());

  const key = project
    ? Object.entries(project.assets ?? {})
        .map(([id, asset]) => `${id}:${blobKey(asset.blob)}`)
        .join("|")
    : "";

  useEffect(() => {
    let cancelled = false;
    const current = projectRef.current;
    if (!current || key === "") {
      setImages(new Map());
      return;
    }
    void preloadProjectImages(current)
      .then((map) => {
        if (!cancelled) setImages(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key]);

  return images;
}
