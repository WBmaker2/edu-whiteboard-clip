import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
});
const page = await context.newPage();

const results = [];
const run = async (name) => {
  const analysis = await new AxeBuilder({ page }).analyze();
  const serious = analysis.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  results.push({ name, serious });
  console.log(
    `\n[${name}] 위반 ${analysis.violations.length}건 · serious/critical ${serious.length}건`,
  );
  for (const violation of analysis.violations) {
    console.log(
      `  - (${violation.impact}) ${violation.id}: ${violation.help} [${violation.nodes.length} nodes]`,
    );
  }
};

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await run("설정 화면");

await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(600);
await run("모니터 화면");

await page.getByRole("button", { name: "도움말" }).click();
await page.getByRole("dialog", { name: "사용 안내" }).waitFor({ timeout: 15000 });
await page.waitForTimeout(300);
await run("도움말 모달");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.locator('button[title="저장 기록"]').click();
await page.getByRole("dialog", { name: "저장 기록" }).waitFor({ timeout: 15000 });
await page.waitForTimeout(300);
await run("저장 기록 모달");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await browser.close();

const failures = results.filter((result) => result.serious.length > 0);
if (failures.length > 0) {
  console.error("\n접근성 검사 실패: serious/critical 위반이 있습니다.");
  for (const failure of failures) {
    for (const violation of failure.serious) {
      console.error(`  - [${failure.name}] ${violation.id}: ${violation.help}`);
    }
  }
  process.exit(1);
}
console.log("\n접근성 검사 통과 (serious/critical 0건)");
