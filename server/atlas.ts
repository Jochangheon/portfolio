import type { RecordData } from "../src/model.ts";
import { relationshipLabels } from "../src/model.ts";
import type { Store } from "./store.ts";
import { publicRecord } from "../src/projection.ts";
export function validRelationships(value: any): boolean {
 return value===undefined || (Array.isArray(value) && value.length<=100 && value.every(x=>x &&
 /^[a-zA-Z0-9_-]{1,128}$/.test(x.targetId) && typeof x.targetId==="string" &&
 Object.hasOwn(relationshipLabels,x.kind) && ["confirmed","proposed"].includes(x.evidence) &&
 typeof x.note==="string" && x.note.length<=5000 &&
 (x.targetVersion===undefined || (Number.isInteger(x.targetVersion) && x.targetVersion>0))));
}
export function relationshipsExist(store:Store,r:RecordData,batch=new Set<string>()){
 return (r.relationships||[]).every(x=>x.targetId!==r.id &&
 (batch.has(x.targetId)||!!store.get(x.targetId,true)) &&
 (!x.targetVersion || !!store.db.prepare("SELECT id FROM versions WHERE record_id=? AND number=?").get(x.targetId,x.targetVersion)));
}
export function atlas(store:Store,admin=false){
 const records=store.list(admin).map((r:any)=>admin?r:publicRecord(r));
 const ids=new Set(records.map((r:any)=>r.id));
 const nodes=records.map((r:any)=>({id:r.id,title:r.title,type:r.type,summary:r.summary,origin:r.origin,
  status:admin?(r.published?"게시됨 · 수정 초안":"비공개 초안"):"공개",
  version:(store.db.prepare("SELECT revision FROM records WHERE id=?").get(r.id) as any)?.revision||0}));
 const edges:any[]=[];
 for(const r of records){
  if(!admin&&!r.visibility.graph)continue;
  const add=(target:string,kind:string,evidence:string,note:string,version?:number,run?:string)=>{
   if(!ids.has(target)||target===r.id)return;
   edges.push({id:r.id+"-"+edges.length,source:r.id,target,kind,evidence,note,version,run});
  };
  for(const x of r.relationships||[])add(x.targetId,x.kind,x.evidence,x.note,x.targetVersion);
  for(const x of r.relations||[])add(x.recordId,x.role==="관련 실험"?"tests":x.role==="결과물"?"produces":"uses","confirmed",x.note,x.version);
  for(const run of r.runs)for(const x of run.references||[])add(x.recordId,"uses","execution",run.evidence+" · "+run.result,x.version,run.date);
 }
 return {nodes,edges};
}
