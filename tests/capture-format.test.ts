import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import request from "supertest";
import {createApp} from "../server/app.ts";
import {createStore} from "../server/store.ts";
import {projectGroups} from "../src/project-graph.ts";
test("structured capture upgrades untouched notes, preserves edits, and keeps subordinate metadata private through backup",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"capture-format-")),store=createStore(dir);
 const app=createApp(store,{origin:"http://localhost:3000",authenticate:req=>req.headers["x-test-admin"]==="yes"});
 const admin=(method:string,path:string)=>(request(app) as any)[method]("/api/admin"+path).set("x-test-admin","yes").set("Origin","http://localhost:3000").set("X-Requested-With","portfolio");
 try{
  const token=(await admin("post","/integrations").send({label:"test"})).body.token;
  const send=(body:any)=>request(app).post("/api/ingest/codex").auth(token,{type:"bearer"}).send(body);
  const old={sourceKey:"codex/main/turn/0",title:"첫 작업",threadTitle:"포트폴리오 만들기",project:"개인",body:"old note",summary:"old summary",created:"2026-11-18T00:00:00Z",status:"completed"};
  const id=(await send(old)).body.id;
  const next={...old,project:"개인 포트폴리오",formatVersion:2,question:"어떻게 만들까요?",detail:"세 부분으로 만들었습니다.",recap:"- 세 부분으로 정리했습니다.",capture:{threadId:"main",turnId:"turn",rootThreadId:"main",mode:"main"}};
  const upgraded=await send(next);assert.equal(upgraded.body.upgraded,true);
  const loaded=(await admin("get","/workspace/pages/"+id)).body;
  assert.match(loaded.note.body,/## 질문[\s\S]*## 상세내용[\s\S]*## 정리/);
  assert.equal(loaded.record.project,"개인 포트폴리오");
  await admin("put","/workspace/pages/"+id).send({...loaded.note,title:"내가 수정",project:"바꾼 프로젝트",type:loaded.record.type,links:"",assets:[],body:"수정한 메모"});
  await send(next);
  assert.equal((await admin("get","/workspace/pages/"+id)).body.note.body,"수정한 메모");
  const old2={...old,sourceKey:"codex/main/edited/0"};const id2=(await send(old2)).body.id;
  const edit=(await admin("get","/workspace/pages/"+id2)).body;
  await admin("put","/workspace/pages/"+id2).send({...edit.note,title:"이미 편집함",type:edit.record.type,links:"",assets:[],body:"이전 형식의 수동 편집"});
  const preserve=await send({...next,sourceKey:old2.sourceKey,capture:{...next.capture,turnId:"edited"}});
  assert.equal(preserve.body.preserved,true);assert.equal((await admin("get","/workspace/pages/"+id2)).body.note.body,"이전 형식의 수동 편집");
  const child=await send({...next,sourceKey:"codex/child/work/0",capture:{threadId:"child",turnId:"work",rootThreadId:"main",mode:"subagent",parentThreadId:"main",parentTurnId:"turn",agentName:"Reviewer",agentRole:"내용 검토"}});
  assert.equal(child.status,200);
  const graph=(await admin("get","/atlas")).body;
  assert.equal(graph.nodes.find((n:any)=>n.id===child.body.id).capture.parentThreadId,"main");
  assert.deepEqual((await request(app).get("/api/atlas")).body.nodes,[]);
  assert.equal((await request(app).get("/api/admin/atlas")).status,401);
  assert.equal((await send({...next,capture:{...next.capture,mode:"subagent",parentThreadId:"main"}})).status,400);
  const backup=(await admin("get","/export")).body;
  const restored=await admin("post","/import").send(backup);assert.equal(restored.status,200,JSON.stringify(restored.body));
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM codex_notes").get()!.n,6);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
test("project grouping keeps subagents attached to their parent and supports multiple chats in one project",()=>{
 const capture=(threadId:string,mode:"main"|"subagent",parentThreadId?:string)=>({threadId,mode,parentThreadId,rootThreadId:"main",threadTitle:threadId,status:"completed",created:"2026-11-18"});
 const records=[
  {id:"a",title:"요청1",type:"실험 노트",summary:"",project:"포트폴리오",capture:capture("main","main")},
  {id:"b",title:"요청2",type:"실험 노트",summary:"",project:"포트폴리오",capture:capture("main","main")},
  {id:"c",title:"검토",type:"실험 노트",summary:"",project:"포트폴리오",capture:capture("helper","subagent","main")},
  {id:"d",title:"다른 작업",type:"프로젝트",summary:"",project:"다른 프로젝트"}
 ];
 const grouped=projectGroups(records);assert.equal(grouped.length,2);
 const groups=grouped.find(p=>p.name==="포트폴리오")!.groups;assert.equal(groups.length,2);
 assert.equal(groups.find(g=>g.mode==="main")!.records.length,2);
 assert.equal(groups.find(g=>g.mode==="subagent")!.parentId,"main");
});
