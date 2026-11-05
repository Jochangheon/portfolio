import { clientProjects } from "../goldenplanet";

const years = [...new Set(clientProjects.map(project => project.period.slice(0, 4)))];

export default function GoldenplanetPage() {
  return <article className="portfolio-page case-page client-history">
    <a className="back-to-works" href="/career">← 경력과 학력</a>
    <div className="portfolio-heading">
      <p className="profile-discipline">골든플래닛 · 2023.01.30 입사</p>
      <h1>고객사별 프로젝트</h1>
      <p>뉴스 독자가 거친 화면을 찾고, 쇼핑몰의 구매 기록을 점검하고, 부서별 보고서를 만들었습니다. 고객사와 진행한 {clientProjects.length}건을 시작일이 최근인 순서로 담았습니다.</p>
      <p className="case-period">2024년 11월 13일 기록 기준</p>
    </div>
    <nav className="history-years" aria-label="연도 바로가기">
      {years.map(year => <a key={year} href={"#year-" + year}>{year}년</a>)}
    </nav>
    {years.map(year => <section className="history-year" key={year} aria-labelledby={"year-" + year}>
      <h2 id={"year-" + year}>{year}년</h2>
      <ol className="client-timeline">
        {clientProjects.filter(project => project.period.startsWith(year)).map(project => <li key={project.client}>
          <div className="client-period"><span>{project.period}</span>
            {project.status && <small>{project.status}</small>}
          </div>
          <div className="client-work">
            <p className="client-name">고객사 · {project.client}</p>
            <h3>{project.title}</h3>
            <dl><dt>맡은 일</dt><dd>{project.role}</dd><dt>결과</dt><dd>{project.result}</dd></dl>
            {project.casePath && <a href={project.casePath}>보고서 제작 과정 보기 →</a>}
          </div>
        </li>)}
      </ol>
    </section>)}
  </article>;
}
