import { careerSource, portfolioSource, projects, projectPath, type Project } from "../portfolio";
import "./portfolio.css";

const portrait = new URL("../assets/changheon.webp", import.meta.url).href;

function ProjectCards({ items }: { items: Project[] }) {
  return <div className="project-list">{items.map(project =>
    <a className="project-tile" href={projectPath(project)} key={project.slug}>
      <p className="project-context">{project.context}</p>
      <h3>{project.title}</h3><p>{project.summary}</p>
      <span className="case-link">이야기 읽기 <span aria-hidden="true">→</span></span>
    </a>
  )}</div>;
}

function Source({ href = portfolioSource, children = "노션 포트폴리오 원문" }) {
  return <a className="source-link" href={href}>{children} ↗</a>;
}

export function PersonalHome() {
  return <div className="portfolio-page">
    <section className="profile-lead">
      <div><p className="profile-discipline">데이터 분석 · 서비스 기획</p>
        <h1>웹사이트 이용 기록을 분석하는 <br/>조창헌입니다.</h1>
        <p className="profile-intro">사람들이 사이트에서 무엇을 누르고 어떤 화면으로 이동하는지 살펴봅니다. 어떤 행동을 기록할지 정하고, 그 결과를 담당자가 읽기 쉬운 보고서로 만듭니다.</p>
        <div className="portfolio-actions"><a className="button primary" href="/projects">프로젝트 보기 →</a><a href="/career">경력과 학력 보기</a></div>
      </div>
      <img className="profile-portrait" src={portrait} alt="바닷가에서 찍은 조창헌의 프로필 사진" fetchPriority="high" width="360" height="399"/>
    </section>
    <section className="portfolio-block" aria-labelledby="selected-projects">
      <div className="work-heading"><h2 id="selected-projects">대표 프로젝트</h2><a href="/projects">모두 보기 →</a></div>
      <ProjectCards items={projects.slice(0, 3)}/>
    </section>
    <section className="career-strip"><div><h2>어디에서 일하고 배웠나요?</h2>
      <p>영남대학교에서 컴퓨터공학을 전공했고, 골든플래닛에서 고객사의 웹사이트 이용 데이터를 수집하고 분석했습니다.</p></div>
      <a href="/career">경력과 학력 자세히 보기 →</a></section>
    <div className="source-line"><span>경력 자료 기준 · 2024년 11월 13일</span><Source/></div>
  </div>;
}

function ResumeEntry({when,title,children}:{when:string;title:string;children:React.ReactNode}) {
  return <div className="resume-entry"><p className="resume-date">{when}</p><div><h3>{title}</h3>{children}</div></div>;
}

export function CareerPage() {
  return <article className="portfolio-page resume-page">
    <div className="portfolio-heading"><p className="profile-discipline">조창헌 포트폴리오</p><h1>경력과 학력</h1><p>2024년 11월 13일에 정리한 이력입니다.</p></div>
    <section><h2>일한 곳</h2>
      <ResumeEntry when="2023.01 입사" title="골든플래닛">
        <p className="resume-role">Google Marketing Platform부 · Junior Manager</p>
        <ul><li>고객사와 어떤 행동을 기록할지 정하고, 웹사이트의 실제 기록과 비교해 빠지거나 중복된 항목을 확인했습니다.</li>
        <li>사람들이 어떤 순서로 페이지를 거쳤는지 볼 수 있도록 BigQuery에서 이용 기록을 시간순으로 정리했습니다.</li>
        <li>카드사와 증권사 담당자가 업무에 쓰는 보고서 화면을 만들었습니다.</li></ul>
        <a href="/projects/team-dashboards">부서별 보고서를 만든 과정 →</a>
      </ResumeEntry>
      <ResumeEntry when="2020.07 – 2020.08" title="삼성전자서비스"><p>휴대전화 수리 부품을 관리하고, 기사님의 가전제품 방문 수리를 보조했습니다.</p></ResumeEntry>
      <Source href={careerSource}>골든플래닛 경력기술서</Source>
    </section>
    <section><h2>공부한 곳</h2>
      <ResumeEntry when="2017.03 – 2023.02" title="영남대학교 컴퓨터공학과"><p>이공계 국가장학생으로 공부해 학점 3.87/4.5로 졸업했습니다. 2020년 12월부터 2022년 2월까지 임베디드 메모리 연구실에서 활동했습니다.</p></ResumeEntry>
      <ResumeEntry when="2022.06 – 2022.08" title="데이터 청년인재 양성 프로젝트"><p>한국데이터산업진흥원·경남대학교 교육에서 Python과 SQL을 공부하고, 건강보험심사평가원과 자동차보험 청구 기록을 분석했습니다.</p></ResumeEntry>
      <ResumeEntry when="2022.01 – 2022.02" title="포항테크노파크 인공지능 중급과정"><p>Python과 인공지능 기초·중급 과정을 수료했습니다.</p></ResumeEntry>
    </section>
    <section><h2>수상과 활동</h2><ul className="milestones">
      <li><span>2023</span><div>데이터 청년 캠퍼스 경험으로 ICT 이노베이션 동북권 우수사례 인터뷰에 참여했습니다.</div></li>
      <li><span>2022.10</span><div><a href="/projects/insurance-claims">자동차보험 청구 분석</a>으로 심사평가원장상, <a href="/projects/welfare-search">복지 정책 검색 서비스</a>로 지역 문제 해결 해커톤 최우수상을 받았습니다.</div></li>
      <li><span>2021</span><div>학과 홍보영상 공모전에서 학과 1위를 했고, ICT 멘토링에서는 자율주행 주차 로봇 개발과 프로그래밍에 참여했습니다.</div></li>
    </ul></section>
    <section><h2>사용해 본 도구</h2><dl className="skill-pairs">
      <dt>이용 기록 수집·분석</dt><dd>Google Analytics 4로 방문자의 행동을 기록하고, SQL과 BigQuery로 원하는 기록을 찾아 분석합니다.</dd>
      <dt>보고서 만들기</dt><dd>Excel 함수로 수치를 정리하고 Looker Studio로 차트와 보고서 화면을 만듭니다.</dd>
      <dt>프로그램·영상 제작</dt><dd>Python으로 데이터를 다루고 Java로 안드로이드 앱을 개발합니다. 간단한 영상 편집과 자막 수정도 할 수 있습니다.</dd>
    </dl></section><div className="source-line"><Source/></div>
  </article>;
}

export function ProjectsPage() {
  return <section className="portfolio-page projects-page"><div className="portfolio-heading"><p className="profile-discipline">조창헌 포트폴리오</p><h1>프로젝트</h1><p>회사와 학교에서 어떤 문제를 만났고, 무엇을 만들었는지 담았습니다.</p></div><ProjectCards items={projects}/></section>;
}

export function ProjectPage({project}:{project:Project}) {
  return <article className="portfolio-page case-page">
    <a className="back-to-works" href="/projects">← 프로젝트 목록</a>
    <div className="portfolio-heading"><p className="profile-discipline">{project.context}</p><h1>{project.title}</h1>
      <p className="case-period">{project.period}</p><p className="case-summary">{project.summary}</p></div>
    {project.story.map(([label,body])=><section className="case-section" key={label}><h2>{label}</h2><p>{body}</p></section>)}
    {project.tools && <div className="case-tools"><strong>사용한 도구</strong> {project.tools.join(" · ")}</div>}
    <div className="source-line">{project.video && <a href={project.video}>영남대학교 유튜브에서 영상 보기 ↗</a>}<Source href={project.source}>이 작업의 노션 원문</Source></div>
  </article>;
}
