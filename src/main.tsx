import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {typeName} from "./copy";
import { api } from "./lib/api";
import { matchRoute, recordPath } from "./lib/routes";
import "./style.css";
const AtlasPage=lazy(()=>import("./pages/AtlasPage"));
const HomePage=lazy(()=>import("./pages/HomePage"));
const RecordsPage=lazy(()=>import("./pages/RecordsPage"));
const RecordPage=lazy(()=>import("./pages/RecordPage"));
const AdminPage=lazy(()=>import("./pages/AdminPage"));
const ApproachPage=lazy(()=>import("./pages/ApproachPage"));
const standalone=!!window.__PORTFOLIO_PREVIEW__;
function App(){
 const route=matchRoute(location.pathname);
 const [records,setRecords]=useState<any[]>([]);const [profile,setProfile]=useState<any>({});
 const [ready,setReady]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{
  // Preserve previously shared links while making paths canonical.
  const legacy=new URLSearchParams(location.search);
  if(location.pathname==="/" && (legacy.has("record")||legacy.get("example")==="1")){
   location.replace(legacy.get("example")==="1"?"/examples/workflow":recordPath(legacy.get("record")!));return;
  }
  let active=true;
  Promise.all([api("/records"),api("/profile")]).then(([r,p])=>{if(active){setRecords(r);setProfile(p);setReady(true);}}).catch(e=>{if(active){setError(e.message);setReady(true);}});
  document.title=(route.page==="records" ? (route.category==="전체"?"작업 모아보기":typeName(route.category)) : route.page==="admin"?"내 글 관리":route.page==="approach"?"이 사이트 소개":"조창헌 포트폴리오")+" | 조창헌";
  return ()=>{active=false;};
 },[]);
 let page;
 if(route.page==="admin") page=standalone?<p>서버 연결이 필요한 관리자 페이지입니다.</p>:<AdminPage recordId={route.id} mode={route.mode}/>;
 else if(route.page==="atlas") page=<AtlasPage admin={route.admin}/>;
 else if(route.page==="detail"||route.page==="example") page=<RecordPage id={route.page==="detail"?route.id:undefined} isExample={route.page==="example"}/>;
 else if(route.page==="approach") page=<ApproachPage/>;
 else if(route.page==="not-found") page=<section><h1>페이지를 찾을 수 없습니다</h1><a href="/records">작업 모아보기 →</a></section>;
 else if(!ready) page=<p role="status">기록을 불러오는 중…</p>;
 else if(error) page=<section role="alert"><h1>기록을 불러오지 못했습니다</h1><p>{error}</p><button onClick={()=>location.reload()}>다시 시도</button></section>;
 else if(route.page==="records") page=<RecordsPage records={records} category={route.category}/>;
 else page=<HomePage records={records} profile={profile}/>;
 return <><a className="skip-link" href="#main-content">본문으로 바로가기</a>
 <header><a className="brand" href="/">조창헌<span> / 작업실</span></a>
 <nav aria-label="주 메뉴"><a href="/records" aria-current={route.page==="records"?"page":undefined}>작업 모아보기</a><a href="/atlas" aria-current={route.page==="atlas"?"page":undefined}>작업 연결 보기</a><a href="/approach" aria-current={route.page==="approach"?"page":undefined}>이 사이트 소개</a>{!standalone&&<a className="admin-link" href="/admin">내 글 관리 ↗</a>}</nav></header>
 <main id="main-content">{standalone&&<div className="preview-note">화면 모양을 확인하는 미리보기입니다. 이 화면에서는 글을 저장하지 않습니다.</div>}
 <Suspense fallback={<p role="status">페이지를 불러오는 중…</p>}>{page}</Suspense></main>
 <footer className="site-footer"><span>조창헌 포트폴리오</span><span>만든 것과 만드는 과정을 함께 남깁니다.</span></footer></>;
}
createRoot(document.getElementById("root")!).render(<App/>);
