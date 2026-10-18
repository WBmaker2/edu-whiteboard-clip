import { describe, expect, it } from "vitest";
import { dictionaryKeys, translate } from "../src/lib/i18n";

describe("i18n", () => {
  it("keeps ko and en dictionaries in sync", () => {
    const koKeys = dictionaryKeys("ko");
    const enKeys = dictionaryKeys("en");
    const missingInEn = koKeys.filter((key) => !enKeys.includes(key));
    const missingInKo = enKeys.filter((key) => !koKeys.includes(key));
    expect(missingInEn).toEqual([]);
    expect(missingInKo).toEqual([]);
  });

  it("translates known keys", () => {
    expect(translate("ko", "app.brand")).toBe("판서랩");
    expect(translate("en", "app.brand")).toBe("PanseoLab");
  });

  it("interpolates parameters", () => {
    expect(
      translate("ko", "storyboard.footerNote", { scenes: 5 }),
    ).toContain("5개");
    expect(
      translate("en", "monitor.autosaveSaved", { time: "12:30" }),
    ).toBe("Autosaved 12:30");
  });

  it("falls back to the key itself for missing entries", () => {
    expect(translate("en", "missing.key")).toBe("missing.key");
    expect(translate("ko", "missing.key")).toBe("missing.key");
  });
});
