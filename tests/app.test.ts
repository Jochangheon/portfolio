import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import AdmZip from "adm-zip";
import { createApp } from "../server/app.ts";
import { createStore } from "../server/store.ts";
import { blank, example } from "../src/model.ts";
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "portfolio-test-"));
  const store = createStore(dir);
  const app = createApp(store, {
    origin: "http://localhost:3000",
    authenticate: (req) => req.headers["x-test-admin"] === "yes",
  });
  const admin = (method: string, url: string) =>
    (request(app) as any)
      [method]("/api/admin" + url)
      .set("x-test-admin", "yes")
      .set("Origin", "http://localhost:3000")
      .set("X-Requested-With", "portfolio");
  return {
    dir,
    store,
    app,
    admin,
    close() {
      store.db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("server denies anonymous admin and forged mutations", async () => {
  const f = setup();
  try {
    assert.equal((await request(f.app).get("/api/admin/records")).status, 401);
    assert.equal(
      (
        await request(f.app)
          .post("/api/admin/records")
          .set("x-test-admin", "yes")
          .send({ ...blank(), title: "x" })
      ).status,
      403,
    );
    assert.equal(
      (await request(f.app).get("/auth/callback?code=x&state=bad")).status,
      403,
    );
  } finally {
    f.close();
  }
});
test("draft isolation, publication scopes, immutable versions and unpublish", async () => {
  const f = setup();
  try {
    const r = {
      ...example(),
      id: "",
      example: false,
      title: "처음",
      summary: "공개 설명",
    };
    const saved = await f.admin("post", "/records").send(r);
    assert.equal(saved.status, 200);
    const id = saved.body.id;
    assert.equal((await request(f.app).get("/api/records")).body.length, 0);
    assert.equal((await request(f.app).get("/api/records/" + id)).status, 404);
    assert.equal((await f.admin("post", "/publish/" + id)).status, 200);
    await f
      .admin("post", "/records")
      .send({ ...saved.body, title: "수정 초안", reason: "설명 개선" });
    assert.equal(
      (await request(f.app).get("/api/records/" + id)).body.title,
      "처음",
    );
    await f.admin("post", "/publish/" + id);
    const vs = (await f.admin("get", "/versions/" + id)).body;
    assert.equal(vs.length, 2);
    assert.equal(vs[1].content.title, "처음");
    assert.equal(vs[0].reason, "설명 개선");
    await f.admin("post", "/unpublish/" + id);
    assert.equal((await request(f.app).get("/api/records/" + id)).status, 404);
  } finally {
    f.close();
  }
});
test("private bytes remain inaccessible; explicit downloads only; public text filtering", async () => {
  const f = setup();
  try {
    const up = await f
      .admin("post", "/upload")
      .set("Content-Type", "application/octet-stream")
      .set("X-Filename", "SKILL.md")
      .send(Buffer.from("# private source"));
    assert.equal(up.status, 200);
    const aid = up.body.id;
    assert.equal((await request(f.app).get("/api/files/" + aid)).status, 404);
    const r = {
      ...example(),
      id: "",
      assets: [aid],
      files: [
        {
          id: "file",
          label: "SKILL.md",
          kind: "파일",
          role: "설명",
          version: "v1",
          source: "작성",
          evidence: "작성자 확인",
          text: "SECRET",
          publicText: false,
        },
      ],
    };
    const s = (await f.admin("post", "/records").send(r)).body;
    await f.admin("post", "/publish/" + s.id);
    let pub = await request(f.app).get("/api/records/" + s.id);
    assert.equal(pub.body.files[0].text, undefined);
    assert.deepEqual(pub.body.assets, []);
    assert.equal((await request(f.app).get("/api/files/" + aid)).status, 404);
    s.visibility.downloads = true;
    await f.admin("post", "/records").send(s);
    await f.admin("post", "/publish/" + s.id);
    assert.equal((await request(f.app).get("/api/files/" + aid)).status, 200);
    await f.admin("post", "/unpublish/" + s.id);
    assert.equal((await request(f.app).get("/api/files/" + aid)).status, 404);
  } finally {
    f.close();
  }
});
test("upload accepts text and ZIP structure, rejects unsupported, forged and bomb files", async () => {
  const f = setup();
  try {
    const upload = (name: string, b: Buffer) =>
      f
        .admin("post", "/upload")
        .set("Content-Type", "application/octet-stream")
        .set("X-Filename", encodeURIComponent(name))
        .send(b);
    assert.equal(
      (await upload("fake.png", Buffer.from("not image"))).status,
      400,
    );
    assert.equal(
      (await upload("../escape.txt", Buffer.from("bad"))).status,
      400,
    );
    assert.equal((await upload("x.exe", Buffer.from("binary"))).status, 400);
    assert.equal(
      (await upload("large.txt", Buffer.alloc(11 * 1024 * 1024))).status,
      413,
    );
    const zip = new AdmZip();
    zip.addFile("skill/SKILL.md", Buffer.from("# skill"));
    const result = await upload("skill.zip", zip.toBuffer());
    assert.equal(result.status, 200);
    assert.equal(result.body.analysis.files[0].path, "skill/SKILL.md");
    assert.equal(result.body.analysis.suggestions[0].evidence, "추정");
    const bomb = new AdmZip();
    bomb.addFile("huge.txt", Buffer.alloc(3 * 1024 * 1024, 65));
    assert.equal((await upload("bomb.zip", bomb.toBuffer())).status, 400);
    const traversal = zip.toBuffer();
    const safe = Buffer.from("skill/SKILL.md"),
      bad = Buffer.from("../xx/SKILL.md");
    for (let p = 0; (p = traversal.indexOf(safe, p)) >= 0; p += bad.length)
      bad.copy(traversal, p);
    assert.equal((await upload("traversal.zip", traversal)).status, 400);
  } finally {
    f.close();
  }
});
test("database persists after reopen; JSON backup preserves versions and bytes; import stays private", async () => {
  const f = setup();
  try {
    const u = (
      await f
        .admin("post", "/upload")
        .set("Content-Type", "application/octet-stream")
        .set("X-Filename", "notes.md")
        .send(Buffer.from("original"))
    ).body;
    const r = (
      await f
        .admin("post", "/records")
        .send({ ...blank(), title: "보존 기록", assets: [u.id] })
    ).body;
    await f.admin("post", "/publish/" + r.id);
    const second = createStore(f.dir);
    assert.equal(second.get(r.id)?.title, "보존 기록");
    second.db.close();
    const backup = (await f.admin("get", "/export")).body;
    assert.equal((await f.admin("post", "/import").send(backup)).status, 200);
    const all = (await f.admin("get", "/records")).body;
    assert.equal(all.length, 2);
    const copy = all.find((x: any) => x.id !== r.id);
    assert.equal(copy.published, false);
    assert.equal((await f.admin("get", "/versions/" + copy.id)).body.length, 1);
    assert.equal(
      (
        await request(f.app)
          .get("/api/files/" + copy.assets[0])
          .set("x-test-admin", "yes")
      ).body.toString(),
      "original",
    );
    const md = await f.admin("get", "/markdown/" + r.id);
    assert.equal(
      (await f.admin("post", "/import").send({ markdown: md.text })).status,
      200,
    );
  } finally {
    f.close();
  }
});
test("hidden description and graph never appear; malformed relationships rejected", async () => {
  const f = setup();
  try {
    const r = example();
    r.id = "";
    r.visibility = {
      description: false,
      graph: false,
      images: false,
      downloads: false,
    };
    const s = (await f.admin("post", "/records").send(r)).body;
    await f.admin("post", "/publish/" + s.id);
    const p = (await request(f.app).get("/api/records/" + s.id)).body;
    assert.equal(p.summary, "");
    assert.deepEqual(p.nodes, []);
    assert.deepEqual(p.runs, []);
    r.edges[0].target = "absent";
    assert.equal((await f.admin("post", "/records").send(r)).status, 400);
  } finally {
    f.close();
  }
});

test("preview equals public projection; private fields, image bytes and downloads have separate gates", async()=>{
 const f=setup();try{
  const up=await f.admin("post","/upload").set("Content-Type","application/octet-stream").set("X-Filename","result.png").send(Buffer.from([137,80,78,71,13,10,26,10,0]));
  assert.equal(up.status,200);const aid=up.body.id;
  const r={...example(),id:"",project:"PRIVATE-PROJECT",summary:"PRIVATE-SUMMARY",secret:"PRIVATE-EXTRA",visibility:{description:false,graph:false,images:true,downloads:false},assets:[aid]};
  const saved=(await f.admin("post","/records").send(r)).body;
  assert.equal((await request(f.app).get("/api/admin/preview/"+saved.id)).status,401);
  assert.equal((await request(f.app).get("/api/images/"+aid)).status,404);
  const preview=(await f.admin("get","/preview/"+saved.id)).body;
  assert.equal(preview.project,"");assert.equal(preview.secret,undefined);
  await f.admin("post","/publish/"+saved.id);
  assert.deepEqual((await request(f.app).get("/api/records/"+saved.id)).body,preview);
  const image=await request(f.app).get("/api/images/"+aid);assert.equal(image.status,200);assert.match(image.headers["content-disposition"],/^inline/);
  assert.equal((await request(f.app).get("/api/files/"+aid)).status,404);
  await f.admin("post","/unpublish/"+saved.id);assert.equal((await request(f.app).get("/api/images/"+aid)).status,404);
 }finally{f.close();}
});
test("record relationships pin real versions, preserve history and hide private targets",async()=>{
 const f=setup();try{
  const skill=(await f.admin("post","/records").send({...blank(),title:"스킬 v1"})).body;
  await f.admin("post","/publish/"+skill.id);
  const ref={recordId:skill.id,version:1,role:"스킬",note:"검증에 사용"};
  const project={...example(),id:"",title:"실행 기록",relations:[ref],runs:[{date:"2026-11-05",skillVersion:"v1",harnessVersion:"해당 없음",evidence:"실행 결과 검토",result:"검토 완료",references:[ref]}]};
  const saved=(await f.admin("post","/records").send(project)).body;
  await f.admin("post","/publish/"+saved.id);
  await f.admin("post","/records").send({...skill,title:"스킬 v2",reason:"수정"});
  await f.admin("post","/publish/"+skill.id);
  let pub=(await request(f.app).get("/api/records/"+saved.id)).body;
  assert.equal(pub.runs[0].references[0].version,1);
  assert.equal((await f.admin("get","/versions/"+skill.id)).body[1].content.title,"스킬 v1");
  assert.equal((await f.admin("post","/records").send({...project,relations:[{...ref,version:99}]})).status,400);
  assert.equal((await f.admin("post","/records").send({...project,runs:[{...project.runs[0],references:[]}]})).status,400);
  await f.admin("post","/unpublish/"+skill.id);
  pub=(await request(f.app).get("/api/records/"+saved.id)).body;
  assert.deepEqual(pub.relations,[]);assert.deepEqual(pub.runs[0].references,[]);
  const backup=(await f.admin("get","/export")).body;
  const imported=await f.admin("post","/import").send(backup);assert.equal(imported.status,200);
  const copies=(await f.admin("get","/records")).body.filter((r:any)=>![skill.id,saved.id].includes(r.id));
  const copy=copies.find((r:any)=>r.title==="실행 기록");const skillCopy=copies.find((r:any)=>r.title==="스킬 v2");
  assert.equal(copy.relations[0].recordId,skillCopy.id);assert.equal(copy.runs[0].references[0].recordId,skillCopy.id);assert.equal(copy.published,false);
 }finally{f.close();}
});
test("malformed backup snapshots and nonboolean public text are rejected before writes",async()=>{
 const f=setup();try{
  const r=example();r.id="x";r.nodes[0].publicText="false" as any;
  assert.equal((await f.admin("post","/records").send(r)).status,400);
  const before=(await f.admin("get","/records")).body.length;
  const bad=await f.admin("post","/import").send({records:[{...blank(),id:"x",title:"copy"}],versions:[{record_id:"x",content:"{"}]});
  assert.equal(bad.status,400);assert.equal((await f.admin("get","/records")).body.length,before);
 }finally{f.close();}
});
