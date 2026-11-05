import {useEffect,useState} from "react";
import {api} from "../lib/api";
export default function IntegrationSettings(){
 const [items,setItems]=useState<any[]>([]),[token,setToken]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const refresh=()=>api("/admin/integrations").then(setItems);
 useEffect(()=>{refresh().catch(e=>setMessage(e.message));},[]);
 async function act(f:()=>Promise<any>){setBusy(true);setMessage("");try{await f();await refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <details className="panel"><summary>AI 기록 스킬 연결</summary>
 <p><code>$portfolio-record</code>로 작업 내용을 비공개 초안에 저장할 수 있습니다. 연결 키는 기록 목록 조회와 초안 저장에만 사용할 수 있으며 180일 후 만료됩니다.</p>
 <button disabled={busy} onClick={()=>act(async()=>{const r=await api("/admin/integrations","POST",{label:"portfolio-record"});setToken(r.token);})}>새 연결 키 발급</button>
 {token&&<div className="notice"><label>이번에만 표시되는 연결 키<input readOnly value={token} type="password" autoComplete="off"/></label><button onClick={()=>act(async()=>{await navigator.clipboard.writeText(token);setMessage("연결 키를 복사했습니다.");})}>복사</button><button onClick={()=>setToken("")}>표시 지우기</button><p>스킬의 configure 명령에서 입력하세요. 대화나 GitHub에 붙여 넣지 마세요.</p></div>}
 {message&&<p role="status">{message}</p>}
 {items.map(x=><div className="integration-row" key={x.id}><span>{x.label} · {x.revoked?"폐기됨":new Date(x.expires).toLocaleDateString()+"까지"}</span>{!x.revoked&&<button disabled={busy} onClick={()=>act(()=>api("/admin/integrations/"+x.id,"DELETE"))}>연결 키 폐기</button>}</div>)}
 </details>;
}
