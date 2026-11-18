import { useEffect, useRef, useState, type MouseEvent } from "react";
import Markdown from "react-markdown";
import { api } from "../lib/api";
import { editorPath } from "../lib/routes";
import { folderOptions, type Folder, type Note, type WorkspaceEntry } from "../workspace";
import type { RecordData } from "../model";
import Links from "../components/Links";

type Draft = {title:string; project:string; type:string; links:string; assets:string[]; body:string; folderId:string|null; pinned:boolean; archived:boolean};
type Asset = {id:string; name:string; size:number; mime:string; analysis:string};
type Loaded = {record:RecordData; note:Note; assets:Asset[]; published:boolean;capture?:{mode:string;agentName?:string;agentRole?:string;status:string}};

export default function WorkspaceEditor({id,folders,onSaved}:{id:string;folders:Folder[];onSaved:(values:Partial<WorkspaceEntry>)=>void}) {
  const [loaded,setLoaded] = useState<Loaded>();
  const [loadError,setLoadError] = useState("");
  useEffect(()=>{
    let active = true;
    api("/admin/workspace/pages/"+id).then(data=>{if(active)setLoaded(data);}).catch(e=>{if(active)setLoadError(e.message);});
    return ()=>{active=false;};
  },[id]);
  if(loadError) return <section role="alert"><h1>기록을 열지 못했습니다</h1><p>{loadError}</p><a href="/workspace">모든 기록으로</a></section>;
  if(!loaded) return <p role="status">기록을 여는 중…</p>;
  return <NoteEditor key={id} id={id} loaded={loaded} folders={folders} onSaved={onSaved}/>;
}

