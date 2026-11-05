import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import request from "supertest";
import {createStore} from "../server/store.ts";
import {createApp} from "../server/app.ts";
import {blank} from "../src/model.ts";
function setup(){
 const dir=mkdtempSync(join(tmpdir(),"atlas-test-")),store=createStore(dir),app=createApp(store,{origin:"http://localhost:3000",authenticate:r=>r.headers["x-test-admin"]==="yes"});
 const admin=(method:string,path:string)=>(request(app) as any)[method]("/api/admin"+path).set("x-test-admin","yes").set("Origin","http://localhost:3000").set("X-Requested-With","portfolio");
 return {store,app,admin,close(){store.db.close();rmSync(dir,{recursive:true,force:true});}};
}
const record=(title:string)=>({...blank(),title,visibility:{description:true,graph:true,images:false,downloads:false}});
test("atlas is projected from published snapshots and never reveals private nodes or edges",async()=>{
 const f=setup();try{
  const target=(await f.admin("post","/records").send(record("SECRET target"))).body;
  const parent=(await f.admin("post","/records").send({...record("Public project"),relationships:[{targetId:target.id,kind:"uses",evidence:"proposed",note:"SECRET relation"}]})).body;
  await f.admin("post","/publish/"+parent.id);
  assert.equal((await request(f.app).get("/api/admin/atlas")).status,401);
  let pub=(await request(f.app).get("/api/atlas")).body;
  assert.equal(pub.nodes.length,1);assert.deepEqual(pub.edges,[]);assert.ok(!JSON.stringify(pub).includes("SECRET"));
  assert.deepEqual((await request(f.app).get("/api/records/"+parent.id)).body.relationships,[]);
  const all=(await f.admin("get","/atlas")).body;assert.equal(all.nodes.length,2);assert.equal(all.edges.length,1);
  await f.admin("post","/publish/"+target.id);
  pub=(await request(f.app).get("/api/atlas")).body;assert.equal(pub.edges.length,1);
  await f.admin("post","/records").send({...parent,title:"Draft renamed",relationships:[]});
  pub=(await request(f.app).get("/api/atlas")).body;assert.ok(pub.nodes.some((n:any)=>n.title==="Public project"));assert.equal(pub.edges.length,1);
  await f.admin("post","/records").send({...parent,visibility:{...parent.visibility,graph:false}});
  await f.admin("post","/publish/"+parent.id);
  assert.deepEqual((await request(f.app).get("/api/atlas")).body.edges,[]);
  await f.admin("post","/unpublish/"+target.id);
  assert.equal((await request(f.app).get("/api/atlas")).body.nodes.length,1);
 }finally{f.close();}
});
test("draft-only integration tokens support atomic links, idempotency, revocation and manual-edit conflict protection",async()=>{
 const f=setup();try{
  const minted=(await f.admin("post","/integrations").send({label:"test"})).body;
  assert.match(minted.token,/^ptr_[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify((await f.admin("get","/integrations")).body).includes(minted.token));
  const ingest=(body:any)=>request(f.app).post("/api/ingest/records").set("Authorization","Bearer "+minted.token).send(body);
  const bundle={entries:[
   {sourceKey:"skill/test",record:{title:"Skill",type:"스킬·워크플로",origin:"직접 제작"}},
   {sourceKey:"project/test",record:{title:"Project",type:"프로젝트",origin:"직접 제작",visibility:{description:true,graph:true,images:true,downloads:true}},
    connections:[{targetKey:"skill/test",kind:"uses",evidence:"proposed",note:"설계 후보"}]}
  ]};
  assert.equal((await request(f.app).post("/api/ingest/records").send(bundle)).status,401);
  assert.equal((await request(f.app).post("/api/admin/publish/anything").set("Authorization","Bearer "+minted.token)).status,401);
  let result=await ingest(bundle);assert.equal(result.status,200);
  const ids=result.body.records.map((r:any)=>r.id);
  assert.equal(f.store.list(true).length,2);assert.equal(f.store.list().length,0);
  assert.equal(f.store.get(ids[1],true)!.relationships![0].targetId,ids[0]);
  assert.deepEqual(f.store.get(ids[1],true)!.visibility,{description:false,graph:false,images:false,downloads:false});
  result=await ingest(bundle);assert.equal(result.status,200);assert.deepEqual(result.body.records.map((r:any)=>r.id),ids);
  assert.equal(f.store.list(true).length,2);
  assert.equal((await f.admin("post","/publish/"+ids[0])).status,200);
  bundle.entries[0].record.title="Skill updated";
  assert.equal((await ingest(bundle)).status,200);
  assert.equal(f.store.get(ids[0])!.title,"Skill");
  assert.equal((await f.admin("get","/versions/"+ids[0])).body.length,1);
  const bad={entries:[{sourceKey:"new/good",record:{title:"Good",type:"프로젝트",origin:"직접 제작"}},{sourceKey:"new/bad",record:{title:"Bad",type:"프로젝트",origin:"직접 제작"},connections:[{targetKey:"missing/key",kind:"uses",evidence:"confirmed",note:"bad"}]}]};
  assert.equal((await ingest(bad)).status,400);assert.equal(f.store.list(true).length,2);
  assert.equal((await ingest({entries:[{sourceKey:"other",record:{...record("unsafe"),assets:["x"]}}]})).status,400);
  const r=f.store.get(ids[0],true)!;
  await f.admin("post","/records").send({...r,summary:"Manual edit"});
  assert.equal((await ingest(bundle)).status,409);assert.equal(f.store.get(ids[0],true)!.summary,"Manual edit");
  await f.admin("delete","/integrations/"+minted.id);
  assert.equal((await ingest(bundle)).status,401);
 }finally{f.close();}
});
test("relationship validation rejects missing targets/self-links and backup remaps graph connections",async()=>{
 const f=setup();try{
  const a=(await f.admin("post","/records").send(record("A"))).body;
  const edge={targetId:a.id,kind:"extends",evidence:"confirmed",note:"구성 근거"};
  assert.equal((await f.admin("post","/records").send({...a,relationships:[edge]})).status,400);
  assert.equal((await f.admin("post","/records").send({...record("B"),relationships:[{...edge,targetId:"missing"}]})).status,400);
  assert.equal((await f.admin("post","/records").send({...record("B"),relationships:[{...edge,targetVersion:1}]})).status,400);
  const b=(await f.admin("post","/records").send({...record("B"),relationships:[edge]})).body;
  const backup=(await f.admin("get","/export")).body;
  assert.equal((await f.admin("post","/import").send(backup)).status,200);
  const imported=f.store.list(true).filter((r:any)=>r.id!==a.id&&r.id!==b.id);
  const ib=imported.find((r:any)=>r.title==="B"),ia=imported.find((r:any)=>r.title==="A");
  assert.equal(ib.relationships[0].targetId,ia.id);
 }finally{f.close();}
});
