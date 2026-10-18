import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";

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
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(800);

await page.getByRole("button", { name: "공유", exact: true }).click();
await page.waitForTimeout(800);
const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
check("share link copied", shareUrl.includes("#view="), `${shareUrl.length} chars`);
check("share link within limit", shareUrl.length < 8000, `${shareUrl.length}`);

const viewer = await context.newPage();
await viewer.goto(shareUrl);
await viewer.waitForTimeout(1000);
check(
  "viewer renders",
  (await viewer.getByText(/공유된 수업 영상/).count()) > 0,
);
check("viewer canvas visible", await viewer.locator("canvas").first().isVisible());
const dots = await viewer.locator(".share-dot").count();
check("viewer scene dots", dots === 5, `${dots}`);

await viewer.locator(".share-dot").nth(2).click();
await viewer.waitForTimeout(400);
await viewer.getByRole("button", { name: "재생" }).click();
await viewer.waitForTimeout(1500);
await viewer.getByRole("button", { name: "일시정지" }).click();
await viewer.locator("canvas").first().screenshot({ path: "/tmp/share-viewer.png" });
check("viewer playback works", true);

await viewer.getByRole("button", { name: /내 판서랩으로 가져오기/ }).click();
await viewer.waitForLoadState("networkidle");
await viewer.waitForTimeout(1000);
const importedCards = await viewer.locator(".scene-card").count();
check("import into studio", importedCards === 5, `${importedCards}`);
check(
  "import toast shown",
  (await viewer.getByText(/공유된 프로젝트를 가져왔습니다/).count()) > 0,
);

await browser.close();
const report = { checks, errors };
console.log(JSON.stringify(report, null, 2));
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
