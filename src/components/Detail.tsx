import ReactMarkdown from "react-markdown";
import Graph from "./Graph";
import Links from "./Links";
import {recordPath} from "../lib/routes";
import {typeName,roleName} from "../copy";
const relationshipWords:Record<string,string>={uses:"이 작업에 사용한 것",extends:"바탕이 된 방법",tests:"잘 되는지 확인한 대상",produces:"이 작업으로 만든 것",related:"함께 보면 좋은 것"};
export default function Detail({record:r,preview=false}:{record:any;preview?:boolean}){
 const images=r.visibility.images?(r.assets||[]).filter((a:any)=>typeof a==="object"&&a.mime?.startsWith("image/")):[];
 const files=(r.assets||[]).filter((a:any)=>typeof a==="object");
 const story=(key:string,title:string)=>r.visibility.description&&r[key]?<section key={key}><h2>{title}</h2><ReactMarkdown>{r[key]}</ReactMarkdown></section>:null;
 return <article className="detail plain-detail">
 {preview&&<div className="notice">다른 사람에게 이렇게 보여요 · 아직 공개하지 않았습니다</div>}
 {r.example&&<div className="notice">읽는 방법을 설명하기 위한 가상 예시입니다. 실제로 만든 결과나 확인한 성과가 아닙니다.</div>}
 <span className="tag">{typeName(r.type)}</span><h1>{r.title}</h1>
 {r.visibility.description&&r.summary&&<div className="detail-lead"><ReactMarkdown>{r.summary}</ReactMarkdown></div>}
 {(images.length>0||(r.visibility.description&&r.links)||(r.visibility.downloads&&files.length>0))&&<section className="results-first"><h2>완성한 것부터 보세요</h2>
 {images.map((a:any)=><figure key={a.id}><img className="artifact" src={"/api/images/"+a.id} alt={a.name}/><figcaption>{a.name}</figcaption></figure>)}
 {r.visibility.description&&r.links&&<Links value={r.links}/>}
 {r.visibility.downloads&&files.map((a:any)=><a className="external" key={a.id} href={"/api/files/"+a.id}>{a.name} 내려받기 ↓</a>)}
 </section>}
 {story("problem","왜 만들었나요?")}
 {r.visibility.description&&(r.humanRole||r.aiRole)&&<div className="contribution-grid">{story("humanRole","내가 직접 한 일")}{story("aiRole","AI가 도와준 일")}</div>}
 {story("design","이렇게 만들었어요")}
 {story("validation","정말 되는지 이렇게 확인했어요")}
 {story("limits","아직 아쉬운 점")}
 {r.visibility.graph&&r.relationships?.length>0&&<section><h2>이 작업과 이어지는 것들</h2>{r.relationships.map((x:any,i:number)=><div className="related-work" key={i}><small>{relationshipWords[x.kind]||"관련 작업"}{x.evidence==="proposed"?" · 아직 확인이 필요해요":""}</small><a href={recordPath(x.targetId)}>{x.title||"작업 소개 읽기"} →</a>{x.note&&<p>{x.note}</p>}{x.targetVersion&&<details><summary>당시 쓴 내용 보기</summary><p>{x.targetVersion}번째 공개한 내용을 가리킵니다. 링크에서는 현재 공개된 글을 볼 수 있습니다.</p></details>}</div>)}<a href="/atlas">다른 작업과의 연결도 보기 →</a></section>}
 {story("related","함께 보면 좋은 작업")}
 {r.visibility.graph&&(r.nodes.length>0||r.files.length>0||r.runs.length>0)&&<details className="detail-drawer technical-details"><summary>만드는 순서와 사용한 파일 자세히 보기</summary>
 <p>위 설명보다 더 자세히 살펴보고 싶을 때 보는 자료입니다. 순서를 그려 둔 것과 실제로 실행해 본 것은 구분해서 표시합니다.</p>
 {r.nodes.length>0&&<section><h2>일이 진행되는 순서</h2><p className="muted">각 상자를 누르면 그 단계에서 하는 일을 볼 수 있어요.</p><Graph nodes={r.nodes} edges={r.edges}/></section>}
 {r.files.length>0&&<details className="detail-drawer"><summary>사용한 파일과 각 파일의 역할</summary><Graph nodes={r.files} edges={r.fileEdges}/></details>}
 {r.runs.length>0&&<details className="detail-drawer"><summary>실제로 실행해 본 기록</summary><p>언제 어떤 내용을 사용했고, 어떤 결과가 나왔는지 적은 기록입니다.</p>{r.runs.map((run:any,i:number)=><div className="panel" key={i}><b>{run.date}</b><p>{run.result}</p><p>확인한 자료: {run.evidence}</p>{run.references?.map((ref:any,j:number)=><p key={j}><a href={recordPath(ref.recordId)}>{ref.title||roleName(ref.role)}</a> · {ref.version}번째 공개한 내용</p>)}</div>)}</details>}
 </details>}
 {r.visibility.description&&(r.source||r.relations?.length>0)&&<details className="detail-drawer"><summary>참고한 자료와 사용한 내용 자세히 보기</summary><p>제작 구분: {r.origin}</p>{r.source&&<ReactMarkdown>{r.source}</ReactMarkdown>}{r.relations?.map((ref:any,i:number)=><p key={i}><a href={recordPath(ref.recordId)}>{ref.title||"함께 본 작업"}</a> · {roleName(ref.role)} · {ref.version}번째 공개한 내용<br/>{ref.note}</p>)}</details>}
 </article>;
}
