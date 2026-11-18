import type express from "express";
import { createHash, randomUUID } from "node:crypto";
import type { Store } from "./store.ts";
import { blank, type RecordData } from "../src/model.ts";
import { validCapture, captureBody, type CaptureMeta } from "./capture-meta.ts";

const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
const short=(v:unknown,max:number)=>typeof v==="string" && v.trim().length>0 && v.length<=max;
/** Mounted inside the authenticated, 2MB-limited ingest router. Insert-only capture. */
export function registerCodexCapture(router:express.Router,store:Store) {
 router.post("/codex",(req,res)=>{
  const b=req.body, db=store.db;
  let meta:CaptureMeta|undefined;
  if(b?.formatVersion===2){
   const candidate={...b.capture,threadTitle:b.threadTitle,created:b.created,status:b.status,question:b.question,detail:b.detail,recap:b.recap};
   if(!validCapture(candidate)||b.sourceKey?.split("/")[1]!==candidate.threadId||b.sourceKey?.split("/")[2]!==candidate.turnId)
    return res.status(400).json({error:"질문·상세내용·정리 또는 하위 작업 연결을 확인하세요."});
   meta=candidate;b.body=captureBody(meta);
  }
  if(!b || typeof b.sourceKey!=="string" ||
     !/^codex\/[a-zA-Z0-9_-]{1,64}\/[a-zA-Z0-9_-]{1,64}\/\d{1,4}$/.test(b.sourceKey) ||
     !short(b.title,180)||!short(b.threadTitle,180)||!short(b.project,80)||
     !short(b.body,90000)||!short(b.summary,1000)||!short(b.created,40) ||
     !Number.isFinite(Date.parse(b.created)) || !["completed","interrupted"].includes(b.status))
   return res.status(400).json({error:"Codex 기록 형식을 확인하세요."});
  db.exec("BEGIN IMMEDIATE");
  try {
   const old:any=db.prepare("SELECT record_id FROM ingestions WHERE source_key=?").get(b.sourceKey);
   if(old) {
    let upgraded=false,preserved=false;
    if(meta&&!db.prepare("SELECT record_id FROM codex_notes WHERE record_id=?").get(old.record_id)){
     const note:any=db.prepare("SELECT version FROM workspace_notes WHERE record_id=?").get(old.record_id);
     const current=store.get(old.record_id,true);
     if(current&&note?.version===0){
      store.save({...current,title:b.title,project:b.project,summary:b.summary,reason:"질문·상세내용·정리 형식으로 정리"});
      db.prepare("UPDATE workspace_notes SET body=?,updated=? WHERE record_id=?").run(b.body,new Date(b.created).toISOString(),old.record_id);
      upgraded=true;
     }else preserved=true;
     db.prepare("INSERT INTO codex_notes VALUES(?,?)").run(old.record_id,JSON.stringify(meta));
    }
    db.exec("COMMIT");
    return res.json({id:old.record_id,duplicate:true,upgraded,preserved,path:"/workspace/pages/"+old.record_id});
   }
   const thread=b.sourceKey.split("/")[1];
   const root="codex-captures", folder="codex-chat-"+digest(thread).slice(0,32);
   db.prepare("INSERT OR IGNORE INTO workspace_folders VALUES(?,?,NULL)").run(root,"Codex 작업 기록");
   // A stable folder per chat survives renames and future changes of working directory.
   db.prepare("INSERT OR IGNORE INTO workspace_folders VALUES(?,?,?)").run(folder,b.threadTitle.slice(0,80),root);
   const record:RecordData={...blank(),id:randomUUID(),title:b.title,type:"실험 노트",origin:"직접 제작",
    project:b.project,summary:b.summary,reason:"Codex 대화에서 비공개로 자동 기록",
    design:"작업 공간의 메모에서 요청과 결과를 확인할 수 있습니다.",
    source:"Codex 대화: "+b.threadTitle+" · "+b.created,
    limits:"대화에서 남긴 결과 보고입니다. 실제 실행 여부를 별도로 확인한 기록은 아닙니다.",
    visibility:{description:false,graph:false,images:false,downloads:false}};
   const previous:any=db.prepare("SELECT record_id FROM workspace_notes WHERE folder_id=? ORDER BY updated DESC,record_id DESC LIMIT 1").get(folder);
   if(previous)record.relationships=[{targetId:previous.record_id,kind:"related",evidence:"confirmed",note:"같은 Codex 대화에서 앞서 저장한 작업"}];
   store.save(record);
   db.prepare("UPDATE workspace_notes SET folder_id=?,body=?,updated=? WHERE record_id=?")
     .run(folder,b.body,new Date(b.created).toISOString(),record.id);
   // The regular draft editor cannot silently update this capture through /records.
   db.prepare("INSERT INTO ingestions VALUES(?,?,?,?)").run(b.sourceKey,record.id,"codex-insert-only",Date.now());
   if(meta)db.prepare("INSERT INTO codex_notes VALUES(?,?)").run(record.id,JSON.stringify(meta));
   db.exec("COMMIT");
   res.json({id:record.id,duplicate:false,path:"/workspace/pages/"+record.id});
  }catch(error){db.exec("ROLLBACK");throw error;}
 });
}
