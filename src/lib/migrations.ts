import type { AssetMeta, AspectRatio, Project } from "../types/project";

type StoredProject = Project & {
  aspect?: AspectRatio;
  assets?: Record<string, AssetMeta>;
};

/** Brings draft/snapshot projects stored by older app versions up to the current schema. */
export function migrateStoredProject(project: Project): Project {
  const stored = project as StoredProject;
  if (stored.version === 2 && stored.aspect && stored.assets) return stored;
  return {
    ...stored,
    version: 2,
    aspect: stored.aspect ?? "16:9",
    assets: stored.assets ?? {},
  };
}
