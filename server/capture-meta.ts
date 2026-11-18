import type { Store } from "./store.ts";
export type CaptureMeta={threadId:string;turnId:string;rootThreadId:string;mode:"main"|"subagent";parentThreadId?:string;parentTurnId?:string;agentName?:string;agentRole?:string;threadTitle:string;created:string;status:"completed"|"interrupted";question:string;detail:string;recap:string};
const id=(v:unknown)=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
const text=(v:unknown,max:number)=>typeof v==="string"&&v.length<=max;
export function validCapture(c:any):c is CaptureMeta {
 return c&&id(c.threadId)&&id(c.turnId)&&id(c.rootThreadId)&&["main","subagent"].includes(c.mode)&&
  (c.mode==="main"?c.rootThreadId===c.threadId&&c.parentThreadId===undefined:id(c.parentThreadId)&&c.parentThreadId!==c.threadId)&&
  (c.parentTurnId===undefined||id(c.parentTurnId))&&text(c.agentName??"",100)&&text(c.agentRole??"",100)&&
  text(c.threadTitle,180)&&typeof c.created==="string"&&Number.isFinite(Date.parse(c.created))&&["completed","interrupted"].includes(c.status)&&
  text(c.question,35000)&&text(c.detail,45000)&&text(c.recap,1000);
}
export function captureBody(c:CaptureMeta){return "## 질문\n\n"+c.question+"\n\n## 상세내용\n\n"+c.detail+"\n\n## 정리\n\n"+c.recap+"\n";}
export function captureFor(store:Store,id:string):CaptureMeta|undefined {
 const row:any=store.db.prepare("SELECT metadata FROM codex_notes WHERE record_id=?").get(id);
 return row?JSON.parse(row.metadata):undefined;
}
export function validCaptureBackup(value:any,ids:Set<string>){
 return value===undefined||Array.isArray(value)&&value.length<=10000&&new Set(value.map(x=>x?.record_id)).size===value.length&&
  value.every(x=>x&&ids.has(x.record_id)&&validCapture(x.metadata));
}
export function restoreCaptures(store:Store,value:any,records:Map<string,string>){
 for(const item of value||[])store.db.prepare("INSERT INTO codex_notes VALUES(?,?)").run(records.get(item.record_id)!,JSON.stringify(item.metadata));
}
