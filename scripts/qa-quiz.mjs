import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-quiz-qa";

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
  permissions: ["clipboard-read", "clipboard-write"],
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(800);

await page.getByRole("button", { name: /AI 퀴즈/ }).click();
await page.getByRole("dialog", { name: "AI 웹 퀴즈" }).waitFor({ timeout: 10000 });
await page.getByRole("button", { name: /학생 링크 복사/ }).click();
await page.waitForTimeout(600);
const quizUrl = await page.evaluate(() => navigator.clipboard.readText());
check("quiz link copied", quizUrl.includes("#quiz="), `${quizUrl.length} chars`);
check("quiz link within limit", quizUrl.length < 8000, `${quizUrl.length}`);
await page.keyboard.press("Escape");

const student = await context.newPage();
await student.goto(quizUrl);
await student.waitForTimeout(800);
check("quiz viewer renders", (await student.getByText(/학생용 퀴즈/).count()) > 0);
const optionCount = await student.locator(".quiz-option").count();
check("quiz options rendered", optionCount > 0, `${optionCount}`);

const submitButton = student.getByRole("button", { name: /제출하고 채점하기/ });
check("submit disabled before answers", await submitButton.isDisabled());
const questionCards = await student.locator(".quiz-card").count();
const mcCount = await student.locator(".quiz-question-head").count();
for (let index = 0; index < questionCards; index += 1) {
  const card = student.locator(".quiz-card").nth(index);
  const options = card.locator(".quiz-option");
  if ((await options.count()) > 0) {
    await options.first().click();
  } else {
    await card.locator("textarea").fill("광합성은 빛 에너지를 양분으로 바꾸는 과정입니다.");
  }
}
check("all questions answered", mcCount > 0);
await submitButton.click();
await student.waitForTimeout(600);
check("score shown after submit", (await student.getByText(/정답/).count()) > 0);
check("feedback shown", (await student.locator(".quiz-feedback").count()) > 0);

const downloadJson = student.waitForEvent("download", { timeout: 15000 });
await student.getByRole("button", { name: /결과 JSON 저장/ }).click();
const jsonDownload = await downloadJson;
const jsonPath = path.join(OUT, "quiz-result.json");
await jsonDownload.saveAs(jsonPath);
const result = JSON.parse(await readFile(jsonPath, "utf8"));
check("result json kind", result.kind === "panseolab-quiz-result");
check(
  "result json summary",
  typeof result.summary?.correctCount === "number" && result.summary?.totalScore > 0,
  JSON.stringify(result.summary),
);

const downloadPng = student.waitForEvent("download", { timeout: 15000 });
await student.getByRole("button", { name: /결과 이미지 저장/ }).click();
const pngDownload = await downloadPng;
await pngDownload.saveAs(path.join(OUT, "quiz-result.png"));
check("result image saved", pngDownload.suggestedFilename().endsWith(".png"));

await student.screenshot({ path: path.join(OUT, "quiz-viewer.png"), fullPage: true });
await browser.close();

const report = { checks, errors };
console.log(JSON.stringify(report, null, 2));
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
