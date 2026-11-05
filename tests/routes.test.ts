import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoute, recordPath, editorPath } from "../src/lib/routes.ts";
test("stable public, category and editor paths",()=>{
 assert.deepEqual(matchRoute("/"),{page:"home"});
 for(const [path,category] of [["/records","전체"],["/records/projects","프로젝트"],["/records/experiments","실험 노트"],["/records/workflows","스킬·워크플로"]])assert.deepEqual(matchRoute(path),{page:"records",category});
 assert.deepEqual(matchRoute(recordPath("a-123")),{page:"detail",id:"a-123"});
 assert.deepEqual(matchRoute(editorPath("a-123",true)),{page:"admin",id:"a-123",mode:"preview"});
 assert.deepEqual(matchRoute("/admin/records/new"),{page:"admin",mode:"new"});
 for(const path of ["/administer","/records/a/b","/missing.js","/api/admin","/records/%2e%2e"]) assert.equal(matchRoute(path).page,"not-found");
});
