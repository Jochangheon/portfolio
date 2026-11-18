import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import request from "supertest";
import {createApp} from "../server/app.ts";
import {createStore} from "../server/store.ts";
import {blank} from "../src/model.ts";
function setup() {
  const dir=mkdtempSync(join(tmpdir(),"workspace-test-"));
  const store=createStore(dir), app=createApp(store,{origin:"http://localhost:3000",authenticate:req=>req.headers["x-test-admin"]==="yes"});
  const admin=(method:string,path:string)=>(request(app) as any)[method]("/api/admin"+path).set("x-test-admin","yes").set("Origin","http://localhost:3000").set("X-Requested-With","portfolio");
  return {dir,store,app,admin,close(){store.db.close();rmSync(dir,{recursive:true,force:true});}};
}
function draft(loaded:any,body:string) {
  return {title:loaded.record.title,type:loaded.record.type,links:loaded.record.links,assets:loaded.record.assets,...loaded.note,body};
}
test("workspace is private, preserves published records, rejects stale edits, and persists notes",async()=>{
  const f=setup();
  try {
    assert.equal((await request(f.app).get("/api/admin/workspace")).status,401);
    assert.equal((await request(f.app).post("/api/admin/workspace/pages").set("x-test-admin","yes").send({})).status,403);
    const old=(await f.admin("post","/records").send({...blank(),title:"Published",summary:"Public description"})).body;
    await f.admin("post","/publish/"+old.id);
    const current=(await f.admin("get","/workspace/pages/"+old.id)).body;
    const save=await f.admin("put","/workspace/pages/"+old.id).send({...draft(current,"PRIVATE secret"),title:"Edited privately"});
    assert.equal(save.status,200);
    assert.equal((await f.admin("put","/workspace/pages/"+old.id).send(draft(current,"stale overwrite"))).status,409);
    assert.equal((await f.admin("post","/records").send({...old,title:"stale editor"})).status,409);
    const pub=(await request(f.app).get("/api/records/"+old.id)).body;
    assert.equal(pub.title,"Published");
    assert.doesNotMatch(JSON.stringify(pub),/PRIVATE|Edited privately|body/);
    await f.admin("post","/publish/"+old.id);
    assert.doesNotMatch(JSON.stringify((await request(f.app).get("/api/records")).body),/PRIVATE/);
    const second=createStore(f.dir);
    try {assert.equal((second.db.prepare("SELECT body FROM workspace_notes WHERE record_id=?").get(old.id) as any).body,"PRIVATE secret");}
    finally {second.db.close();}
    assert.equal((await request(f.app).get("/api/admin/workspace/pages/"+old.id)).status,401);
  } finally {f.close();}
});
test("workspace folders, files, notes and legacy records round-trip in backup with safe ID remapping",async()=>{
  const f=setup();
  try {
    const folder=(await f.admin("post","/workspace/folders").send({name:"PRIVATE folder"})).body;
    const child=(await f.admin("post","/workspace/folders").send({name:"Child",parentId:folder.id})).body;
    const page=(await f.admin("post","/workspace/pages").send({folderId:child.id})).body;
    assert.ok(page.id);
    assert.equal((await f.admin("post","/workspace/pages").send({folderId:"missing"})).status,400);
    const current=(await f.admin("get","/workspace/pages/"+page.id)).body;
    const file=(await f.admin("post","/upload").set("Content-Type","application/octet-stream").set("X-Filename","note.md").send(Buffer.from("# PRIVATE file"))).body;
    assert.equal((await f.admin("put","/workspace/pages/"+page.id).send({...draft(current,"My private notebook"),assets:[file.id],pinned:true,archived:true})).status,200);
    assert.equal((await request(f.app).get("/api/files/"+file.id)).status,404);
    const backup=(await f.admin("get","/export")).body;
    assert.equal(backup.workspace.folders.length,2);
    assert.equal(backup.workspace.notes[0].body,"My private notebook");
    const imported=await f.admin("post","/import").send(backup);
    assert.equal(imported.status,200);
    const all=(await f.admin("get","/workspace")).body;
    const restored=all.pages.find((r:any)=>r.id!==page.id);
    assert.ok(restored.pinned && restored.archived);
    assert.notEqual(restored.folderId,child.id);
    assert.equal(all.folders.find((folder:any)=>folder.id===restored.folderId).name,"Child");
    const restoredContent=(await f.admin("get","/workspace/pages/"+restored.id)).body;
    assert.equal(restoredContent.note.body,"My private notebook");
    assert.notEqual(restoredContent.record.assets[0],file.id);
    assert.equal(restoredContent.published,false);
    const invalid=JSON.parse(JSON.stringify(backup));invalid.workspace.folders[0].parent_id=child.id;
    assert.equal((await f.admin("post","/import").send(invalid)).status,400);
    const legacy={...blank(),id:"legacy",title:"Older backup"};
    assert.equal((await f.admin("post","/import").send({records:[legacy]})).status,200);
    assert.ok((await f.admin("get","/workspace")).body.pages.some((p:any)=>p.title==="Older backup"));
  } finally {f.close();}
});
