import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-media-qa";
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
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.locator('[data-testid="project-import"]').setInputFiles(path.resolve("tests/fixtures/short-project.json"));
await page.waitForTimeout(700);

const firstCard = page.locator(".scene-card").first();
await firstCard.getByRole("button", { name: "대본/판서 수정" }).click();
await page.waitForTimeout(300);

// 1. Formula asset
await firstCard.getByRole("button", { name: "수식" }).first().click();
await page.waitForTimeout(1500);
check("formula editor opens", (await page.locator(".formula-editor").count()) > 0);
await page.locator(".formula-editor textarea").fill("a^2 + b^2 = c^2");
await page.waitForTimeout(600);
check("formula preview rendered", (await page.locator(".formula-preview .katex").count()) > 0);
await firstCard.getByRole("button", { name: "수식 저장" }).click();
await firstCard.locator(".beat-visual-thumb").first().waitFor({ timeout: 20000 });
check("formula thumb appears", (await firstCard.locator(".beat-visual-thumb").count()) > 0);
await page.screenshot({ path: path.join(OUT, "01-formula-editor.png") });

// 2. Image asset on the next beat
await firstCard.getByRole("button", { name: "이미지" }).first().click();
await page.locator('input[type="file"][accept="image/*"]').setInputFiles(
  path.resolve("tests/fixtures/tiny-image.png"),
);
await firstCard.locator(".beat-visual-thumb").nth(1).waitFor({ timeout: 15000 });
check("image thumb appears", (await firstCard.locator(".beat-visual-thumb").count()) > 1);
check("visual kind labels", (await firstCard.locator(".beat-visual-kind").count()) === 2);

await firstCard.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(600);
check("preview thumbs after save", (await firstCard.locator(".beat-preview-thumb").count()) === 2);

// 3. Canvas draws the photo in the paused preview frame (reveal-all)
await page.getByRole("tab", { name: /^1\./ }).click();
await page.waitForTimeout(800);
await page.locator("canvas.stage-canvas").screenshot({ path: path.join(OUT, "02-canvas-with-visual.png") });
const photoPixels = await page.evaluate(() => {
  const canvas = document.querySelector("canvas.stage-canvas");
  if (!canvas) return -1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return -1;
  const data = ctx.getImageData(0, 230, 1920, 300).data;
  let tapeColored = 0;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    if (r > 200 && g > 180 && b < 160 && r - b > 60) tapeColored += 1;
  }
  return tapeColored;
});
check("visual drawn on canvas", photoPixels > 60, `orange pixels: ${photoPixels}`);

// 4. JSON export carries assets
const downloadJson = page.waitForEvent("download", { timeout: 20000 });
await page.locator('button[title*="JSON"]').click();
const jsonDownload = await downloadJson;
const exportPath = path.join(OUT, "media-project.json");
await jsonDownload.saveAs(exportPath);
const exported = JSON.parse(await readFile(exportPath, "utf8"));
const assetIds = Object.keys(exported.assets ?? {});
check("json version 2", exported.version === 2);
check("json has 2 assets", assetIds.length === 2, assetIds.join(", "));
check(
  "json keeps formula latex",
  assetIds.some((id) => exported.assets[id].latex === "a^2 + b^2 = c^2"),
);
check(
  "json keeps beat visuals",
  exported.scenes[0].beats.filter((beat) => beat.visual).length === 2,
);

// 5. Re-import restores visuals
await page.locator('[data-testid="project-import"]').setInputFiles(exportPath);
await page.waitForTimeout(800);
const restoredCard = page.locator(".scene-card").first();
check("import restores thumbs", (await restoredCard.locator(".beat-preview-thumb").count()) === 2);

// 6. Short video export still completes with assets
const downloadVideo = page.waitForEvent("download", { timeout: 120000 });
await page.getByRole("button", { name: /비디오 내보내기/ }).click();
const videoDownload = await downloadVideo;
const videoPath = path.join(OUT, `media-export.${videoDownload.suggestedFilename().split(".").pop()}`);
await videoDownload.saveAs(videoPath);
const videoStat = await readFile(videoPath);
check("video export with assets", videoStat.length > 1000, `${videoStat.length} bytes`);

// 7. SVG vector sheet export
await page.locator(".modal-dialog .secondary-button", { hasText: "닫기" }).click();
await page.waitForTimeout(400);
const downloadSvg = page.waitForEvent("download", { timeout: 20000 });
await page.locator('button[title*="SVG"]').click();
const svgDownload = await downloadSvg;
const svgPath = path.join(OUT, svgDownload.suggestedFilename());
await svgDownload.saveAs(svgPath);
const svgText = await readFile(svgPath, "utf8");
check("svg export", svgText.includes("<svg") && svgText.includes("</svg>"), `${svgText.length} bytes`);
check("svg has scene text", svgText.includes(exported.scenes[0].title));

const report = { checks, errors };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
