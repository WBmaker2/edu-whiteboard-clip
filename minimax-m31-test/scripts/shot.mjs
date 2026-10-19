import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHOT_DIR = path.join(ROOT, "docs", "shots");

const VIEWS = ["default", "front", "side", "top"];
const MIN_VIEW_DIFF_RATIO = 0.01;
const PROJECTED_OVERLAP_PX = 8;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serve(dir) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const target = path.join(dir, path.normalize(rel));
    if (!target.startsWith(dir)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      const body = await readFile(target);
      res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

import { STEPS } from "./steps.mjs";
async function diffRatio(first, second) {
  const a = PNG.sync.read(await readFile(first));
  const b = PNG.sync.read(await readFile(second));
  if (a.width !== b.width || a.height !== b.height) return 1;
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  return changed / (a.width * a.height);
}

const target = process.argv[2] ?? "zoo";
const isLanding = target === "landing";
const gameDir = isLanding ? ROOT : path.join(ROOT, target);
if (!existsSync(gameDir)) {
  console.error(`알 수 없는 대상: ${target} (zoo|molecule|defense|landing)`);
  process.exit(2);
}

await mkdir(SHOT_DIR, { recursive: true });
const { server, port } = await serve(gameDir);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "ko-KR" });
const page = await context.newPage();

const failures = [];
const warnings = [];

page.on("console", (m) => {
  if (m.type() === "error") failures.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) =>
  failures.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ""}`),
);

let index = 0;
const shot = async (label) => {
  index += 1;
  const file = path.join(SHOT_DIR, `${target}-${String(index).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  console.log(`SHOT ${file}`);
  return file;
};

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
await page.waitForFunction(
  isLanding ? () => window.__landingReady === true : () => window.__gameReady === true,
  null,
  { timeout: 20000 },
);
await page.waitForTimeout(1200);
await shot(isLanding ? "01-랜딩" : "01-초기화면");

if (isLanding) {
  const links = await page.$$eval(".play", (nodes) =>
    nodes.map((node) => ({ href: node.dataset.href, title: node.dataset.title })),
  );
  if (links.length !== 3) failures.push(`카드 ${links.length}개입니다. 3개를 기대했습니다.`);

  for (const link of links) {
    const response = await page.request.get(`http://127.0.0.1:${port}/${link.href}`);
    if (response.status() !== 200) {
      failures.push(`${link.title} 링크 응답 ${response.status()} (${link.href})`);
    }
  }

  await page.getByRole("button", { name: "PLAY" }).first().click();
  await page.waitForTimeout(1500);
  const dialogOpen = await page.evaluate(() => document.getElementById("player").open);
  if (!dialogOpen) failures.push("모달이 열리지 않았습니다.");
  const frameReady = await page.evaluate(() => {
    const frame = document.getElementById("player-frame");
    try {
      return Boolean(frame.contentWindow?.__gameReady);
    } catch {
      return false;
    }
  });
  if (!frameReady) failures.push("모달 안에서 게임이 준비되지 않았습니다.");
  await shot("02-모달플레이");
  await page.getByRole("button", { name: "닫기" }).click();
  await page.waitForTimeout(400);

  const shown = await page.$$eval("[data-check]", (nodes) =>
    Object.fromEntries(nodes.map((node) => [node.dataset.check, node.dataset.value])),
  );
  const checksFile = path.join(ROOT, "docs", "checks.json");
  if (!existsSync(checksFile)) {
    failures.push("docs/checks.json 이 없습니다. scripts/card-shots.mjs 를 먼저 실행하세요.");
  } else {
    const checks = JSON.parse(await readFile(checksFile, "utf8"));
    for (const [key, value] of Object.entries(shown)) {
      const actual = key.split(".").reduce((node, part) => node?.[part], checks);
      if (actual === undefined) {
        failures.push(`검사 수치 ${key} 를 checks.json 에서 찾을 수 없습니다.`);
        continue;
      }
      if (String(actual) !== String(value)) {
        failures.push(`랜딩 표시값 ${key}=${value} 이 실제 값 ${actual} 과 다릅니다.`);
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await shot("03-모바일");
} else if (STEPS[target]) {
  await STEPS[target](page, shot);
} else {
  console.log(`${target}: 전용 조작 단계 없음`);
}

const viewFiles = {};
for (const view of isLanding ? [] : VIEWS) {
  const hasApi = await page.evaluate((name) => {
    if (typeof window.__gameApi?.setView !== "function") return false;
    window.__gameApi.setView(name);
    return true;
  }, view);
  if (!hasApi) {
    warnings.push(`${view} 시점 전환을 지원하지 않습니다 (setView 없음)`);
    continue;
  }
  await page.waitForTimeout(700);
  const file = path.join(SHOT_DIR, `${target}-view-${view}.png`);
  await page.screenshot({ path: file });
  viewFiles[view] = file;
  console.log(`SHOT ${file}`);
}

const invariants = isLanding ? [] : await page.evaluate(() => window.__gameApi?.getInvariants?.() ?? []);
if (invariants.length > 0) {
  for (const problem of invariants) {
    failures.push(`불변식 위반 [${problem.code}] ${problem.message}`);
  }
}

const positions = isLanding ? [] : await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
if (positions.length > 0) {
  const visible = positions.filter((entry) => entry.visible);
  if (visible.length === 0) {
    failures.push("어떤 개체도 화면에 보이지 않습니다.");
  } else if (visible.length < positions.length) {
    warnings.push(`${positions.length - visible.length}개 개체가 화면 밖에 있습니다.`);
  }
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const a = positions[i];
      const b = positions[j];
      if (!a.visible || !b.visible) continue;
      const dx = (a.x - b.x) * 640;
      const dy = (a.y - b.y) * 400;
      if (Math.hypot(dx, dy) < PROJECTED_OVERLAP_PX) {
        warnings.push(`두 개체가 화면에서 겹쳐 보입니다 (${Math.hypot(dx, dy).toFixed(1)}px).`);
      }
    }
  }
}

const base = viewFiles.default;
if (base) {
  for (const [view, file] of Object.entries(viewFiles)) {
    if (view === "default") continue;
    const ratio = await diffRatio(base, file);
    console.log(`DIFF default↔${view} ${(ratio * 100).toFixed(2)}%`);
    if (ratio < MIN_VIEW_DIFF_RATIO) {
      failures.push(`기본 시점과 ${view} 시점의 화면 차이가 ${(ratio * 100).toFixed(2)}%에 그칩니다. 장면이 비었거나 평평할 수 있습니다.`);
    }
  }
}

const state = isLanding ? null : await page.evaluate(() => window.__gameApi?.getState?.() ?? null);
if (state) console.log("STATE", JSON.stringify(state));

await browser.close();
server.close();

for (const warning of warnings) console.warn(`WARN ${target}: ${warning}`);

if (failures.length) {
  console.error(`\n${target}: 실패 ${failures.length}건`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${target}: 콘솔 오류 없음 · 불변식 통과 · 화면 판정 통과`);
