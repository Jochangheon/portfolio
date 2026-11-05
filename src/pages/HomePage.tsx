import {RecordCards} from "./RecordsPage";
import Links from "../components/Links";
import {typeName,typeDescriptions} from "../copy";
import {categories} from "../lib/routes";
export default function HomePage({records,profile}:{records:any[];profile:any}){
 const works=records.filter(r=>!r.example);
 return <>
 <section className="plain-hero">
  <div><span className="eyebrow">조창헌의 작업실</span><h1>AI로 만든 웹사이트와<br/>도구를 소개합니다.</h1>
  <p className="lead">무엇이 필요해서 만들었는지, 내가 어떤 일을 했는지,<br className="desktop-break"/> 실제로 어떻게 쓰는지 함께 보여드립니다.</p>
  {profile.intro&&profile.intro!=="AI로 문제를 풀고, 선택과 검증의 과정을 기록합니다."&&<p className="personal-intro">{profile.intro}</p>}
  <div className="hero-actions"><a className="button primary" href="/records">작업 보러 가기 →</a><a href="/approach">이곳에는 어떤 내용이 있나요?</a></div></div>
  <aside className="reading-card"><span className="tag">작업 하나를 읽으면</span><h2>세 가지만 먼저 보세요.</h2>
   <ol><li><strong>무엇을 만들었는지</strong><span>완성한 것과 쓰는 방법</span></li><li><strong>왜 필요했는지</strong><span>해결하고 싶었던 불편함</span></li><li><strong>내가 무엇을 했는지</strong><span>내 선택과 AI가 도와준 부분</span></li></ol>
  </aside>
 </section>
 <section className="work-showcase"><div className="section-title"><div><span className="eyebrow">직접 만든 것부터 살펴보세요</span><h2>최근에 만든 것과 배운 것</h2></div>{works.length>0&&<a href="/records">모두 보기 →</a>}</div>
 {works.length?<RecordCards records={works.slice(-3).reverse()}/>:<div className="empty plain-empty"><h3>공개할 작업을 정리하고 있어요.</h3><p>완성한 모습과 만드는 과정을 함께 볼 수 있도록 준비하고 있습니다.</p></div>}
 </section>
 <section className="browse-kinds"><h2>이런 내용을 모읍니다.</h2><div className="kind-cards">{categories.slice(1).map((x,i)=><a href={x.path} key={x.path}><span className="kind-number">0{i+1}</span><h3>{typeName(x.label)} →</h3><p>{typeDescriptions[x.label]}</p></a>)}</div></section>
 {(profile.contact||profile.links)&&<section className="contact"><h2>연락하고 싶다면</h2><p>{profile.contact}</p><Links value={profile.links||""}/></section>}
 </>;
}
