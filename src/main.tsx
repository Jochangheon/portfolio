import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { typeName } from "./copy";
import { api } from "./lib/api";
import { matchRoute, recordPath } from "./lib/routes";
import { PersonalHome, CareerPage, ProjectsPage, ProjectPage } from "./pages/PortfolioPage";
import "./style.css";

const AtlasPage = lazy(() => import("./pages/AtlasPage"));
const AIHome = lazy(() => import("./pages/HomePage"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const RecordPage = lazy(() => import("./pages/RecordPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ApproachPage = lazy(() => import("./pages/ApproachPage"));
const standalone = !!window.__PORTFOLIO_PREVIEW__;
const route = matchRoute(location.pathname);

function AICollection() {
  const [data, setData] = useState<{records: any[]; profile: any}>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api("/records"), route.page === "ai" ? api("/profile") : Promise.resolve({})])
      .then(([records, profile]) => { if (active) setData({ records, profile }); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  if (error) return <section role="alert"><h1>기록을 불러오지 못했습니다</h1><p>{error}</p><button onClick={() => location.reload()}>다시 시도</button></section>;
  if (!data) return <p role="status">기록을 불러오는 중…</p>;
  return route.page === "records"
    ? <RecordsPage records={data.records} category={route.category}/>
    : <AIHome records={data.records} profile={data.profile}/>;
}

function CurrentPage() {
  switch (route.page) {
    case "home": return <PersonalHome/>;
    case "career": return <CareerPage/>;
    case "projects": return <ProjectsPage/>;
    case "project": return <ProjectPage project={route.project}/>;
    case "ai":
    case "records": return <AICollection/>;
    case "admin": return standalone ? <p>서버 연결이 필요한 관리자 페이지입니다.</p> : <AdminPage recordId={route.id} mode={route.mode}/>;
    case "atlas": return <AtlasPage admin={route.admin}/>;
    case "detail": return <RecordPage id={route.id} isExample={false}/>;
    case "example": return <RecordPage isExample/>;
    case "approach": return <ApproachPage/>;
    default: return <section><h1>페이지를 찾을 수 없습니다</h1><a href="/">포트폴리오 홈으로 →</a></section>;
  }
}

const titles = {
  home: "조창헌 포트폴리오", career: "경력과 학력", projects: "프로젝트", ai: "AI 작업",
  admin: "내 글 관리", approach: "AI 작업 소개", atlas: "작업 연결 보기", detail: "AI 작업",
  example: "AI 작업 예시", "not-found": "페이지를 찾을 수 없습니다"
};

function App() {
  const isPersonal = ["home", "career", "projects", "project", "not-found"].includes(route.page);
  useEffect(() => {
    const legacy = new URLSearchParams(location.search);
    if (route.page === "home" && (legacy.has("record") || legacy.get("example") === "1")) {
      location.replace(legacy.get("example") === "1" ? "/examples/workflow" : recordPath(legacy.get("record")!));
      return;
    }
    const title = route.page === "project" ? route.project.title : route.page === "records"
      ? (route.category === "전체" ? "작업 모아보기" : typeName(route.category)) : titles[route.page];
    document.title = route.page === "home" ? title : title + " | 조창헌";
  }, []);
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <header><a className="brand" href="/" aria-current={route.page === "home" ? "page" : undefined}>조창헌 포트폴리오</a>
      <nav aria-label="주 메뉴">
        <a href="/career" aria-current={route.page === "career" ? "page" : undefined}>경력과 학력</a>
        <a href="/projects" aria-current={route.page === "projects" ? "page" : route.page === "project" ? "location" : undefined}>프로젝트</a>
        <a href="/ai" aria-current={isPersonal ? undefined : route.page === "ai" ? "page" : "location"}>AI 작업</a>
      </nav>
    </header>
    <main id="main-content">
      {standalone && <div className="preview-note">화면 모양을 확인하는 미리보기입니다. 이 화면에서는 글을 저장하지 않습니다.</div>}
      {!isPersonal && <nav className="ai-section-nav" aria-label="AI 작업 메뉴">
        <a href="/records" aria-current={route.page === "records" ? "page" : undefined}>작업 모아보기</a>
        <a href="/atlas" aria-current={route.page === "atlas" && !route.admin ? "page" : undefined}>작업 연결 보기</a>
        <a href="/approach" aria-current={route.page === "approach" ? "page" : undefined}>AI 작업 소개</a>
        {!standalone && <a className="admin-link" href="/admin">내 글 관리 ↗</a>}
      </nav>}
      <Suspense fallback={<p role="status">페이지를 불러오는 중…</p>}><CurrentPage/></Suspense>
    </main>
    <footer className="site-footer"><a href="/">조창헌 포트폴리오</a><a href="/ai">AI 작업 보러 가기 →</a></footer>
  </>;
}
createRoot(document.getElementById("root")!).render(<App/>);
