import { categories, recordPath } from "../lib/routes";
export function RecordCards({ records }: { records: any[] }) {
 return <div className="cards">{records.map((r, i) => <a className="card" key={r.id} href={recordPath(r.id)}>
   <div className={"card-art art-" + (i % 3)}><span>{r.type === "프로젝트" ? "↗" : r.type === "실험 노트" ? "⌘" : "⤳"}</span><small>{r.example ? "EXAMPLE" : "AI RECORD"} / {String(i+1).padStart(2,"0")}</small></div>
   <div className="card-body"><span className="tag">{r.type}{r.example ? " · 예시" : ""}</span><h3>{r.title} ↗</h3><p>{r.summary}</p></div>
 </a>)}</div>;
}
export function ExampleLink() { return <a className="example-card" href="/examples/workflow">
  <div><span className="tag">기능 예시 · 실제 성과 아님</span><h3>이벤트 정의서 검토 흐름</h3><p>분기와 재검토를 포함한 구조도를 미리 살펴보세요.</p></div>
  <div className="mini-flow"><span>정의서</span> → <span>검토</span> → <span>판단</span> ↗</div>
 </a>; }
export default function RecordsPage({ records, category }: { records: any[]; category: string }) {
 const filtered = records.filter(r => category === "전체" || r.type === category);
 return <section id="records">
  <div className="section-title"><div><span className="eyebrow">AI ARCHIVE</span><h1>{category === "전체" ? "AI 활용 기록" : category} <span className="count">{filtered.length.toString().padStart(2,"0")}</span></h1></div>
  <p className="muted">문제에서 시작해, 검증까지 이어지는 기록</p></div>
  <nav className="filters" aria-label="기록 분류">{categories.map(c => <a key={c.path} href={c.path} className={category===c.label ? "active" : ""} aria-current={category===c.label ? "page" : undefined}>{c.label}</a>)}</nav>
  <RecordCards records={filtered}/>
  {!filtered.length && <div className="empty"><span>{records.length ? "이 분류에는 아직 공개 기록이 없습니다." : "아직 첫 기록을 준비하고 있습니다."}</span><p>게시한 작업만 이곳에 표시됩니다.</p></div>}
  <ExampleLink/>
 </section>;
}
