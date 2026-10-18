import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import { migrateStoredProject } from "../src/lib/migrations";
import { parseProjectJson, serializeProject } from "../src/lib/export/project";
import type { Project } from "../src/types/project";

describe("project schema v2 migration", () => {
  it("fills aspect and assets for stored v1 projects", () => {
    const demo = createDemoProject();
    const legacy = {
      ...demo,
      version: 1,
      aspect: undefined,
      assets: undefined,
    } as unknown as Project;

    const migrated = migrateStoredProject(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.aspect).toBe("16:9");
    expect(migrated.assets).toEqual({});
    expect(migrated.scenes).toHaveLength(demo.scenes.length);
  });

  it("keeps v2 projects unchanged", () => {
    const demo = createDemoProject();
    expect(migrateStoredProject(demo)).toBe(demo);
  });
});

describe("project JSON with assets", () => {
  it("round-trips formula assets and beat visuals", async () => {
    const demo = createDemoProject();
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const project: Project = {
      ...demo,
      assets: {
        asset_test: {
          id: "asset_test",
          kind: "formula",
          source: "formula",
          mime: "image/png",
          blob: png,
          latex: "E = mc^2",
          width: 400,
          height: 120,
        },
      },
      scenes: demo.scenes.map((scene, index) =>
        index === 0
          ? {
              ...scene,
              beats: scene.beats.map((beat, beatIndex) =>
                beatIndex === 0
                  ? {
                      ...beat,
                      visual: { kind: "formula" as const, assetId: "asset_test" },
                    }
                  : beat,
              ),
            }
          : scene,
      ),
    };

    const json = await serializeProject(project, true);
    expect(json).toContain("asset_test");
    expect(json).toContain("E = mc^2");

    const parsed = parseProjectJson(json);
    expect(parsed.version).toBe(2);
    expect(parsed.assets.asset_test.kind).toBe("formula");
    expect(parsed.assets.asset_test.latex).toBe("E = mc^2");
    expect(parsed.assets.asset_test.blob).toBeInstanceOf(Blob);
    expect(parsed.scenes[0].beats[0].visual?.assetId).toBe("asset_test");
  });

  it("migrates v1 JSON and drops visuals that reference missing assets", () => {
    const demo = createDemoProject();
    const legacy = JSON.parse(JSON.stringify(demo));
    legacy.version = 1;
    delete legacy.aspect;
    delete legacy.assets;
    legacy.scenes[0].beats[0].visual = { kind: "image", assetId: "missing" };

    const parsed = parseProjectJson(JSON.stringify(legacy));
    expect(parsed.version).toBe(2);
    expect(parsed.aspect).toBe("16:9");
    expect(parsed.assets).toEqual({});
    expect(parsed.scenes[0].beats[0].visual).toBeUndefined();
  });
});
