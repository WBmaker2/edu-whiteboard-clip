import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-v2-qa";
await mkdir(OUT, { recursive: true });

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

function ffprobe(args) {
  try {
    return execFileSync("ffprobe", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function ffprobeDuration(file) {
  const output = ffprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    file,
  ]);
  try {
    const duration = Number(JSON.parse(output)?.format?.duration);
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

const sampleRate = 24000;
const seconds = 1.2;
const samples = Math.floor(sampleRate * seconds);
const pcm = Buffer.alloc(samples * 2);
for (let index = 0; index < samples; index += 1) {
  pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 900), index * 2);
}
const audioB64 = pcm.toString("base64");

const rewritten = {
  title: "AI가 다시 쓴 도입 장면",
  subtitle: "재작성 결과를 확인하기 위한 요약 문장입니다.",
  beats: [
    { label: "새 개념", desc: "핵심 개념 소개", narration: "첫 번째로 새 개념을 소개합니다.", iconType: "Sun" },
    { label: "새 원리", desc: "작동 원리 설명", narration: "두 번째로 작동 원리를 설명합니다.", iconType: "Zap" },
    { label: "새 적용", desc: "실생활 적용", narration: "세 번째로 실생활 적용을 살펴봅니다.", iconType: "Check" },
  ],
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

await page.route("**/v1beta/models/*:generateContent*", async (route) => {
  const isTts = route.request().url().includes("tts");
  if (isTts) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { data: audioB64 } }] } }],
      }),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(rewritten) }] } }],
    }),
  });
});

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(700);

// 1. Scene editing
const sceneCards = page.locator(".scene-card");
check("initial scene count", (await sceneCards.count()) === 5, `${await sceneCards.count()}`);
await page.getByRole("button", { name: /장면 추가/ }).click();
await page.waitForTimeout(400);
check("scene added", (await sceneCards.count()) === 6, `${await sceneCards.count()}`);
await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(300);
check("undo scene add", (await sceneCards.count()) === 5, `${await sceneCards.count()}`);
await page.keyboard.press("ControlOrMeta+Shift+z");
await page.waitForTimeout(300);
check("redo scene add", (await sceneCards.count()) === 6, `${await sceneCards.count()}`);

const editCard = page.locator(".scene-card").nth(2);
await editCard.getByRole("button", { name: "대본/판서 수정" }).click();
await page.getByRole("button", { name: /비트 추가/ }).click();
await page.waitForTimeout(200);
check("beat added in editor", (await editCard.locator(".beat-editor").count()) === 4);
await editCard.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(400);
check("beat saved", (await editCard.locator(".beat-preview").count()) === 4);

const secondTitle = await sceneCards.nth(1).locator(".scene-title strong").textContent();
await sceneCards.nth(1).getByRole("button", { name: "씬 아래로 이동" }).click();
await page.waitForTimeout(400);
const thirdTitle = await sceneCards.nth(2).locator(".scene-title strong").textContent();
check("scene moved", secondTitle === thirdTitle, `${secondTitle} -> ${thirdTitle}`);

await page.waitForTimeout(2200);
const autosaveText = await page.locator(".autosave-status").first().textContent();
check("autosave ran", /자동 저장됨/.test(autosaveText ?? ""), autosaveText ?? "");

await page.reload();
await page.waitForLoadState("networkidle");
const banner = page.locator(".draft-banner");
check("draft banner", (await banner.count()) > 0);
await banner.getByRole("button", { name: "이어서 작업" }).click();
await page.waitForTimeout(800);
check("draft restored", (await page.locator(".scene-card").count()) === 6, `${await page.locator(".scene-card").count()}`);

// 2. Rewrite with mocked Gemini + mocked TTS
await page.getByPlaceholder("AIzaSy... (Gemini API Key)").fill("AIzaSyTESTKEY1234567890123456789012345");
await page.waitForTimeout(200);
const firstCard = page.locator(".scene-card").first();
await firstCard.getByRole("button", { name: "AI로 다시 쓰기" }).click();
await page.waitForTimeout(300);
check("rewrite modal", (await page.getByRole("dialog", { name: "AI로 장면 다시 쓰기" }).count()) > 0);
await page.getByRole("button", { name: "재작성안 만들기" }).click();
await page.waitForSelector(".diff-row", { timeout: 20000 });
check("rewrite diff", (await page.locator(".diff-row.is-changed").count()) > 0);
await page.screenshot({ path: path.join(OUT, "01-rewrite.png") });
const rewriteDialog = page.getByRole("dialog", { name: "AI로 장면 다시 쓰기" });
await rewriteDialog.getByRole("checkbox", { name: /음성도 함께/ }).check();
await page.getByRole("button", { name: "적용하고 음성 생성" }).click();
await page.waitForSelector('div[role="dialog"][aria-label="AI로 장면 다시 쓰기"]', {
  state: "detached",
  timeout: 30000,
});
await page.waitForTimeout(400);
const updatedTitle = await firstCard.locator(".scene-title strong").textContent();
check("rewrite applied", updatedTitle === rewritten.title, updatedTitle ?? "");
check("rewrite audio applied", (await firstCard.locator(".audio-badge.tone-ai").count()) > 0);
check("no stale after audio rewrite", (await firstCard.locator(".tone-stale").count()) === 0);

