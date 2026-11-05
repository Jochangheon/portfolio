import { createApp } from "./app.ts";
import { createStore } from "./store.ts";
import express from "express";
import { resolve } from "node:path";
import { matchRoute, recordPath } from "../src/lib/routes.ts";
const store=createStore(resolve(process.env.DATA_DIR || "data"));
const app=createApp(store);
if(process.env.NODE_ENV==="production"){
 app.use(express.static("dist",{index:false,fallthrough:true}));
 app.get("/",(req,res,next)=>{
  if(req.query.example==="1")return res.redirect(308,"/examples/workflow");
  if(typeof req.query.record==="string")return res.redirect(308,recordPath(req.query.record));
  next();
 });
 app.use((req,res,next)=>{
  if(!["GET","HEAD"].includes(req.method))return next();
  const route=matchRoute(req.path);
  if(route.page==="not-found")return next();
  const status=route.page==="detail" && !store.get(route.id)?404:200;
  res.status(status).sendFile(resolve("dist/index.html"));
 });
 app.use((_req,res)=>res.status(404).send("페이지를 찾을 수 없습니다."));
}else{
 const {createServer}=await import("vite");
 const vite=await createServer({server:{middlewareMode:true},appType:"spa"});
 app.use(vite.middlewares);
}
const http=app.listen(Number(process.env.PORT||3000),process.env.HOST||"127.0.0.1",()=>console.log("Portfolio server ready"));
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>http.close(()=>{store.db.close();process.exit(0);}));
