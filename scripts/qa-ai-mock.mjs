import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-ai-qa";
await mkdir(OUT, { recursive: true });

const story = [
  {
    type: "intro",
    title: "빛을 붙잡는 식물의 비밀",
    subtitle: "광합성은 빛 에너지를 양분으로 바꾸는 생명의 공장입니다.",
    beats: [
      { label: "햇빛", desc: "잎에 도착하는 에너지", narration: "식물은 햇빛을 받아 스스로 양분을 만드는 놀라운 능력을 가지고 있습니다.", iconType: "Sun" },
      { label: "엽록체", desc: "잎 속 작은 공장", narration: "잎 속 엽록체에는 빛을 흡수하는 녹색 색소인 엽록소가 가득 들어 있습니다.", iconType: "Leaf" },
      { label: "광합성", desc: "빛에서 양분으로", narration: "이 과정을 통해 식물은 빛 에너지를 당과 같은 화학 에너지로 저장합니다.", iconType: "Lightbulb" }
    ]
  },
  {
    type: "body",
    title: "1단계: 빛을 흡수하는 엽록소",
    subtitle: "엽록소가 특정 파장의 빛을 붙잡아 에너지로 바꿉니다.",
    beats: [
      { label: "빛 흡수", desc: "파장을 선택적으로 흡수", narration: "엽록소는 붉은빛과 푸른빛을 주로 흡수하고 녹색빛은 반사합니다.", iconType: "Sun" },
      { label: "전자 들뜸", desc: "에너지가 전자를 밀어올림", narration: "흡수한 빛 에너지는 전자를 높은 에너지 상태로 끌어올립니다.", iconType: "Zap" },
      { label: "물 분해", desc: "물이 산소와 수소로", narration: "이때 물 분자가 분해되면서 산소가 공기 중으로 방출됩니다.", iconType: "Droplets" }
    ]
  },
  {
    type: "body",
    title: "2단계: ATP와 NADPH 만들기",
    subtitle: "빛 반응에서 만들어진 에너지 운반체가 다음 단계를 준비합니다.",
    beats: [
      { label: "ATP 합성", desc: "에너지 저장 분자 생성", narration: "전자 전달 과정에서 ATP라는 에너지 저장 분자가 만들어진다.", iconType: "BatteryCharging" },
      { label: "NADPH", desc: "수소 운반체 완성", narration: "동시에 NADPH가 생성되어 수소와 전자를 운반할 준비를 마칩니다.", iconType: "Atom" },
      { label: "빛 반응", desc: "틸라코이드 막에서", narration: "이 모든 반응은 엽록체 안의 틸라코이드 막에서 빠르게 진행됩니다.", iconType: "Cpu" }
    ]
  },
  {
    type: "body",
    title: "3단계: 탄소를 붙여 포도당 만들기",
    subtitle: "캘빈 회로가 이산화탄소를 고정해 당을 합성합니다.",
    beats: [
      { label: "CO2 고정", desc: "공기 중 탄소 포집", narration: "캘빈 회로에서는 이산화탄소가 루비스코 효소에 의해 고정됩니다.", iconType: "Coffee" },
      { label: "당 합성", desc: "탄소 골격 연결", narration: "고정된 탄소는 여러 단계를 거쳐 포도당으로 조립됩니다.", iconType: "Star" },
      { label: "산소 배출", desc: "부산물은 공기로", narration: "광합성의 부산물로 만들어진 산소는 우리가 호흡하는 공기가 됩니다.", iconType: "HeartPulse" }
    ]
  },
  {
    type: "outro",
    title: "정리: 식물이 만드는 순환",
    subtitle: "광합성은 생태계의 에너지와 산소를 공급하는 핵심 과정입니다.",
    beats: [
      { label: "빛에서 화학으로", desc: "에너지 전환의 핵심", narration: "빛 에너지는 화학 에너지로 전환되어 식물과 동물의 먹이가 됩니다.", iconType: "Zap" },
      { label: "산소 순환", desc: "호흡과 맞물린 고리", narration: "광합성으로 만들어진 산소는 생물의 호흡에 다시 사용됩니다.", iconType: "HeartPulse" },
      { label: "탄소 순환", desc: "지구를 지키는 균형", narration: "식물은 이산화탄소를 흡수해 기후를 조절하는 중요한 역할을 합니다.", iconType: "ShieldCheck" }
    ]
  }
];

