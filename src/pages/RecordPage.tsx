import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { example } from "../model";
import Detail from "../components/Detail";
export default function RecordPage({id, isExample=false}: {id?: string; isExample?: boolean}) {
 const [record,setRecord]=useState<any>();
 const [error,setError]=useState("");
 useEffect(()=>{let active=true; setRecord(undefined); setError("");
  (isExample ? Promise.resolve(example()) : api("/records/"+encodeURIComponent(id!))).then(r=>{if(active){setRecord(r); document.title=r.title+" | 조창헌 포트폴리오";}}).catch(e=>{if(active)setError(e.message);});
  return ()=>{active=false;};
 },[id,isExample]);
 return <><a className="back" href="/records">← 작업 목록으로 돌아가기</a>
 {error ? <section role="alert"><h1>기록을 찾을 수 없습니다</h1><p>다른 사람에게 공개한 글만 볼 수 있어요.</p></section> : record ? <Detail record={record}/> : <p role="status">기록을 불러오는 중…</p>}
 </>;
}
