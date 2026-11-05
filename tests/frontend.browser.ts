import {chromium} from "@playwright/test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=mkdtempSync(join(tmpdir(),"portfolio-routes-"));mkdirSync("outputs",{recursive:true});
const server=spawn(process.execPath,["server/index.ts"],{env:{...process.env,DATA_DIR:dir,PORT:"3102",NODE_ENV:"production"},stdio:"pipe"});
const preview=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--config","vite.preview.config.ts","--host","127.0.0.1","--port","3103","--strictPort"],{stdio:"pipe"});
const errors:string[]=[],external:string[]=[];let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
async function ready(url:string){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error("Server unavailable: "+url);}
try{
 await Promise.all([ready("http://localhost:3102/api/session"),ready("http://localhost:3103/")]);
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:["--no-sandbox"]});
 for(const port of [3102,3103]){
  const origin="http://localhost:"+port,ctx=await browser.newContext(),page=await ctx.newPage();
  ctx.on("request",r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)external.push(r.url());});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin);await page.getByRole("heading",{name:/AI로 만든 웹사이트와/}).waitFor();
  await page.getByRole("link",{name:"작업 모아보기",exact:true}).click();assert.equal(new URL(page.url()).pathname,"/records");
  await page.getByRole("link",{name:"해보고 배운 것",exact:true}).click();assert.equal(new URL(page.url()).pathname,"/records/experiments");
  await page.reload();assert.equal(await page.getByRole("link",{name:"해보고 배운 것",exact:true}).getAttribute("aria-current"),"page");
  assert.equal(await page.locator('a[href="/examples/workflow"]').count(),0);
  await page.getByRole("link",{name:"이 사이트 소개",exact:true}).click();
  await page.getByText("글이 어떻게 생겼는지 예시로 보기",{exact:true}).click();
  await page.getByRole("link",{name:/설명용 예시 읽어보기/}).click();
  await page.getByRole("heading",{name:"긴 글을 짧게 정리하는 AI 사용법",exact:true}).waitFor();
  assert.equal(await page.locator(".graph:visible").count(),0);
  await page.getByText("만드는 순서와 사용한 파일 자세히 보기",{exact:true}).click();assert.equal(new URL(page.url()).pathname,"/examples/workflow");
  await page.getByRole("button",{name:/01.*긴 글 넣기/}).click();await page.getByRole("heading",{name:"긴 글 넣기",exact:true}).waitFor();
  await page.goBack();await page.getByRole("heading",{name:/만든 것을 보여주고/}).waitFor();
  await page.goForward();await page.getByRole("heading",{name:"긴 글을 짧게 정리하는 AI 사용법",exact:true}).waitFor();
  await page.reload();await page.getByRole("heading",{name:"긴 글을 짧게 정리하는 AI 사용법",exact:true}).waitFor();
  await page.getByRole("link",{name:"← 작업 목록으로 돌아가기"}).click();assert.equal(new URL(page.url()).pathname,"/records");
  await page.getByRole("link",{name:"이 사이트 소개",exact:true}).click();assert.equal(new URL(page.url()).pathname,"/approach");
  await page.goto(origin);await page.getByRole("heading",{name:/AI로 만든 웹사이트와/}).waitFor();await page.screenshot({path:"outputs/portfolio-"+port+"-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"outputs/portfolio-"+port+"-mobile.png",fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(port===3102){
   for(const path of ["/admin","/admin/records/new","/admin/records/missing/edit","/admin/records/missing/preview"]){
    await page.goto(origin+path);await page.getByRole("heading",{name:"내 글을 쓰고 보관하는 곳"}).waitFor();
   }
   for(const path of ["/removed-page.html","/scripts/retired.js","/records/missing","/administer","/records/missing/extra"])assert.equal((await ctx.request.get(origin+path)).status(),404);
   const legacy=await ctx.request.get(origin+"/?example=1",{maxRedirects:0});assert.equal(legacy.status(),308);assert.equal(legacy.headers().location,"/examples/workflow");
  }else{assert.equal(await page.getByRole("link",{name:"내 글 관리 ↗"}).count(),0);}
  await ctx.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log("PASS: URL routes, reload, history, preview directory routes, admin gate, 404, mobile, zero external requests");
}finally{await browser?.close();for(const p of [server,preview]){p.kill();if(p.exitCode===null)await new Promise(r=>p.once("exit",r));}rmSync(dir,{recursive:true,force:true});}
