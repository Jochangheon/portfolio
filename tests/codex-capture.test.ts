import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import request from "supertest";
import {createApp} from "../server/app.ts";
import {createStore} from "../server/store.ts";
test("Codex capture is private, insert-only, grouped, persistent, and token-scoped",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"codex-capture-")),store=createStore(dir);
 const app=createApp(store,{origin:"http://localhost:3000",authenticate:req=>req.headers["x-test-admin"]==="yes"});
 const admin=(method:string,path:string)=>(request(app) as any)[method]("/api/admin"+path).set("x-test-admin","yes").set("Origin","http://localhost:3000").set("X-Requested-With","portfolio");
 const payload={sourceKey:"codex/chat/turn/0",title:"문서 검토",threadTitle:"AI와 문서 만들기",project:"교육",
  body:"## 요청\n문서 검토\n## 결과\n수정함",summary:"문서를 검토하고 수정했다는 답변",created:"2026-11-18T01:00:00Z",status:"completed"};
 try {
  assert.equal((await request(app).post("/api/ingest/codex").send(payload)).status,401);
  const token=(await admin("post","/integrations").send({label:"test"})).body.token;
  const send=(p:any)=>request(app).post("/api/ingest/codex").auth(token,{type:"bearer"}).send(p);
  const first=await send({...payload,visibility:{description:true}});assert.equal(first.status,200);
  const id=first.body.id;assert.equal((await request(app).get("/api/records/"+id)).status,404);
  assert.equal((await request(app).get("/api/admin/workspace").auth(token,{type:"bearer"})).status,401);
  assert.deepEqual(store.get(id,true)?.visibility,{description:false,graph:false,images:false,downloads:false});
  const before=(await admin("get","/workspace/pages/"+id)).body;
  assert.equal(before.note.body,payload.body);
  const edit=await admin("put","/workspace/pages/"+id).send({...before.note,title:"내가 수정한 제목",type:before.record.type,links:"",assets:[],body:"내가 덧붙인 메모"});
  assert.equal(edit.status,200,JSON.stringify(edit.body));
  const retry=await send({...payload,body:"덮어쓰기 시도"});assert.equal(retry.body.duplicate,true);assert.equal(retry.body.id,id);
  assert.equal((await admin("get","/workspace/pages/"+id)).body.note.body,"내가 덧붙인 메모");
  const next=await send({...payload,sourceKey:"codex/chat/turn2/0"});
  assert.equal(store.get(next.body.id,true)?.relationships?.[0]?.targetId,id);
  assert.equal((await admin("get","/workspace")).body.folders.length,2);
  assert.equal((await send({...payload,sourceKey:"invalid"})).status,400);
  assert.equal((await send({...payload,sourceKey:"codex/chat/turn3/0",body:"a".repeat(90001)})).status,400);
  assert.equal(store.list(true).length,2);
  const other=createStore(dir);assert.equal(other.list(true).length,2);other.db.close();
  await admin("delete","/integrations/"+(await admin("get","/integrations")).body[0].id);
  assert.equal((await send({...payload,sourceKey:"codex/chat/turn4/0"})).status,401);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
