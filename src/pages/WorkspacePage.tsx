import { useEffect, useState } from "react";
import { api } from "../lib/api";
import AdminPage from "./AdminPage";
import WorkspaceEditor from "./WorkspaceEditor";
import { folderOptions, workspacePath, type WorkspaceIndex } from "../workspace";
import "./workspace.css";

export default function WorkspacePage({id,folderId}: {id?:string;folderId?:string}) {
  const [session,setSession] = useState<any>();
  const [data,setData] = useState<WorkspaceIndex>();
  const [error,setError] = useState("");
  const [showNav,setShowNav] = useState(()=>window.matchMedia("(min-width:761px)").matches);
  const [busy,setBusy] = useState(false);
  const [showFolder,setShowFolder] = useState(false);
  const [folderName,setFolderName] = useState("");
  const [parent,setParent] = useState(folderId || "");
  const [query,setQuery] = useState(new URLSearchParams(location.search).get("q") || "");
  const [view] = useState(new URLSearchParams(location.search).get("view") || "all");
  const [kind,setKind] = useState("");
  const [sort,setSort] = useState("recent");
  useEffect(()=>{api("/session").then(setSession).catch(e=>setError(e.message));},[]);
  const refresh = () => api("/admin/workspace").then(setData);
  useEffect(()=>{if(session?.admin) refresh().catch(e=>setError(e.message));},[session]);
  async function action(run:()=>Promise<void>) {
    setBusy(true);setError("");
    try {await run();} catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function createPage() {
    const page = await api("/admin/workspace/pages","POST",{folderId:folderId || null});
    location.assign(workspacePath(page.id));
  }
  function search(value:string) {
    setQuery(value);
    const url = new URL(location.href);
    if(value) url.searchParams.set("q",value); else url.searchParams.delete("q");
    history.replaceState({},"",url);
  }
  if(!session) return <p role="status">{error || "내 작업 공간을 여는 중…"}</p>;
  if(!session.admin) return <AdminPage mode="index"/>;
  if(!data) return <section role="status"><p>{error || "저장한 기록을 불러오는 중…"}</p>{error&&<button onClick={()=>action(refresh)}>다시 시도</button>}</section>;
  const folder = data.folders.find(f=>f.id===folderId);
  const folderLinks = folderOptions(data.folders);
  const selectedView = id ? "" : view;
  const views = [["all","모든 기록"],["pinned","즐겨찾기"],["public","공개한 작업"],["archive","보관함"]];
  const includedFolders=new Set<string>();
  function includeFolder(key:string) { if(includedFolders.has(key))return;includedFolders.add(key);data!.folders.filter(f=>f.parentId===key).forEach(f=>includeFolder(f.id)); }
  if(folderId)includeFolder(folderId);
  const pages = data.pages.filter(page => {
    if (page.archived !== (selectedView==="archive")) return false;
    if (folderId && (!page.folderId || !includedFolders.has(page.folderId))) return false;
    if (selectedView==="pinned" && !page.pinned) return false;
    if (selectedView==="public" && !page.published) return false;
    return (!kind || page.type===kind) && page.searchText.includes(query.toLocaleLowerCase());
  }).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"ko"):b.updated.localeCompare(a.updated));
  return <div className="workspace-shell">
    <aside className="workspace-sidebar">
      <a className="workspace-name" href="/workspace">내 작업 공간</a>
      <button className="primary workspace-create" disabled={busy} onClick={()=>action(createPage)}>+ 새 기록</button>
      <button className="workspace-mobile-toggle" aria-expanded={showNav} onClick={()=>setShowNav(!showNav)}>{showNav?"폴더·메뉴 접기":"폴더·메뉴 펼치기"}</button>
      <div className="workspace-navigation" data-collapsed={!showNav}>
      <nav aria-label="내 기록 분류">{views.map(([key,label])=><a key={key} href={"/workspace"+(key==="all"?"":"?view="+key)} aria-current={!folderId&&selectedView===key?"page":undefined}>{label}<span>{data.pages.filter(p=>key==="archive"?p.archived:!p.archived&&(key!=="pinned"||p.pinned)&&(key!=="public"||p.published)).length}</span></a>)}</nav>
      <div className="folder-heading"><strong>폴더</strong><button aria-label="새 폴더 만들기" onClick={()=>setShowFolder(!showFolder)}>+</button></div>
      <nav aria-label="내 폴더">{folderLinks.map(f=><a className="folder-link" key={f.id} href={"/workspace/folders/"+f.id} aria-current={folderId===f.id?"page":undefined}>{f.label}</a>)}</nav>
      {!folderLinks.length&&<p className="workspace-hint">프로젝트나 주제별로 폴더를 만들어 모아 두세요.</p>}
      {showFolder&&<form className="folder-form" onSubmit={e=>{e.preventDefault();action(async()=>{await api("/admin/workspace/folders","POST",{name:folderName,parentId:parent||null});setFolderName("");setShowFolder(false);await refresh();});}}>
        <label>새 폴더 이름<input autoFocus maxLength={80} required value={folderName} onChange={e=>setFolderName(e.target.value)}/></label>
        <label>폴더 위치<select value={parent} onChange={e=>setParent(e.target.value)}><option value="">맨 위</option>{folderLinks.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        <button disabled={busy}>폴더 만들기</button>
      </form>}
      <div className="workspace-shortcuts"><a href="/admin/atlas">작업 연결 지도</a><a href="/admin/records/new">+ 새 글 쓰기</a><a href="/admin/settings">AI 연결·백업·설정</a><a href="/api/admin/export" download="portfolio-workspace.json">모든 기록과 파일 내려받기</a></div>
      <button className="workspace-logout" onClick={()=>action(async()=>{await api("/admin/logout","POST");location.reload();})}>로그아웃</button>
      </div>
    </aside>
    <div className="workspace-content">
      {error&&<p role="alert" className="workspace-error">{error}</p>}
      {id ? <WorkspaceEditor id={id} folders={data.folders} onSaved={values=>setData(current=>current&&({...current,pages:current.pages.map(page=>page.id===id?{...page,...values}:page)}))}/> : folderId&&!folder ? <section><h1>폴더를 찾을 수 없습니다</h1><a href="/workspace">모든 기록으로 돌아가기</a></section> : <>
        <div className="workspace-top"><div><p className="workspace-kicker">나만 보는 기록함</p><h1>{folder?.name || views.find(([key])=>key===selectedView)?.[1] || "모든 기록"}</h1></div><button disabled={busy} onClick={()=>action(createPage)}>+ 새 기록</button></div>
        <p className="workspace-intro">AI와 나눈 대화, 시도한 방법, 만든 파일을 한곳에 모으세요. 짧은 메모부터 시작해도 됩니다.</p>
        {folder&&<details className="folder-rename"><summary>폴더 이름 바꾸기</summary><form onSubmit={e=>{e.preventDefault();const name=new FormData(e.currentTarget).get("name");action(async()=>{await api("/admin/workspace/folders/"+folder.id,"PATCH",{name});await refresh();});}}><input name="name" aria-label="바꿀 폴더 이름" defaultValue={folder.name} maxLength={80} required/><button disabled={busy}>이름 저장</button></form></details>}
        <div className="workspace-filters">
          <label className="workspace-search"><span>기록 검색</span><input type="search" placeholder="제목이나 메모 속 단어로 찾기" value={query} onChange={e=>search(e.target.value)}/></label>
          <label><span>종류</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="">모든 종류</option><option value="프로젝트">만든 작업</option><option value="실험 노트">메모·실험</option><option value="스킬·워크플로">스킬·사용법</option></select></label>
          <label><span>정렬</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">최근 수정순</option><option value="title">이름순</option></select></label>
        </div>
        <div className="workspace-page-list">{pages.map(page=><a className="workspace-page-row" key={page.id} href={workspacePath(page.id)}>
          <div><strong>{page.pinned&&<span aria-label="즐겨찾기">★ </span>}{page.title}</strong><p>{page.excerpt || "열어서 작업 메모를 남겨 보세요."}</p></div>
          <div className="workspace-page-meta"><span>{page.published?"포트폴리오 공개 중":"나만 보기"}</span><time dateTime={page.updated}>{page.updated?new Date(page.updated).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"기존 기록"}</time></div>
        </a>)}</div>
        {!pages.length&&<div className="workspace-empty"><h2>{query?"찾는 기록이 없어요.":"첫 기록을 남겨 보세요."}</h2><p>{query?"검색어 또는 종류를 바꿔 보세요.":"오늘 AI에게 부탁한 일, 잘된 점, 다음에 해 볼 일을 적어 보세요."}</p>{!query&&<button className="primary" disabled={busy} onClick={()=>action(createPage)}>새 기록 만들기</button>}</div>}
      </>}
    </div>
  </div>;
}
