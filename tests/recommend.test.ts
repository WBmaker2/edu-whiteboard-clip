import { describe, expect, it } from "vitest";
import { recommendStyle, resolveTheme, resolveVisual } from "../src/lib/recommend";

describe("style recommendation", () => {
  it("maps engineering and math topics to the blueprint diagram look", () => {
    expect(recommendStyle("로켓이 중력을 이기고 우주로 나아가는 원리")).toEqual({
      themeId: "blueprint",
      visualStyle: "diagram",
    });
    expect(recommendStyle("미분이 순간의 변화를 계산하는 원리").themeId).toBe("blueprint");
  });

  it("maps history and literature topics to the editorial look", () => {
    expect(recommendStyle("조선 후기 실학이 세상을 바꾼 방식").themeId).toBe("editorial");
    expect(recommendStyle("은유와 상징이 시의 의미를 만드는 방법").themeId).toBe("editorial");
  });

  it("maps computer science topics to the midnight marker look", () => {
    expect(recommendStyle("생성형 AI가 문장을 만드는 원리")).toEqual({
      themeId: "midnight",
      visualStyle: "marker",
    });
  });

  it("maps biology topics to the paper illustration look", () => {
    expect(recommendStyle("광합성이 빛을 양분으로 바꾸는 과정")).toEqual({
      themeId: "paper",
      visualStyle: "illustration",
    });
  });

  it("falls back to the subject when the topic has no keyword", () => {
    expect(recommendStyle("어떤 주제", { grade: "중등", subject: "수학", standards: "" }).themeId).toBe(
      "blueprint",
    );
  });

  it("uses a safe default when nothing matches", () => {
    expect(recommendStyle("알 수 없는 주제")).toEqual({
      themeId: "paper",
      visualStyle: "diagram",
    });
  });

  it("keeps an explicit selection instead of auto", () => {
    expect(resolveTheme("midnight", "광합성")).toBe("midnight");
    expect(resolveVisual("marker", "광합성")).toBe("marker");
  });

  it("resolves auto through the recommendation", () => {
    expect(resolveTheme("auto", "광합성")).toBe("paper");
    expect(resolveVisual("auto", "생성형 AI")).toBe("marker");
  });
});