function NoteEditor({id,loaded,folders,onSaved}:{id:string;loaded:Loaded;folders:Folder[];onSaved:(values:Partial<WorkspaceEntry>)=>void}) {
  const initial: Draft = {title:loaded.record.title,project:loaded.record.project,type:loaded.record.type,links:loaded.record.links,assets:loaded.record.assets,
    body:loaded.note.body,folderId:loaded.note.folderId,pinned:loaded.note.pinned,archived:loaded.note.archived};
  const [draft,setDraft] = useState(initial);
  const latest = useRef(initial), saved = useRef(JSON.stringify(initial)), version = useRef(loaded.note.version);
  const pending = useRef<Promise<void>|null>(null);
  const [saving,setSaving] = useState(false);
  const [updated,setUpdated] = useState(loaded.note.updated);
  const [error,setError] = useState("");
  const [uploading,setUploading] = useState(false);
  const [uploadMessage,setUploadMessage] = useState("");
  const [assets,setAssets] = useState(loaded.assets);
  const [preview,setPreview] = useState(!!loaded.capture);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const [info,setInfo] = useState("");
  function change(values:Partial<Draft>) {
    latest.current = {...latest.current,...values};
    setDraft(latest.current);
  }
  async function persist() {
    if(pending.current) return pending.current;
    const snapshot = {...latest.current,title:latest.current.title.trim() || "제목 없는 기록"};
    const serialized = JSON.stringify(snapshot);
    if(serialized === saved.current) return;
    setSaving(true);
    const task = (async()=>{
      try {
        const note: Note = await api("/admin/workspace/pages/"+id,"PUT",{...snapshot,version:version.current});
        version.current=note.version;saved.current=serialized;setUpdated(note.updated);setError("");
        onSaved({title:snapshot.title,type:snapshot.type,pinned:snapshot.pinned,archived:snapshot.archived,folderId:snapshot.folderId,updated:note.updated});
      } catch(e) {setError((e as Error).message);throw e;}
      finally {pending.current=null;setSaving(false);}
    })();
    pending.current=task;
    return task;
  }
  async function flush() {
    // Saving may finish while the user is still typing. Flush the newest state as well.
    await persist();
    const current = {...latest.current,title:latest.current.title.trim()||"제목 없는 기록"};
    if(JSON.stringify(current)!==saved.current) await persist();
  }
  const dirty = JSON.stringify({...draft,title:draft.title.trim()||"제목 없는 기록"})!==saved.current;
  useEffect(()=>{
    if(!dirty || saving || uploading || error) return;
    const timer = window.setTimeout(()=>{persist().catch(()=>{});},850);
    return ()=>window.clearTimeout(timer);
  },[draft,saving,uploading,error]);
  useEffect(()=>{
    const warn = (event:BeforeUnloadEvent)=>{
      if(pending.current || JSON.stringify({...latest.current,title:latest.current.title.trim()||"제목 없는 기록"})!==saved.current) {
        event.preventDefault();event.returnValue="";
      }
    };
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[]);
  function follow(event:MouseEvent<HTMLElement>) {
    const link=(event.target as HTMLElement).closest("a");
    if(!link || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || link.hasAttribute("download") || link.target==="_blank") return;
    if(dirty || saving) {
      event.preventDefault();
      flush().then(()=>location.assign(link.href)).catch(()=>{});
    }
  }
  function insert(text:string) {
    const input=textArea.current, body=latest.current.body;
    const start=input?.selectionStart??body.length, end=input?.selectionEnd??body.length;
    change({body:body.slice(0,start)+text+body.slice(end)});
    requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+text.length,start+text.length);});
  }
  function download() {
    const content = "# "+draft.title+"\n\n"+draft.body+"\n\n"+draft.links;
    const url=URL.createObjectURL(new Blob([content],{type:"text/markdown;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="work-note.md";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function upload(files:FileList|null) {
    if(!files?.length) return;
    const selected = Array.from(files);
    setUploading(true);setUploadMessage("");
    try {
      await flush();
      for(const file of selected) {
        if(file.size>10*1024*1024) throw Error(file.name+"은 10MB를 넘습니다.");
        const response=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Requested-With":"portfolio","X-Filename":encodeURIComponent(file.name)},body:file});
        const asset=await response.json();
        if(!response.ok) throw Error(asset.error || "파일을 올리지 못했습니다.");
        setAssets(current=>[...current,{...asset,size:file.size,analysis:JSON.stringify(asset.analysis)}]);
        change({assets:[...latest.current.assets,asset.id]});
        await flush();
        setUploadMessage(file.name+" 저장 완료");
      }
    } catch(e) {setUploadMessage((e as Error).message);} finally {setUploading(false);}
  }
  const fallback = [loaded.record.summary,loaded.record.design].filter(Boolean).join("\n\n");
  return <article className="workspace-note" onClick={follow} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==="s"){event.preventDefault();flush().catch(()=>{});}}}>
    <div className="note-toolbar"><a href="/workspace">← 내 기록</a>
      <div><span className="note-save-state" role="status">{saving?"저장 중…":error?"저장 확인 필요":dirty?"저장 대기 중…":updated?"저장됨 · "+new Date(updated).toLocaleTimeString("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}):"서버에 저장됨"}</span>
      <button disabled={saving||uploading} onClick={()=>flush().catch(()=>{})}>지금 저장</button></div>
    </div>
    {error&&<div className="workspace-error" role="alert"><p>{error}</p><button onClick={()=>persist().catch(()=>{})}>저장 다시 시도</button><button onClick={download}>현재 메모 내려받기</button><button onClick={()=>location.reload()}>최신 기록 다시 열기</button></div>}
    <label className="note-title"><span className="sr-only">기록 제목</span><input aria-label="기록 제목" placeholder="제목 없는 기록" maxLength={180} value={draft.title} onChange={e=>change({title:e.target.value})}/></label>
    <div className="note-properties">
      <label>프로젝트<input value={draft.project} maxLength={80} placeholder="어떤 프로젝트의 작업인가요?" onChange={e=>change({project:e.target.value})}/></label>
      <label>폴더<select value={draft.folderId||""} onChange={e=>change({folderId:e.target.value||null})}><option value="">폴더 없음</option>{folderOptions(folders).map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
      <label>종류<select value={draft.type} onChange={e=>change({type:e.target.value})}><option value="프로젝트">만든 작업</option><option value="실험 노트">메모·실험</option><option value="스킬·워크플로">스킬·사용법</option></select></label>
      <button className={draft.pinned?"note-pinned":""} aria-pressed={draft.pinned} onClick={()=>change({pinned:!draft.pinned})}>{draft.pinned?"★ 즐겨찾기":"☆ 즐겨찾기"}</button>
    </div>
    {loaded.capture&&<div className="capture-context"><strong>{loaded.capture.mode==="subagent"?"서브 작업 · "+(loaded.capture.agentRole||loaded.capture.agentName||"맡은 일"):"메인 작업"}</strong><span>{loaded.capture.status==="interrupted"?"중단된 작업":"답변이 남은 작업"}</span><a href={"/admin/atlas?project="+encodeURIComponent(draft.project)}>프로젝트 연결 지도 →</a></div>}
    <div className="note-body-heading"><h1>{loaded.capture?"질문과 답변 정리":"작업 메모"}</h1><button aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?"계속 쓰기":"읽는 모습"}</button></div>
    <p className="workspace-hint">AI에게 한 요청, 답변, 시행착오를 자유롭게 남기세요. 이 메모는 나만 볼 수 있어요.</p>
    {!draft.body&&<div className="note-starters"><span>무엇부터 적을까요?</span>
      <button onClick={()=>change({body:"## 하려던 일\n\n\n## AI에게 부탁한 내용\n\n\n## 내가 확인하고 바꾼 점\n\n\n## 결과와 다음 할 일\n\n"})}>작업 과정</button>
      <button onClick={()=>change({body:"## 질문\n\n\n## 상세내용\n\n\n## 정리\n\n"})}>질문·답변·정리</button>
      <button onClick={()=>change({body:"## 이 방법을 쓰는 때\n\n\n## AI가 지켜야 할 설명\n\n\n## 사용한 파일과 관련 작업\n\n\n## 확인한 결과\n\n"})}>스킬·사용법</button>
    </div>}
    {preview?<div className="note-markdown"><Markdown components={{img:({alt})=><span>[외부 이미지 · {alt}]</span>,a:({href,children})=><a href={href} target="_blank" rel="noreferrer">{children}</a>}}>{draft.body || "아직 메모가 없습니다."}</Markdown></div>:<>
      <div className="note-format" aria-label="글쓰기 도구"><button onClick={()=>insert("\n## ")}>소제목</button><button onClick={()=>insert("\n- ")}>목록</button><button onClick={()=>insert("\n- [ ] ")}>할 일</button><button onClick={()=>insert("\n\n")}>문단</button></div>
      <textarea ref={textArea} className="note-text" aria-label="나만 보는 작업 메모" maxLength={100000} value={draft.body} onChange={e=>change({body:e.target.value})} placeholder="오늘 어떤 작업을 했나요? AI와 나눈 대화를 그대로 붙여 넣어도 됩니다."/>
    </>}
    <section className="note-attachments"><div className="note-body-heading"><h2>사진과 파일</h2><label className="note-upload">{uploading?"올리는 중…":"+ 파일 붙이기"}<input type="file" multiple disabled={uploading} aria-label="작업 파일 붙이기" onChange={e=>{upload(e.target.files);e.target.value="";}}/></label></div>
      <p className="workspace-hint">파일당 10MB · Markdown, 텍스트, 코드, ZIP, PDF, 엑셀, 이미지</p>
      {uploadMessage&&<p role="status">{uploadMessage}</p>}
      {draft.assets.map(id=>{
        const asset=assets.find(a=>a.id===id);
        let analysis:any={};try {analysis=JSON.parse(asset?.analysis||"{}");}catch{}
        return <div className="note-asset" key={id}><div><a href={"/api/files/"+id} download>{asset?.name||"첨부파일"}</a>{asset&&<small>{Math.ceil(asset.size/1024)} KB</small>}</div><button aria-label={(asset?.name||"첨부파일")+" 연결 해제"} onClick={()=>change({assets:draft.assets.filter(a=>a!==id)})}>연결 해제</button>
          {asset?.mime.startsWith("image/")&&<img className="note-image" src={"/api/images/"+id} alt={asset.name}/>}
          {(analysis.text||analysis.files?.length>0)&&<details><summary>파일 내용과 폴더 구조 보기</summary>
            {analysis.text&&<><button onClick={()=>{change({body:latest.current.body+"\n\n"+analysis.text});setInfo("파일의 글을 메모에 붙였습니다.");}}>글을 메모에 붙이기</button><pre>{analysis.text}</pre></>}
            {analysis.files?.map((file:any)=><details key={file.path}><summary>{file.path}</summary><pre>{file.text||"파일 목록에서 확인했습니다."}</pre></details>)}
          </details>}
        </div>;
      })}
    </section>
    <section className="note-links"><label>관련 링크<textarea rows={3} value={draft.links} onChange={e=>change({links:e.target.value})} placeholder="GitHub, 완성한 사이트, 참고한 자료의 주소를 한 줄에 하나씩 붙여 넣으세요."/></label><Links value={draft.links}/></section>
    {fallback&&<details className="note-existing"><summary>이전에 정리한 소개와 작업 과정 보기</summary><p>{fallback}</p></details>}
    <section className="note-share"><div><h2>포트폴리오로 소개하기</h2><p>공개할 설명과 파일을 고르고 미리보기로 확인할 수 있습니다.</p><a className="button primary" href={editorPath(id)}>공개할 내용 정리하기 →</a></div><span>{loaded.published?"공개한 소개가 있어요":"아직 공개하지 않았어요"}</span></section>
    <div className="note-bottom"><button onClick={download}>메모 내려받기</button><button onClick={()=>{change({archived:!draft.archived});setInfo(draft.archived?"모든 기록으로 옮겼습니다.":"보관함으로 옮겼습니다. 보관함에서 다시 꺼낼 수 있어요.");}}>{draft.archived?"보관함에서 꺼내기":"보관함에 넣기"}</button></div>
    {info&&<p role="status">{info}</p>}
  </article>;
}