// 3. Editing narration marks audio stale
await firstCard.getByRole("button", { name: "대본/판서 수정" }).click();
const firstNarration = firstCard.locator(".compact-area").first();
await firstNarration.fill("완전히 다른 나레이션으로 수정했습니다.");
await firstCard.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(500);
check("stale badge appears", (await firstCard.locator(".tone-stale").count()) > 0);
await page.screenshot({ path: path.join(OUT, "02-stale.png") });

await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(500);
check("edit undo", (await firstCard.locator(".tone-stale").count()) === 0);
check("edit undo title", (await firstCard.locator(".scene-title strong").textContent()) === rewritten.title);
await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(500);
check("rewrite undo", (await firstCard.locator(".scene-title strong").textContent()) !== rewritten.title);

// 4. History modal
await page.getByRole("button", { name: "초안 저장" }).first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "기록", exact: true }).click();
await page.waitForTimeout(500);
check("history modal", (await page.getByRole("dialog", { name: "저장 기록" }).count()) > 0);
check("history has snapshot", (await page.locator(".history-item").count()) > 0);
await page.keyboard.press("Escape");

// 5. WebM export with duration metadata
await page.locator('input[type="file"]').setInputFiles(path.resolve("tests/fixtures/short-project.json"));
await page.waitForTimeout(600);
const webmDownload = page.waitForEvent("download", { timeout: 30000 });
await page.getByRole("button", { name: "비디오 내보내기" }).click();
await page.waitForFunction(
  () => document.body.textContent?.includes("영상 파일이 준비되었습니다"),
  undefined,
  { timeout: 30000 },
);
const webm = await webmDownload;
await webm.saveAs(path.join(OUT, "short.webm"));
const webmDuration = ffprobeDuration(path.join(OUT, "short.webm"));
check("webm duration metadata", webmDuration !== null && Math.abs(webmDuration - 3) < 0.4, String(webmDuration));
await page.getByRole("button", { name: "닫기" }).last().click();
await page.waitForTimeout(400);

// 6. MP4 via WebCodecs (falls back gracefully when the Chromium build lacks H.264)
const h264 = await page.evaluate(async () => {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
    return "no-webcodecs";
  }
  try {
    const video = await VideoEncoder.isConfigSupported({
      codec: "avc1.640028",
      width: 1280,
      height: 720,
      bitrate: 4_000_000,
      framerate: 30,
    });
    const audio = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    });
    return video.supported && audio.supported ? "supported" : "unsupported";
  } catch {
    return "error";
  }
});
check("webcodecs detected", h264 !== "no-webcodecs", h264);

await page.selectOption('select[aria-label="내보내기 파일 형식"]', "mp4");
const mp4Download = page.waitForEvent("download", { timeout: 40000 });
await page.getByRole("button", { name: "비디오 내보내기" }).click();
await page.waitForFunction(
  () => document.body.textContent?.includes("영상 파일이 준비되었습니다"),
  undefined,
  { timeout: 40000 },
);
const mp4 = await mp4Download;
const mp4Name = mp4.suggestedFilename();
if (h264 === "supported") {
  check("mp4 exported", mp4Name.endsWith(".mp4"), mp4Name);
  await mp4.saveAs(path.join(OUT, "short.mp4"));
  const mp4Duration = ffprobeDuration(path.join(OUT, "short.mp4"));
  check("mp4 duration", mp4Duration !== null && Math.abs(mp4Duration - 3) < 0.5, String(mp4Duration));
  const streams = ffprobe([
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,codec_type",
    "-of",
    "json",
    path.join(OUT, "short.mp4"),
  ]);
  check("mp4 codecs", streams.includes('"h264"') && streams.includes('"aac"'));
} else {
  check("mp4 graceful fallback", mp4Name.endsWith(".webm"), mp4Name);
  await mp4.saveAs(path.join(OUT, "short-fallback.webm"));
  const fallbackDuration = ffprobeDuration(path.join(OUT, "short-fallback.webm"));
  check("fallback duration", fallbackDuration !== null && Math.abs(fallbackDuration - 3) < 0.4, String(fallbackDuration));
}
await page.screenshot({ path: path.join(OUT, "03-export.png") });

// 7. Mobile layout has no horizontal overflow
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.waitForLoadState("networkidle");
const mobileBanner = page.locator(".draft-banner");
if ((await mobileBanner.count()) > 0) {
  await mobileBanner.getByRole("button", { name: "이어서 작업" }).click();
  await page.waitForTimeout(700);
}
await page.getByRole("tab", { name: /영상 모니터/ }).click();
await page.waitForTimeout(400);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
check("mobile no horizontal overflow", overflow <= 2, `${overflow}px`);
await page.screenshot({ path: path.join(OUT, "04-mobile.png"), fullPage: true });

const report = { checks, errors, environment: { h264 } };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
