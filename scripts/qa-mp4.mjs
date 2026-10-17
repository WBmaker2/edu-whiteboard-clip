import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-mp4-qa";
const EXECUTABLE =
  process.env.QA_CHROME ??
  "/tmp/chrome-for-testing/chrome/mac_arm-155.0.8059.84/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
await mkdir(OUT, { recursive: true });

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

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  locale: "ko-KR",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.locator('input[type="file"]').setInputFiles(path.resolve("tests/fixtures/short-project.json"));
await page.waitForTimeout(600);

const support = await page.evaluate(async () => {
  try {
    const video = await VideoEncoder.isConfigSupported({
      codec: "avc1.640028",
      width: 1920,
      height: 1080,
      bitrate: 8_000_000,
      framerate: 30,
    });
    const audio = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    });
    return { video: video.supported, audio: audio.supported };
  } catch (error) {
    return { video: false, audio: false, error: String(error) };
  }
});
check("chrome h264+aac support", support.video && support.audio, JSON.stringify(support));

await page.selectOption('select[aria-label="내보내기 파일 형식"]', "mp4");
const download = page.waitForEvent("download", { timeout: 60000 });
await page.getByRole("button", { name: "비디오 내보내기" }).click();
await page.waitForFunction(
  () => document.body.textContent?.includes("영상 파일이 준비되었습니다"),
  undefined,
  { timeout: 60000 },
);
const file = await download;
const name = file.suggestedFilename();
check("mp4 file extension", name.endsWith(".mp4"), name);
await file.saveAs(path.join(OUT, "short.mp4"));
const streams = ffprobe([
  "-v",
  "error",
  "-show_entries",
  "stream=codec_name,codec_type,width,height",
  "-show_entries",
  "format=duration,size",
  "-of",
  "json",
  path.join(OUT, "short.mp4"),
]);
console.log(streams);
check("mp4 has h264+aac", streams.includes('"h264"') && streams.includes('"aac"'));
try {
  const parsed = JSON.parse(streams);
  const duration = Number(parsed?.format?.duration);
  check("mp4 duration", Math.abs(duration - 3) < 0.5, String(duration));
} catch {
  check("mp4 duration", false, streams);
}
await page.screenshot({ path: path.join(OUT, "export.png") });

const report = { checks, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
