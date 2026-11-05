import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import request from "supertest";
import {createStore} from "../server/store.ts";
import {createApp} from "../server/app.ts";
import {hashPassword,verifyPassword} from "../server/password.ts";
test("password login uses server sessions, origin checks, expiry and persistent rate limiting",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"portfolio-auth-"));const store=createStore(dir);
 const password="test-only-long-password";const hash=hashPassword(password);
 const app=createApp(store,{origin:"https://portfolio.test",passwordHash:hash});
 const login=(value:string)=>request(app).post("/api/login").set("Origin","https://portfolio.test").set("X-Requested-With","portfolio").send({password:value});
 try{
  assert.equal(verifyPassword(password,hash),true);assert.equal(verifyPassword(password,hashPassword("different-password")),false);
  assert.equal((await request(app).post("/api/login").send({password})).status,403);
  assert.equal((await request(app).get("/api/admin/records")).status,401);
  const success=await login(password);assert.equal(success.status,200);
  const cookies=success.headers["set-cookie"] as unknown as string[];
  assert.match(cookies[0],/HttpOnly/);assert.match(cookies[0],/Secure/);assert.match(cookies[0],/SameSite=Lax/);
  assert.equal((await request(app).get("/api/admin/records").set("Cookie",cookies)).status,200);
  const changed=await request(app).post("/api/admin/password").set("Origin","https://portfolio.test").set("X-Requested-With","portfolio").set("Cookie",cookies).send({currentPassword:password,newPassword:"replacement-long-password"});
  assert.equal(changed.status,200);
  assert.equal((await request(app).get("/api/admin/records").set("Cookie",cookies)).status,401);
  assert.equal((await login(password)).status,401);
  assert.equal((await login("replacement-long-password")).status,200);
  store.db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal((await request(app).get("/api/admin/records").set("Cookie",cookies)).status,401);
  for(let i=0;i<5;i++)assert.equal((await login("wrong-but-long-password")).status,401);
  assert.equal((await login(password)).status,429);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
