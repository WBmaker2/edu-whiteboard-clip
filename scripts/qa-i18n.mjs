import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.QA_OUT ?? "/tmp/panseolab-i18n-qa";
await mkdir(OUT, { recursive: true });

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

const rawKeyPattern = /\b(settings|library|draft|storyboard|monitor|export|share|quiz|worksheet|history|pwa)\.[a-zA-Z]/;

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.getByRole("combobox", { name: "표시 언어" }).selectOption("en");
await page.waitForTimeout(500);

check("html lang", (await page.locator("html").getAttribute("lang")) === "en");
check(
  "english generate button",
  (await page.getByRole("button", { name: /Generate whiteboard lesson video/ }).count()) === 1,
);
check(
  "english layout option",
  (await page.getByText("Smart adaptive", { exact: true }).count()) > 0,
);
check(
  "english theme option",
  (await page.getByText("Paper whiteboard", { exact: true }).count()) > 0,
);
check(
  "english subject option",
  (await page.getByRole("combobox", { name: "Subject" }).locator("option", { hasText: "Science" }).count()) > 0,
);

let body = await page.locator("body").innerText();
check("no raw i18n keys on settings", !rawKeyPattern.test(body));

await page.getByRole("button", { name: /Explore with the sample project/ }).click();
await page.waitForTimeout(1200);
check("monitor loads in english", (await page.getByText("Video monitor & playback").count()) > 0);

await page.getByRole("button", { name: "Project", exact: true }).click();
await page.getByRole("menuitem", { name: /My lessons/ }).click();
await page.getByRole("dialog", { name: "My lessons" }).waitFor({ timeout: 15000 });
await page.waitForTimeout(400);
body = await page.locator("body").innerText();
check("library english", body.includes("New lesson") && body.includes("Export JSON"));
check("library theme english", body.includes("Paper whiteboard"));
check("no raw i18n keys in library", !rawKeyPattern.test(body));
await page.screenshot({ path: path.join(OUT, "library-en.png"), fullPage: true });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Help" }).click();
await page.getByRole("dialog", { name: "How to use" }).waitFor({ timeout: 15000 });
body = await page.locator("body").innerText();
check("help english", body.includes("Shortcuts") || body.includes("Getting started"));
check("no raw i18n keys in help", !rawKeyPattern.test(body));
await page.screenshot({ path: path.join(OUT, "help-en.png"), fullPage: true });
await page.keyboard.press("Escape");

const report = { checks, errors };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
if (checks.some((item) => !item.ok) || errors.length > 0) process.exitCode = 1;
