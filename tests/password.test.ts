import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../server/password.ts";
test("password verification accepts the configured value and rejects incorrect inputs",()=>{
 for(const value of ["0427","a longer password!"]){
 const hash=hashPassword(value);
 assert.equal(verifyPassword(value,hash),true);
 assert.equal(verifyPassword(value+"x",hash),false);
 assert.equal(verifyPassword("",hash),false);
 assert.equal(verifyPassword(null,hash),false);
 assert.equal(verifyPassword("x".repeat(257),hash),false);
 assert.equal(verifyPassword(value,"malformed"),false);
 }
});
