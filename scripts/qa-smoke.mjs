import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-qa";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  locale: "ko-KR",
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

await page.goto(BASE);
await page.waitForLoadState("networkidle");
check("title", (await page.title()) === "교육용 화이트보드 영상 만들기");
check("brand", (await page.getByText("판서랩").first().count()) > 0);
await page.screenshot({ path: path.join(OUT, "01-home.png"), fullPage: true });

await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(600);
check("demo scenes", (await page.getByRole("tab", { name: /전개 1/ }).count()) > 0);
await page.screenshot({ path: path.join(OUT, "02-demo.png") });

await page.getByRole("button", { name: "재생", exact: true }).click();
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "일시정지", exact: true }).click();
const canvas = page.locator("canvas").first();
await canvas.screenshot({ path: path.join(OUT, "03-canvas.png") });
check("canvas visible", await canvas.isVisible());

const downloadJson = page.waitForEvent("download", { timeout: 20000 });
await page.getByRole("button", { name: "JSON 내보내기" }).click();
const jsonDownload = await downloadJson;
await jsonDownload.saveAs(path.join(OUT, "project.json"));
const exported = JSON.parse(await readFile(path.join(OUT, "project.json"), "utf8"));
check("json export", exported.version === 1 && exported.scenes.length === 5);

const downloadSrt = page.waitForEvent("download", { timeout: 20000 });
await page.locator('button[title*="SRT 자막"]').click();
const srtDownload = await downloadSrt;
await srtDownload.saveAs(path.join(OUT, "subtitles.srt"));
const srt = await readFile(path.join(OUT, "subtitles.srt"), "utf8");
check("srt export", srt.includes("-->") && srt.includes("식물"));

const downloadPng = page.waitForEvent("download", { timeout: 20000 });
await page.locator('button[title*="PNG로 저장"]').click();
const pngDownload = await downloadPng;
await pngDownload.saveAs(path.join(OUT, "scene.png"));
const png = await readFile(path.join(OUT, "scene.png"));
check("png export", png.byteLength > 10_000, `${png.byteLength} bytes`);

await page.getByRole("button", { name: "초안 저장" }).first().click();
await page.waitForTimeout(600);
await page.reload();
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "프로젝트", exact: true }).click();
await page.getByRole("menuitem", { name: /초안 불러오기/ }).click();
await page.waitForTimeout(800);
check("draft load", (await page.getByRole("tab", { name: /정리/ }).count()) > 0);

await page.getByRole("button", { name: "A4 학습지" }).click();
await page.waitForTimeout(400);
check("worksheet", (await page.getByRole("dialog", { name: "수업용 A4 요약 학습지" }).count()) > 0);
await page.screenshot({ path: path.join(OUT, "04-worksheet.png") });
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "AI 퀴즈" }).click();
await page.waitForTimeout(400);
check("quiz", (await page.getByRole("dialog", { name: "AI 웹 퀴즈" }).count()) > 0);
await page.locator(".quiz-option").first().click();
await page.getByRole("button", { name: /답안 제출하고 채점/ }).click();
await page.waitForTimeout(300);
check("quiz grading", (await page.getByText(/정답/).count()) > 0);
await page.screenshot({ path: path.join(OUT, "05-quiz.png") });
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "썸네일/카드" }).click();
await page.waitForTimeout(1400);
check("materials", (await page.locator(".card-preview").count()) === 5);
await page.screenshot({ path: path.join(OUT, "06-materials.png") });
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "발표 모드" }).click();
await page.waitForTimeout(700);
check("presentation", (await page.locator(".presentation-root").count()) > 0);
await page.keyboard.press("2");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "07-presentation.png") });
await page.keyboard.press("Escape");

const fixture = path.resolve("tests/fixtures/short-project.json");
await page.locator('input[type="file"]').setInputFiles(fixture);
await page.waitForTimeout(600);
check("import", (await page.getByRole("tab", { name: /1. 도입/ }).count()) > 0);

const exportDownload = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
await page.getByRole("button", { name: "비디오 내보내기" }).click();
await page.waitForTimeout(800);
check("export dialog", (await page.getByRole("dialog", { name: "비디오 내보내기" }).count()) > 0);
await page.waitForFunction(
  () => document.body.textContent?.includes("영상 파일이 준비되었습니다"),
  undefined,
  { timeout: 30000 },
);
const videoDownload = await exportDownload;
if (videoDownload) {
  check("video extension", videoDownload.suggestedFilename().endsWith(".webm"), videoDownload.suggestedFilename());
  await videoDownload.saveAs(path.join(OUT, "short-video.webm"));
  const video = await readFile(path.join(OUT, "short-video.webm"));
  check("video export", video.byteLength > 5_000, `${video.byteLength} bytes`);
} else {
  check("video export", false, "download event not observed");
}
await page.screenshot({ path: path.join(OUT, "08-export.png") });
await page.getByRole("button", { name: "닫기" }).last().click();

await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: path.join(OUT, "09-mobile-settings.png"), fullPage: true });
await page.getByRole("tab", { name: /영상 모니터/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "10-mobile-monitor.png"), fullPage: true });

const report = { checks, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
