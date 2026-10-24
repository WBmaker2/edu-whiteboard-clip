import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-library-qa";
await mkdir(OUT, { recursive: true });

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

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

const openLibrary = async () => {
  await page.getByRole("button", { name: "프로젝트", exact: true }).click();
  await page.getByRole("menuitem", { name: /내 수업/ }).click();
  await page.getByRole("dialog", { name: "내 수업" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
};

const cardCount = () => page.locator(".library-card").count();

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "초안 저장" }).first().click();
await page.waitForTimeout(700);

await openLibrary();
check("library opens with demo", (await cardCount()) === 1, `${await cardCount()}`);

const firstCard = page.locator(".library-card").first();
await firstCard.getByRole("button", { name: "이름 변경" }).click();
await firstCard.getByRole("textbox", { name: "수업 이름" }).fill("첫 수업");
await firstCard.getByRole("button", { name: "저장" }).click();
await page.waitForTimeout(500);
check(
  "rename project",
  (await page.locator(".library-card").first().textContent())?.includes("첫 수업") === true,
);

await page.getByRole("button", { name: /새 수업/ }).click();
await page.waitForTimeout(500);
check("new lesson clears editor", (await page.getByRole("tab", { name: /영상 모니터/ }).count()) === 1);
check("scene tabs cleared", (await page.getByRole("tab", { name: /^1\./ }).count()) === 0);

await page.locator('[data-testid="project-import"]').setInputFiles(
  path.resolve("tests/fixtures/short-project.json"),
);
await page.waitForTimeout(1200);
await openLibrary();
check("import adds a lesson", (await cardCount()) === 2, `${await cardCount()}`);

const newest = page.locator(".library-card").first();
await newest.getByRole("button", { name: "복제" }).click();
await page.waitForTimeout(700);
check("duplicate lesson", (await cardCount()) === 3, `${await cardCount()}`);

const topTitleBeforeOpen = (
  await page.locator(".library-card").first().locator(".library-meta strong").textContent()
)?.trim();
const openTarget = page.locator(".library-card").last();
await openTarget.getByRole("button", { name: "열기" }).click();
await page.waitForTimeout(700);
check("open lesson", (await page.getByRole("tab", { name: /1\. 도입/ }).count()) > 0);

await page.waitForTimeout(2200);
await openLibrary();
const topTitleAfterOpen = (
  await page.locator(".library-card").first().locator(".library-meta strong").textContent()
)?.trim();
check("opening does not bump recent order", topTitleAfterOpen === topTitleBeforeOpen, `${topTitleBeforeOpen} -> ${topTitleAfterOpen}`);
await page.keyboard.press("Escape");

await page.reload();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(900);
check("recent banner after reload", (await page.locator(".draft-banner").count()) > 0);
await page.getByRole("button", { name: "내 수업", exact: true }).click();
await page.getByRole("dialog", { name: "내 수업" }).waitFor({ timeout: 15000 });
await page.waitForTimeout(400);
check("lessons persist after reload", (await cardCount()) === 3, `${await cardCount()}`);

const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
await page.getByRole("button", { name: /전체 백업/ }).click();
const download = await downloadPromise;
const backupPath = path.join(OUT, "backup.json");
await download.saveAs(backupPath);
const backup = JSON.parse(await readFile(backupPath, "utf8"));
check("backup format", backup.format === "panseolab-backup" && backup.version === 1);
check("backup includes lessons", backup.projects.length === 3, `${backup.projects.length}`);

const deleteCard = page.locator(".library-card").first();
const deleteCountBefore = await cardCount();
await deleteCard.locator('button[aria-label^="삭제:"]').click();
await deleteCard.locator(".library-confirm .mini-button.is-danger").click();
await page.waitForTimeout(700);
check("delete lesson", (await cardCount()) === deleteCountBefore - 1, `${await cardCount()}`);

await page.locator('[data-testid="library-restore"]').setInputFiles(backupPath);
await page.waitForTimeout(400);
await page.locator(".library-confirm .mini-button.is-primary").click();
await page.waitForTimeout(1500);
check("restore adds lessons", (await cardCount()) === deleteCountBefore + 2, `${await cardCount()}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const overflow = await page.evaluate(() => {
  const dialog = document.querySelector(".modal-dialog");
  if (!dialog) return 999;
  const rect = dialog.getBoundingClientRect();
  return Math.max(0, Math.ceil(rect.right - window.innerWidth), Math.ceil(-rect.left));
});
check("library mobile fits viewport", overflow <= 2, `${overflow}px`);

const report = { checks, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await page.screenshot({ path: path.join(OUT, "library.png"), fullPage: true });
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
