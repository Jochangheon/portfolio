import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createStore } from "../server/store.ts";
mkdirSync("outputs",{recursive:true});
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
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto("http://localhost:3101");
  await page.getByRole("heading", { name: /AI로 만든 웹사이트와/ }).waitFor();
  await page.screenshot({ path: "outputs/portfolio-desktop.png", fullPage: true });
  assert.equal(await page.locator('a[href="/examples/workflow"]').count(),0);
  await page.getByRole("link",{name:"이 사이트 소개",exact:true}).click();
  await page.getByText("글이 어떻게 생겼는지 예시로 보기",{exact:true}).click();
  await page.getByRole("link",{name:/설명용 예시 읽어보기/}).click();
  await page.getByText("만드는 순서와 사용한 파일 자세히 보기",{exact:true}).click();
  await page.getByRole("button", { name: /01.*긴 글 넣기/ }).click();
  await page
    .getByRole("heading", { name: "긴 글 넣기", exact: true })
    .waitFor();
  await page.goto("http://localhost:3101/admin");
  await page.getByRole("heading", { name: "내 글을 쓰고 보관하는 곳" }).waitFor();
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
  await page.getByRole("link",{name:"+ 새 글 쓰기",exact:true}).click();
  assert.match(page.url(),/\/admin\/records\/new$/);
  await page.getByLabel("제목", { exact: true }).fill("브라우저 검증 기록");
  await page.getByRole("button", { name: "2. 사진·파일" }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 테스트 원문"),
    });
  await page.getByText("파일을 나만 볼 수 있게 올렸습니다.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "4. 작업 이야기" }).click();
  await page
    .getByLabel("무엇을 만들었고, 어디에 쓰나요?")
    .fill("실제 브라우저에서 작성한 테스트 기록");
  await page.getByRole("button", { name: "6. 마지막 확인" }).click();
  await page.getByText("다른 사람에게 이렇게 보여요 · 아직 공개하지 않았습니다",{exact:true}).waitFor();
  assert.match(page.url(),/\/admin\/records\/[^/]+\/preview$/);
  await page.reload();
  await page.getByRole("button", { name: "이 내용 공개하기" }).click();
  await page.getByText("이 내용을 공개했습니다.", { exact: true }).waitFor();
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto("http://localhost:3101");
  await visitor
    .getByRole("link", { name: /브라우저 검증 기록/ })
    .first()
    .click();
  await visitor
    .getByRole("heading", { name: "브라우저 검증 기록", exact: true })
    .waitFor();
  assert.match(visitor.url(),/\/records\/[^/]+$/);
  await page.getByRole("button", { name: "4. 작업 이야기" }).click();
  await page
    .getByLabel("제목", { exact: true })
    .fill("아직 게시하지 않은 초안");
  await page.getByRole("button", { name: "나만 보이게 저장", exact: true }).click();
  await page
    .getByText("나만 보는 글로 저장했습니다.", { exact: true })
    .waitFor();
  await visitor.reload();
  await visitor
    .getByRole("heading", { name: "브라우저 검증 기록", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "전에 공개했던 내용", exact: true }).click();
  await page.getByText(/1번째 공개 ·/).waitFor();
  await page.screenshot({ path: "outputs/portfolio-admin.png", fullPage: true });
  await page.getByRole("button", { name: "공개 멈추기" }).click();
  await page.getByText("이제 이 글은 나만 볼 수 있습니다.", { exact: true }).waitFor();
  await visitor.goto("http://localhost:3101");
  await visitor.getByText("공개할 작업을 정리하고 있어요.").waitFor();
  await visitor.setViewportSize({ width: 390, height: 844 });
  await visitor.screenshot({
    path: "outputs/portfolio-mobile.png",
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
  if(server.exitCode===null) await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
