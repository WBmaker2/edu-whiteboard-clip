import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../src/App";

afterEach(() => {
  cleanup();
});

describe("App shell", () => {
  it("renders the studio title, brand and primary actions", () => {
    render(<App />);
    expect(document.title).toBe("교육용 화이트보드 영상 만들기");
    expect(screen.getAllByText("판서랩").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /화이트보드 교육 영상 생성하기/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /예시 프로젝트로 먼저 둘러보기/ }),
    ).toBeInTheDocument();
  });

  it("shows the studio settings tab as selected by default", () => {
    render(<App />);
    const settingsTab = screen.getByRole("tab", { name: /스튜디오 설정/ });
    const monitorTab = screen.getByRole("tab", { name: /영상 모니터/ });
    expect(settingsTab).toHaveAttribute("aria-selected", "true");
    expect(monitorTab).toHaveAttribute("aria-selected", "false");
  });
});