const sampleRate = 24000;
const seconds = 1.2;
const samples = Math.floor(sampleRate * seconds);
const pcm = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i += 1) {
  const value = Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 900);
  pcm.writeInt16LE(value, i * 2);
}
const audioB64 = pcm.toString("base64");

const imageB64 = (await readFile(path.join(process.cwd(), "tests/fixtures/tiny-image.png"))).toString("base64");

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

await page.route("**/v1beta/models/*:predict*", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      predictions: [{ bytesBase64Encoded: imageB64, mimeType: "image/png" }],
    }),
  });
});

await page.route("**/v1beta/models/*:generateContent*", async (route) => {
  const url = route.request().url();
  const isTts = url.includes("tts");
  if (isTts) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { data: audioB64 } }] } }],
      }),
    });
  } else {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(story) }] } }],
      }),
    });
  }
});

const shotCanvas = async (name) => {
  const dataUrl = await page.evaluate(() => document.querySelectorAll("canvas")[0].toDataURL("image/png"));
  await writeFile(path.join(OUT, name), Buffer.from(dataUrl.split(",")[1], "base64"));
};

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByPlaceholder("AIzaSy... (Gemini API Key)").fill("AIzaSyTESTKEY1234567890123456789012345");
await page.getByRole("button", { name: /화이트보드 교육 영상 생성하기/ }).click();
await page.waitForFunction(() => document.body.textContent?.includes("교육용 영상 제작 완료"), undefined, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(900);
check("generated scenes", (await page.getByRole("tab", { name: /정리/ }).count()) > 0);
check("generated duration", (await page.locator(".soft-chip.is-blue").textContent())?.includes("5씬"));
await page.screenshot({ path: path.join(OUT, "01-generated.png"), fullPage: true });
const badges = await page.locator(".audio-badge.tone-ai").count();
check("tts audio applied", badges === 5, `${badges} scenes`);

await page.getByRole("button", { name: "재생", exact: true }).click();
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "일시정지", exact: true }).click();
await shotCanvas("02-audio-canvas.png");

await page.getByRole("button", { name: /엔지니어링 블루프린트/ }).click();
await page.waitForTimeout(400);
await page.getByRole("tab", { name: /3. 전개 2/ }).click();
await page.waitForTimeout(400);
await shotCanvas("03-mindmap-blueprint.png");

await page.getByRole("button", { name: /비교 & 대조/ }).click();
await page.getByRole("tab", { name: /4. 전개 3/ }).click();
await page.waitForTimeout(400);
await shotCanvas("04-comparison-blueprint.png");

await page.getByRole("button", { name: /인포그래픽 쇼케이스/ }).click();
await page.getByRole("tab", { name: /2. 전개 1/ }).click();
await page.waitForTimeout(400);
await shotCanvas("05-infographic-blueprint.png");
await page.screenshot({ path: path.join(OUT, "06-workspace.png"), fullPage: true });

await page.getByRole("button", { name: "대본/판서 수정" }).first().click();
await page.getByRole("button", { name: "AI 이미지" }).first().click();
await page.getByPlaceholder(/만들고 싶은 이미지를 설명하세요/).fill("광합성 과정 손그림 다이어그램");
await page.getByRole("button", { name: "이미지 생성" }).click();
await page.waitForSelector(".beat-visual-thumb:not(.is-empty)", { timeout: 20000 });
await page.waitForTimeout(300);
const aiKind = await page.locator(".beat-visual-kind").first().textContent();
check("ai image kind", aiKind?.trim() === "AI 이미지", aiKind ?? "none");
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "06b-ai-image.png"), fullPage: true });
const aiThumbs = await page.locator(".beat-preview-thumb").count();
check("ai image persisted", aiThumbs > 0, `${aiThumbs} previews`);

const exportDownload = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
await page.getByRole("button", { name: "비디오 내보내기" }).click();
await page.waitForFunction(
  () => document.body.textContent?.includes("영상 파일이 준비되었습니다"),
  undefined,
  { timeout: 30000 },
);
const videoDownload = await exportDownload;
if (videoDownload) {
  check("ai video extension", videoDownload.suggestedFilename().endsWith(".webm"), videoDownload.suggestedFilename());
  await videoDownload.saveAs(path.join(OUT, "ai-video.webm"));
  const video = await readFile(path.join(OUT, "ai-video.webm"));
  check("ai video export", video.byteLength > 20_000, `${video.byteLength} bytes`);
} else {
  check("ai video export", false, "download not observed");
}
await page.screenshot({ path: path.join(OUT, "07-export.png") });

const report = { checks, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
