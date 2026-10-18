import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-ffmpeg-qa";

function ffprobe(args) {
  try {
    return execFileSync("ffprobe", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
  acceptDownloads: true,
})).newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 300)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text().slice(0, 300));
});

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.locator('[data-testid="project-import"]').setInputFiles(path.resolve("tests/fixtures/short-project.json"));
await page.waitForTimeout(800);

const webmDownload = page.waitForEvent("download", { timeout: 120000 });
await page.getByRole("button", { name: /비디오 내보내기/ }).click();
const webmFile = await webmDownload;
check("webm fallback export", webmFile.suggestedFilename().endsWith(".webm"), webmFile.suggestedFilename());

await page.waitForTimeout(600);
const convertButton = page.getByRole("button", { name: /MP4로 변환/ });
check("convert button offered", await convertButton.isVisible().catch(() => false));

if (await convertButton.isVisible().catch(() => false)) {
  const mp4Download = page.waitForEvent("download", { timeout: 420000 });
  await convertButton.click();
  const mp4File = await mp4Download;
  const mp4Path = path.join(OUT, "converted.mp4");
  await mp4File.saveAs(mp4Path);
  check("mp4 downloaded", mp4File.suggestedFilename().endsWith(".mp4"), mp4File.suggestedFilename());

  const streams = ffprobe([
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,codec_type,width,height",
    "-of",
    "json",
    mp4Path,
  ]);
  check("mp4 has h264+aac", streams.includes('"h264"') && streams.includes('"aac"'));
  check("mp4 keeps 1920x1080", streams.includes("1920") && streams.includes("1080"), streams.replace(/\s+/g, " ").slice(0, 120));
}

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();

if (checks.some((item) => !item.ok)) {
  console.error("\nffmpeg 변환 QA 실패");
  process.exit(1);
}
console.log("\nffmpeg 변환 QA 통과");
