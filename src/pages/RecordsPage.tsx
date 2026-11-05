import {categories,recordPath} from "../lib/routes";
import {typeName,typeDescriptions,shortText} from "../copy";
export function RecordCards({records}:{records:any[]}){
 return <div className="cards plain-cards">{records.map(r=>{
  const picture=r.visibility?.images&&r.assets?.find((a:any)=>typeof a==="object"&&a.mime?.startsWith("image/"));
  return <a className="card" key={r.id} href={recordPath(r.id)}>
   {picture&&<img className="card-picture" src={"/api/images/"+picture.id} alt={picture.name} loading="lazy"/>}
   <div className="card-body"><span className="tag">{typeName(r.type)}{r.example?" · 설명용 예시":""}</span><h3>{r.title}</h3>
   <p className="card-summary">{shortText(r.summary||"자세한 소개를 살펴보세요.",160)}</p>
   {r.problem&&<div className="card-why"><span>왜 만들었나요?</span><p>{shortText(r.problem,95)}</p></div>}
   <span className="card-more">무엇을 만들었는지 보기 →</span></div>
  </a>;
 })}</div>;
}
export function ExampleLink(){return <a className="plain-example-link" href="/examples/workflow">설명용 예시 읽어보기: 긴 글을 짧게 정리하는 AI 사용법 →</a>;}
export default function RecordsPage({records,category}:{records:any[];category:string}){
 const filtered=records.filter(r=>!r.example&&(category==="전체"||r.type===category));
 return <section id="records"><div className="section-title"><div><span className="eyebrow">조창헌의 작업 모음</span><h1>{category==="전체"?"만든 것과 배운 것":typeName(category)}</h1><p className="page-intro">{category==="전체"?"제목을 누르면 무엇을 만들었는지, 왜 만들었는지, 어떻게 확인했는지 볼 수 있어요.":typeDescriptions[category]}</p></div></div>
 <nav className="filters" aria-label="작업 종류">{categories.map(x=><a key={x.path} href={x.path} className={category===x.label?"active":""} aria-current={category===x.label?"page":undefined}>{typeName(x.label)}</a>)}</nav>
 {filtered.length>0&&<p className="muted">{filtered.length}개의 작업을 볼 수 있어요.</p>}<RecordCards records={filtered}/>
 {!filtered.length&&<div className="empty plain-empty"><h2>공개할 작업을 정리하고 있어요.</h2><p>이곳에는 읽을 준비가 된 작업부터 차례로 올립니다.</p></div>}
 <div className="connection-invite"><div><h2>어떤 작업이 서로 이어질까요?</h2><p>웹사이트를 만들 때 쓴 AI 사용법, 그 방법을 시험해 본 글을 선으로 이어 볼 수 있어요.</p></div><a href="/atlas">작업 연결 보기 →</a></div>
 </section>;
}
