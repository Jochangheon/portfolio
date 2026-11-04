import { chromium, type BrowserContext } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "portfolio-frontend-"));
const server = spawn(process.execPath, ["server/index.ts"], {
  env: { ...process.env, DATA_DIR: dir, PORT: "3102", NODE_ENV: "production" },
  stdio: "pipe",
});
const previewServer = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "vite.preview.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "3103",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const externalRequests: string[] = [];
const errors: string[] = [];
function observe(context: BrowserContext, origin: string) {
  context.on("request", (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin)
      externalRequests.push(r.url());
  });
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
}
async function ready(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server did not start: " + url);
}
try {
  await Promise.all([
    ready("http://localhost:3102/api/session"),
    ready("http://localhost:3103/"),
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext();
  observe(ctx, "http://localhost:3102");
  const page = await ctx.newPage();
  await page.goto("http://localhost:3102/");
  await page.getByRole("heading", { name: /AI와 함께/ }).waitFor();
  await page.getByRole("button", { name: "실험 노트", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "실험 노트", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: /기능 예시/ }).click();
  await page.getByRole("button", { name: /01.*이벤트 정의서/ }).click();
  await page
    .getByRole("heading", { name: "이벤트 정의서", exact: true })
    .waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: /AI와 함께/ }).waitFor();
  await page.goForward();
  await page
    .getByRole("heading", { name: "이벤트 정의서 검토 흐름", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "이벤트 정의서 검토 흐름", exact: true })
    .waitFor();
  await page.goto("http://localhost:3102/admin");
  await page.getByRole("heading", { name: "기록을 이어가는 공간" }).waitFor();
  assert.equal(
    (await ctx.request.get("http://localhost:3102/removed-page.html")).status(),
    404,
  );
  assert.equal(
    (
      await ctx.request.get("http://localhost:3102/scripts/retired.js")
    ).status(),
    404,
  );
  const view = await browser.newContext();
  observe(view, "http://localhost:3103");
  const p = await view.newPage();
  await p.goto("http://localhost:3103/");
  await p.getByRole("heading", { name: /AI와 함께/ }).waitFor();
  await p.getByText(/화면 확인용 미리보기/).waitFor();
  assert.equal(await p.getByRole("link", { name: "관리자 ↗" }).count(), 0);
  await p.getByRole("button", { name: /기능 예시/ }).click();
  await p.getByRole("button", { name: /01.*이벤트 정의서/ }).click();
  await p
    .getByRole("heading", { name: "이벤트 정의서", exact: true })
    .waitFor();
  await p.getByRole("button", { name: "← 기록으로 돌아가기" }).click();
  mkdirSync("/workspace/shared/downloads", { recursive: true });
  await p.screenshot({
    path: "/workspace/shared/downloads/portfolio-desktop.png",
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({
    path: "/workspace/shared/downloads/portfolio-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  assert.deepEqual(await view.cookies(), []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: full app and interactive preview; filters, node detail, history, reload, admin gate, removed files 404, mobile layout. Zero external requests; zero public cookies; zero browser errors.",
  );
} finally {
  await browser?.close();
  for (const process of [server, previewServer]) {
    process.kill();
    if (process.exitCode === null)
      await new Promise((r) => process.once("exit", r));
  }
  rmSync(dir, { recursive: true, force: true });
}
