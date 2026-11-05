import { useState } from "react";
import {roleName} from "../copy";
import { api } from "../lib/api";
import type { VersionReference } from "../model";
export default function VersionLinksEditor({records, value, onChange, execution=false}: {
 records: any[]; value: VersionReference[]; onChange: (value: VersionReference[])=>void; execution?: boolean;
}) {
 const [recordId,setRecordId]=useState(""); const [versions,setVersions]=useState<any[]>([]);
 const [version,setVersion]=useState(0); const [role,setRole]=useState("스킬"); const [note,setNote]=useState("");
 const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 return <div className="version-links">
 {value.map((ref,i)=><div className="panel" key={i}><b>{records.find(r=>r.id===ref.recordId)?.title || "연결 기록"} · {ref.version}번째 공개한 내용</b><p>{roleName(ref.role)} · {ref.note}</p><button onClick={()=>onChange(value.filter((_,j)=>j!==i))}>이 연결 지우기</button></div>)}
 <label>연결할 기록<select value={recordId} disabled={loading} onChange={async e=>{
  const id=e.target.value;setRecordId(id);setVersions([]);setVersion(0);setError("");
  if(!id)return;setLoading(true);
  try {const vs=await api("/admin/versions/"+encodeURIComponent(id));setVersions(vs);setVersion(vs[0]?.number||0);}
  catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }}><option value="">기록 선택</option>{records.filter(r=>r.revision>0).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
 <label>당시 공개했던 내용<select value={version} onChange={e=>setVersion(Number(e.target.value))}><option value={0}>어느 때의 내용인가요?</option>{versions.map(v=><option key={v.id} value={v.number}>{v.number}번째 공개 · {v.reason}</option>)}</select></label>
 <label>연결 역할<select value={role} onChange={e=>setRole(e.target.value)}>{["스킬","하네스",...(!execution?["관련 실험","결과물"]:[])].map(x=><option key={x} value={x}>{roleName(x)}</option>)}</select></label>
 <label>연결 근거<input value={note} onChange={e=>setNote(e.target.value)}/></label>
 <button disabled={loading || !recordId || !version} onClick={()=>{onChange([...value,{recordId,version,role,note}]);setRecordId("");setVersion(0);setVersions([]);setNote("");}}>선택한 내용 연결하기</button>
 {error && <p role="alert">{error}</p>}
 <p className="muted">나중에 글을 고쳐도 당시 쓴 내용이 무엇인지 남습니다. 나만 보는 글과의 연결은 방문자에게 보이지 않아요.</p>
 </div>;
}
