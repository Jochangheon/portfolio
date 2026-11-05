import {useEffect,useState} from "react";
import {api} from "../lib/api";
export default function IntegrationSettings(){
 const [items,setItems]=useState<any[]>([]),[token,setToken]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const refresh=()=>api("/admin/integrations").then(setItems);
 useEffect(()=>{refresh().catch(e=>setMessage(e.message));},[]);
 async function act(f:()=>Promise<any>){setBusy(true);setMessage("");try{await f();await refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <details className="panel"><summary>AI에게 글 정리와 저장 맡기기</summary>
 <p>AI에게 “이번 작업을 정리해서 저장해 줘”라고 부탁하는 기능입니다. <code>$portfolio-record</code>라는 사용법을 설치해 쓰며, 저장된 글은 나만 볼 수 있어요.</p><p>아래 연결 키는 AI가 이 사이트에 글을 보낼 때 쓰는 열쇠입니다. 글을 공개하는 권한은 없고 180일 동안 쓸 수 있습니다.</p>
 <button disabled={busy} onClick={()=>act(async()=>{const r=await api("/admin/integrations","POST",{label:"portfolio-record"});setToken(r.token);})}>새 연결 키 발급</button>
 {token&&<div className="notice"><label>이번에만 표시되는 연결 키<input readOnly value={token} type="password" autoComplete="off"/></label><button onClick={()=>act(async()=>{await navigator.clipboard.writeText(token);setMessage("연결 키를 복사했습니다.");})}>복사</button><button onClick={()=>setToken("")}>표시 지우기</button><p>설치한 기록 도구의 configure 명령에서 입력합니다. 이 키는 다른 사람에게 보여주지 마세요.</p></div>}
 {message&&<p role="status">{message}</p>}
 {items.map(x=><div className="integration-row" key={x.id}><span>{x.label} · {x.revoked?"폐기됨":new Date(x.expires).toLocaleDateString()+"까지"}</span>{!x.revoked&&<button disabled={busy} onClick={()=>act(()=>api("/admin/integrations/"+x.id,"DELETE"))}>연결 키 폐기</button>}</div>)}
 </details>;
}
