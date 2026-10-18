import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = Number(process.env.QA_PREVIEW_PORT ?? 4173);
const BASE = `http://localhost:${PORT}/`;

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
});
preview.stdout.on("data", () => undefined);
preview.stderr.on("data", () => undefined);

const stopPreview = () => {
  preview.kill("SIGTERM");
};

try {
  let up = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) {
        up = true;
        break;
      }
    } catch {
      /* retry */
    }
    await delay(500);
  }
  if (!up) throw new Error("vite preview 서버가 시작되지 않았습니다. 먼저 npm run build를 실행하세요.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const swReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);
    return Boolean(registration);
  });
  check("service worker registered", swReady);

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    const response = await fetch(link.getAttribute("href"));
    return response.ok ? response.json() : null;
  });
  check("manifest linked", Boolean(manifest?.name), manifest?.name ?? "");

  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  check(
    "offline reload renders app",
    (await page.getByRole("button", { name: /화이트보드 교육 영상 생성하기/ }).count()) > 0,
  );
  check("offline chip visible", (await page.getByText(/오프라인/).count()) > 0);

  await page.getByRole("button", { name: /예시 프로젝트로 먼저/ }).click();
  await page.waitForTimeout(1200);
  check(
    "offline demo playback available",
    (await page.getByRole("tab", { name: /^2\./ }).count()) > 0,
  );

  await context.setOffline(false);
  await page.waitForTimeout(400);
  check("online chip disappears", (await page.getByText(/오프라인/).count()) === 0);

  await browser.close();
  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally {
  stopPreview();
}

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`\nPWA 검사 실패 ${failed.length}건`);
  process.exit(1);
}
console.log(`\nPWA 검사 통과 (${checks.length}건)`);
