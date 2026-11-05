import {ExampleLink} from "./RecordsPage";
export default function ApproachPage(){return <section className="plain-guide">
 <span className="eyebrow">이 사이트를 소개합니다</span><h1>만든 것을 보여주고,<br/>다음에 다시 쓸 방법을 남깁니다.</h1>
 <p className="lead">방문자에게는 제가 어떤 일을 할 수 있는지 보여주는 곳입니다.<br/>저에게는 했던 일을 잊지 않고 다시 꺼내 쓰는 작업 노트입니다.</p>
 <div className="guide-steps">
 {[
 ["1","완성한 것을 먼저 보여드려요","무엇을 만들었고 어디에 쓰는지 설명합니다. 볼 수 있는 웹사이트나 결과 파일이 있으면 함께 올립니다."],
 ["2","왜 만들었는지 이야기해요","처음에 무엇이 불편했는지, 누구에게 도움이 되기를 바랐는지 적습니다."],
 ["3","내가 한 일과 AI가 한 일을 나눠요","목표를 정하고 결과를 고른 일, AI에게 맡긴 일을 구분해 적습니다."],
 ["4","직접 써 본 결과를 남겨요","실제로 되는지 확인한 방법을 적습니다. 안 되는 점이나 고칠 부분도 함께 남깁니다."]
 ].map(([n,t,p])=><div key={n}><span>{n}</span><div><h2>{t}</h2><p>{p}</p></div></div>)}</div>
 <aside className="guide-definition"><h2>‘AI 사용법’은 무엇인가요?</h2><p>AI에게 일을 시킬 때 필요한 설명서입니다. “긴 글을 읽고 중요한 내용을 세 줄로 정리해 줘”처럼 시킬 일과 지켜야 할 기준을 적어 둡니다. 잘 만들어 두면 다음에도 꺼내 쓸 수 있어요.</p><p>이런 설명서를 <strong>스킬</strong>이라고 부르기도 합니다. 여러 일을 차례대로 하도록 묶은 방법도 이곳에 함께 모읍니다.</p></aside>
 <details className="detail-drawer"><summary>글이 어떻게 생겼는지 예시로 보기</summary><p>아래 글은 읽는 방법을 설명하기 위한 가상 예시입니다. 실제 작업이나 성과로 소개하지 않습니다.</p><ExampleLink/></details>
 </section>;}
