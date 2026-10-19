import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-layout-qa";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
await page.waitForTimeout(600);

// Grow scene 2 to five beats
const card = page.locator(".scene-card").nth(1);
await card.getByRole("button", { name: "대본/판서 수정" }).click();
for (let index = 0; index < 2; index += 1) {
  await page.getByRole("button", { name: /비트 추가/ }).click();
  await page.waitForTimeout(120);
}
await card.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(400);
const beats = await card.locator(".beat-preview").count();
console.log("beats:", beats);

async function shotCanvas(name) {
  const dataUrl = await page.evaluate(() =>
    document.querySelectorAll("canvas")[0].toDataURL("image/png"),
  );
  await writeFile(path.join(OUT, name), Buffer.from(dataUrl.split(",")[1], "base64"));
}

const layouts = [
  ["단계별 플로우", "flow-5.png"],
  ["방사형 마인드맵", "mindmap-5.png"],
  ["비교 & 대조 듀얼", "comparison-5.png"],
  ["인포그래픽 쇼케이스", "infographic-5.png"],
  ["타임라인", "timeline-5.png"],
  ["순환 다이어그램", "cycle-5.png"],
  ["계층 구조도", "hierarchy-5.png"],
  ["데이터 차트", "chart-5.png"],
  ["벤다이어그램", "venn-5.png"],
];

for (const [label, file] of layouts) {
  await page.getByRole("button", { name: new RegExp(label.replace("&", "&")) }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: /2\. 전개 1/ }).click();
  await page.waitForTimeout(300);
  await shotCanvas(file);
}

await page.screenshot({ path: path.join(OUT, "workspace.png"), fullPage: true });
const report = { beats, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length > 0 || beats !== 5) process.exitCode = 1;
