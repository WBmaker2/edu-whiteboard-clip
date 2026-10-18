import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const UPDATE = process.env.QA_PIXEL_UPDATE === "1";
const GOLDEN_DIR = path.join(process.cwd(), "tests", "fixtures", "golden");
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-pixel";
await mkdir(OUT, { recursive: true });
await mkdir(GOLDEN_DIR, { recursive: true });

const DIFF_RATIO_LIMIT = 0.005;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
});
const page = await context.newPage();

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const canvas = page.locator("canvas.stage-canvas");

async function capture(name) {
  await canvas.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  const buffer = await canvas.screenshot();
  const goldenPath = path.join(GOLDEN_DIR, `${name}.png`);
  if (UPDATE) {
    await writeFile(goldenPath, buffer);
    check(`${name} golden updated`, true, `${buffer.length} bytes`);
    return;
  }
  let golden;
  try {
    golden = await readFile(goldenPath);
  } catch {
    check(`${name} golden exists`, false, "골든 이미지가 없습니다. QA_PIXEL_UPDATE=1로 생성하세요.");
    return;
  }
  const goldenPng = PNG.sync.read(golden);
  const currentPng = PNG.sync.read(buffer);
  if (goldenPng.width !== currentPng.width || goldenPng.height !== currentPng.height) {
    check(`${name} pixel match`, false, `크기 다름 ${goldenPng.width}x${goldenPng.height} vs ${currentPng.width}x${currentPng.height}`);
    return;
  }
  const diff = new PNG({ width: goldenPng.width, height: goldenPng.height });
  const mismatch = pixelmatch(
    goldenPng.data,
    currentPng.data,
    diff.data,
    goldenPng.width,
    goldenPng.height,
    { threshold: 0.1 },
  );
  const ratio = mismatch / (goldenPng.width * goldenPng.height);
  if (ratio > DIFF_RATIO_LIMIT) {
    await writeFile(path.join(OUT, `${name}-current.png`), buffer);
    await writeFile(path.join(OUT, `${name}-diff.png`), PNG.sync.write(diff));
    check(`${name} pixel match`, false, `diff ${(ratio * 100).toFixed(2)}%`);
  } else {
    check(`${name} pixel match`, true, `diff ${(ratio * 100).toFixed(3)}%`);
  }
}

await capture("poster_paper");

await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(700);

async function pickLayout(pattern) {
  await page.getByRole("button", { name: pattern }).click();
  await page.waitForTimeout(300);
}

async function pickScene(index) {
  await page.getByRole("tab", { name: new RegExp(`^${index + 1}\\.`) }).click();
  await page.waitForTimeout(300);
}

await pickLayout(/스마트 적응형/);
await pickScene(1);
await capture("adaptive_scene2");

await pickLayout(/단계별 플로우/);
await pickScene(1);
await capture("flow_scene2");

await pickLayout(/방사형 마인드맵/);
await pickScene(1);
await capture("mindmap_scene2");

await pickLayout(/비교 & 대조 듀얼/);
await pickScene(1);
await capture("comparison_scene2");

await pickLayout(/인포그래픽 쇼케이스/);
await pickScene(1);
await capture("infographic_scene2");

await pickLayout(/스마트 적응형/);
await pickScene(4);
await capture("adaptive_scene5");

await page.getByRole("button", { name: /세로 9:16/ }).click();
await page.waitForTimeout(400);
await pickScene(0);
await capture("vertical_intro");
await pickScene(1);
await capture("vertical_scene2");

await browser.close();

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`\n픽셀 검사 실패 ${failed.length}건`);
  process.exit(1);
}
console.log(`\n픽셀 검사 통과 (${checks.length}건)`);
