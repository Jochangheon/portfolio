import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createStore } from "../server/store.ts";
const dir = mkdtempSync(join(tmpdir(), "portfolio-browser-"));
const store = createStore(dir);
const sid = randomBytes(32).toString("hex");
store.db
  .prepare("INSERT INTO sessions VALUES(?,?)")
  .run(sid, Date.now() + 600000);
store.db.close();
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    DATA_DIR: dir,
    PORT: "3101",
    APP_URL: "http://localhost:3101",
    NODE_ENV: "production",
  },
  stdio: "pipe",
});
let browser: any;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch("http://localhost:3101/api/session")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto("http://localhost:3101");
  await page.getByRole("heading", { name: /AI와 함께/ }).waitFor();
  await page.screenshot({ path: "/tmp/portfolio-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /기능 예시/ }).click();
  await page.getByRole("button", { name: /01.*이벤트 정의서/ }).click();
  await page
    .getByRole("heading", { name: "이벤트 정의서", exact: true })
    .waitFor();
  await page.goto("http://localhost:3101/admin");
  await page.getByRole("heading", { name: "기록을 이어가는 공간" }).waitFor();
  await context.addCookies([
    {
      name: "session",
      value: sid,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.reload();
  await page.getByLabel("제목", { exact: true }).fill("브라우저 검증 기록");
  await page.getByRole("button", { name: "2. 자료" }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 테스트 원문"),
    });
  await page.getByText("비공개 업로드 완료.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "4. 설명" }).click();
  await page
    .getByLabel("요약과 결과물")
    .fill("실제 브라우저에서 작성한 테스트 기록");
  await page.getByRole("button", { name: "6. 미리보기" }).click();
  await page.getByRole("button", { name: "이 내용으로 게시" }).click();
  await page.getByText("새 버전을 게시했습니다.", { exact: true }).waitFor();
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto("http://localhost:3101");
  await visitor
    .getByRole("button", { name: /브라우저 검증 기록/ })
    .first()
    .click();
  await visitor
    .getByRole("heading", { name: "브라우저 검증 기록", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "4. 설명" }).click();
  await page
    .getByLabel("제목", { exact: true })
    .fill("아직 게시하지 않은 초안");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await page
    .getByText("초안을 서버에 저장했습니다.", { exact: true })
    .waitFor();
  await visitor.reload();
  await visitor
    .getByRole("heading", { name: "브라우저 검증 기록", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "버전 이력", exact: true }).click();
  await page.getByText(/v1 ·/).waitFor();
  await page.screenshot({ path: "/tmp/portfolio-admin.png", fullPage: true });
  await page.getByRole("button", { name: "게시 중단" }).click();
  await page.getByText("비공개로 전환했습니다.", { exact: true }).waitFor();
  await visitor.goto("http://localhost:3101");
  await visitor.getByText("아직 첫 기록을 준비하고 있습니다.").waitFor();
  await visitor.setViewportSize({ width: 390, height: 844 });
  await visitor.screenshot({
    path: "/tmp/portfolio-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile, graph node, auth gate, upload, edit, preview, publish, draft isolation, version history, unpublish; no browser errors",
  );
} finally {
  await browser?.close();
  server.kill();
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
