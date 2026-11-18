import {chromium} from "@playwright/test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {createStore} from "../server/store.ts";
import {blank} from "../src/model.ts";
const dir=mkdtempSync(join(tmpdir(),"project-map-")),store=createStore(dir),sid=randomBytes(32).toString("hex");
store.db.prepare("INSERT INTO sessions VALUES(?,?)").run(sid,Date.now()+600000);
for(const [id,mode,title] of [["parent","main","사이트 만들기"],["helper","subagent","검토 담당"]]){
 const record={...blank(),id,title,project:"포트폴리오",summary:"요청한 내용을 정리했습니다."};
 store.save(record);
 const meta={threadId:id,turnId:"turn",rootThreadId:"parent",mode,threadTitle:title,created:"2026-11-18T00:00:00Z",status:"completed",question:"검토해 주세요.",detail:"두 항목을 확인했습니다.",recap:"- 두 항목을 확인했습니다.",...(mode==="subagent"?{parentThreadId:"parent",parentTurnId:"turn",agentName:"Reviewer",agentRole:"내용 검토"}:{})};
 store.db.prepare("INSERT INTO codex_notes VALUES(?,?)").run(id,JSON.stringify(meta));
 store.db.prepare("UPDATE workspace_notes SET body=? WHERE record_id=?").run("## 질문\n\n검토해 주세요.\n\n## 상세내용\n\n두 항목을 확인했습니다.\n\n## 정리\n\n- 두 항목을 확인했습니다.",id);
}
store.db.close();
const server=spawn(process.execPath,["server/index.ts"],{env:{...process.env,DATA_DIR:dir,PORT:"3116",APP_URL:"http://localhost:3116",NODE_ENV:"production"},stdio:"pipe"});
let browser:any;const errors:string[]=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3116/api/session")).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.addCookies([{name:"session",value:sid,domain:"localhost",path:"/",httpOnly:true,sameSite:"Lax"}]);
 const page=await ctx.newPage();page.on("pageerror",(e:Error)=>errors.push(e.message));
 await page.goto("http://localhost:3116/admin/atlas");
 await page.getByRole("heading",{name:"프로젝트 연결 지도",exact:true}).waitFor();
 await page.getByLabel("프로젝트",{exact:true}).selectOption("포트폴리오");
 await page.locator('.react-flow__node[data-id="helper"]').click();
 await page.locator(".project-map-details").getByText("메인 작업을 돕는 서브 작업",{exact:true}).waitFor();
 assert.ok((await page.locator(".project-map-details").innerText()).includes("사이트 만들기"));
 assert.equal(await page.locator('.react-flow__edge[data-id="parent-helper"]').count(),1);
 mkdirSync("outputs",{recursive:true});await page.screenshot({path:"outputs/project-map-desktop.png",fullPage:true});
 await page.locator(".work-records").getByRole("link").click();
 await page.locator(".note-markdown").getByRole("heading",{name:"질문",exact:true}).waitFor();
 assert.deepEqual(await page.locator(".note-markdown h2").allTextContents(),["질문","상세내용","정리"]);
 await page.getByRole("button",{name:"계속 쓰기",exact:true}).click();
 await page.getByLabel("프로젝트",{exact:true}).fill("다른 프로젝트");
 await page.getByRole("button",{name:"지금 저장",exact:true}).click();
 await page.getByRole("status").filter({hasText:"저장됨"}).first().waitFor();
 await page.goto("http://localhost:3116/admin/atlas");
 await page.getByLabel("프로젝트",{exact:true}).selectOption("다른 프로젝트");
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:"outputs/project-map-mobile.png",fullPage:true});
 assert.equal(errors.length,0,errors.join("\n"));
 console.log("PASS project graph: project grouping, parent/subagent edge, structured reading, project editing, mobile");
}finally{await browser?.close();server.kill();await new Promise(r=>server.once("exit",r));rmSync(dir,{recursive:true,force:true});}
