import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { Store } from "./store.ts";
import { blank, type RecordData } from "../src/model.ts";
import { relationshipsExist } from "./atlas.ts";
const hash=(x:string)=>createHash("sha256").update(x).digest("hex");
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const fingerprint=(r:any)=>hash(canonical(r));
export function registerIngest(app:express.Express,store:Store,valid:(r:any)=>r is RecordData){
 const db=store.db;
 // This router precedes the general JSON parser. Its tokens only allow draft ingestion.
 const router=express.Router();
 router.use((req,res,next)=>{
  const m=req.headers.authorization?.match(/^Bearer (ptr_[a-f0-9]{64})$/);
  const row:any=m&&db.prepare("SELECT id FROM integration_tokens WHERE hash=? AND revoked=0 AND expires>?").get(hash(m[1]),Date.now());
  if(!row)return res.status(401).json({error:"유효한 기록 전용 토큰이 필요합니다."});
  db.prepare("UPDATE integration_tokens SET last_used=? WHERE id=?").run(Date.now(),row.id);next();
 });
 router.use(express.json({limit:"2mb"}));
 router.get("/catalog",(_req,res)=>res.json(store.list(true).map((r:any)=>{
  const source:any=db.prepare("SELECT source_key FROM ingestions WHERE record_id=?").get(r.id);
  return {id:r.id,title:r.title,type:r.type,version:r.revision,sourceKey:source?.source_key};
 })));
 router.post("/records",(req,res)=>{
  const entries=req.body?.entries;
  if(!Array.isArray(entries)||!entries.length||entries.length>20 ||
    entries.some(e=>!e||typeof e.sourceKey!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(e.sourceKey)) ||
    new Set(entries.map(e=>e.sourceKey)).size!==entries.length)
   return res.status(400).json({error:"entries와 중복 없는 sourceKey를 확인하세요."});
  db.exec("BEGIN IMMEDIATE");
  try{
   const mappings=new Map<string,string>(),existing=new Map<string,any>();
   for(const e of entries){
    const old:any=db.prepare("SELECT * FROM ingestions WHERE source_key=?").get(e.sourceKey);
    const current=old&&store.get(old.record_id,true);
    if(old&&(!current||fingerprint(current)!==old.last_hash)){
     const err:any=Error("사이트에서 수정한 초안을 덮어쓸 수 없습니다. 새 sourceKey로 새 기록을 만들거나 사이트에서 이어서 편집하세요.");err.status=409;throw err;
    }
    existing.set(e.sourceKey,old);mappings.set(e.sourceKey,old?.record_id||randomUUID());
   }
   const prepared=entries.map(e=>{
    if(!e.record||typeof e.record!=="object"||Array.isArray(e.record))throw Error("record 객체가 필요합니다.");
    const r:any={...blank(),...e.record,id:mappings.get(e.sourceKey)};
    // Raw originals and execution claims are intentionally outside this token's scope.
    if(r.assets?.length || r.runs?.length || r.relations?.length)throw Error("원본 첨부와 실행 버전 확정은 관리자 화면에서 등록하세요.");
    r.visibility={description:false,graph:false,images:false,downloads:false};
    r.assets=[];r.runs=[];r.relations=[];
    if(e.connections!==undefined){
     if(!Array.isArray(e.connections)||e.connections.length>100)throw Error("연결은 최대 100개입니다.");
     r.relationships=e.connections.map((x:any)=>{
      if(!x||typeof x!=="object")throw Error("연결 형식을 확인하세요.");
      const saved:any=x.targetKey&&db.prepare("SELECT record_id FROM ingestions WHERE source_key=?").get(x.targetKey);
      const id=x.targetKey?(mappings.get(x.targetKey)||saved?.record_id):x.targetId;
      return {targetId:id,kind:x.kind,evidence:x.evidence||"proposed",note:x.note||"",...(x.targetVersion?{targetVersion:x.targetVersion}:{})};
     });
    }
    if(!valid(r)||!relationshipsExist(store,r,new Set(mappings.values())))throw Error("기록 필드, 연결 대상 또는 버전을 확인하세요.");
    // All text stays private until explicitly reviewed in the editor.
    r.files=r.files.map((n:any)=>({...n,publicText:false}));
    r.nodes=r.nodes.map((n:any)=>({...n,publicText:false}));
    return {key:e.sourceKey,record:Object.fromEntries(Object.keys(blank()).map(k=>[k,(r as any)[k]])) as RecordData};
   });
   const results=prepared.map(({key,record})=>{
    store.save(record);
    db.prepare("INSERT INTO ingestions VALUES(?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET last_hash=excluded.last_hash,updated=excluded.updated").run(key,record.id,fingerprint(record),Date.now());
    return {sourceKey:key,id:record.id,status:"draft",editPath:"/admin/records/"+record.id+"/edit",previewPath:"/admin/records/"+record.id+"/preview"};
   });
   db.exec("COMMIT");res.json({records:results,atlasPath:"/admin/atlas"});
  }catch(e:any){db.exec("ROLLBACK");res.status(e.status||400).json({error:e.message});}
 });
 app.use("/api/ingest",router);
 // Existing /api/admin middleware enforces session and same-origin mutation checks.
 app.get("/api/admin/integrations",(_req,res)=>res.json(db.prepare("SELECT id,label,created,expires,revoked,last_used FROM integration_tokens ORDER BY created DESC").all()));
 app.post("/api/admin/integrations",express.json({limit:"2kb"}),(req,res)=>{
  const label=req.body?.label;
  if(typeof label!=="string"||!label.trim()||label.length>100)return res.status(400).json({error:"토큰 이름은 1~100자입니다."});
  const id=randomUUID(),token="ptr_"+randomBytes(32).toString("hex"),created=Date.now(),expires=created+180*86400000;
  db.prepare("INSERT INTO integration_tokens(id,label,hash,created,expires) VALUES(?,?,?,?,?)").run(id,label,hash(token),created,expires);
  res.json({id,token,expires});
 });
 app.delete("/api/admin/integrations/:id",(req,res)=>{db.prepare("UPDATE integration_tokens SET revoked=1 WHERE id=?").run(req.params.id as string);res.json({ok:true});});
}
