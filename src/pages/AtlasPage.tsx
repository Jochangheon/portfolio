import {useEffect,useMemo,useState} from "react";
import {ReactFlow,Background,Controls,MarkerType} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {api} from "../lib/api";
import {editorPath,recordPath} from "../lib/routes";
import {relationshipLabels} from "../model";
type ANode={id:string;title:string;type:string;summary:string;origin:string;status:string;version:number};
type AEdge={id:string;source:string;target:string;kind:string;evidence:string;note:string;version?:number;run?:string};
type Atlas={nodes:ANode[];edges:AEdge[]};
const colors:Record<string,string>={"프로젝트":"#2b6f62","스킬·워크플로":"#725dc0","실험 노트":"#b9712d"};
const evidence=(s:string)=>s==="execution"?"실행 근거 있음":s==="confirmed"?"연결 근거 확인":"제안 · 확인 필요";
const label=(k:string)=>(relationshipLabels as any)[k]||k;
const demo:Atlas={nodes:[
 {id:"p",title:"예시 프로젝트",type:"프로젝트",summary:"관계 지도를 설명하기 위한 가상 예시입니다. 실제 작업 기록이 아닙니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"s",title:"예시 검토 스킬",type:"스킬·워크플로",summary:"프로젝트에서 사용하는 작업 방식을 나타냅니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"e",title:"예시 비교 실험",type:"실험 노트",summary:"스킬의 한계를 살펴보는 실험을 나타냅니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"s2",title:"예시 수정 스킬",type:"스킬·워크플로",summary:"기존 스킬을 확장하는 관계를 나타냅니다.",origin:"설명용 예시",status:"예시",version:0}],
 edges:[{id:"a",source:"p",target:"s",kind:"uses",evidence:"confirmed",note:"프로젝트가 검토 스킬을 사용하도록 설계한 관계의 예시입니다. 실제 실행을 의미하지 않습니다."},
 {id:"b",source:"e",target:"s",kind:"tests",evidence:"proposed",note:"검증할 대상으로 제안된 관계입니다."},
 {id:"c",source:"s2",target:"s",kind:"extends",evidence:"confirmed",note:"기존 스킬을 확장한 관계를 설명합니다."}]};
function positions(nodes:ANode[],edges:AEdge[]){
 const points=nodes.map((n,i)=>({id:n.id,x:Math.cos(i*2.399)*Math.sqrt(i+1)*210,y:Math.sin(i*2.399)*Math.sqrt(i+1)*150}));
 // Deterministic layout: no external graph service or uploaded code execution.
 if(nodes.length<=250)for(let k=0;k<80;k++){
  const force=points.map(()=>({x:0,y:0}));
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const dx=points[i].x-points[j].x,dy=points[i].y-points[j].y,dist=Math.max(30,Math.hypot(dx,dy));
   const push=28000/(dist*dist);force[i].x+=dx/dist*push;force[i].y+=dy/dist*push;force[j].x-=dx/dist*push;force[j].y-=dy/dist*push;
  }
  for(const e of edges){const i=points.findIndex(p=>p.id===e.source),j=points.findIndex(p=>p.id===e.target);if(i<0||j<0)continue;
   const dx=points[j].x-points[i].x,dy=points[j].y-points[i].y,dist=Math.max(1,Math.hypot(dx,dy)),pull=(dist-330)*0.015;
   force[i].x+=dx/dist*pull;force[i].y+=dy/dist*pull;force[j].x-=dx/dist*pull;force[j].y-=dy/dist*pull;
  }
  points.forEach((p,i)=>{p.x+=Math.max(-8,Math.min(8,force[i].x));p.y+=Math.max(-8,Math.min(8,force[i].y));});
 }
 return new Map(points.map(p=>[p.id,{x:p.x,y:p.y}]));
}
export default function AtlasPage({admin=false}:{admin?:boolean}){
 const [viewportWidth,setViewportWidth]=useState(window.innerWidth);
 useEffect(()=>{let timer=0;const resize=()=>{clearTimeout(timer);timer=window.setTimeout(()=>setViewportWidth(window.innerWidth),100);};window.addEventListener("resize",resize);return()=>{window.removeEventListener("resize",resize);clearTimeout(timer);};},[]);
 const [data,setData]=useState<Atlas>(),[error,setError]=useState(""),[query,setQuery]=useState(""),[type,setType]=useState("전체"),[selected,setSelected]=useState(""),[edgeId,setEdgeId]=useState(""),[focus,setFocus]=useState(false),[example,setExample]=useState(false);
 useEffect(()=>{let active=true;api(admin?"/admin/atlas":"/atlas").then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[admin]);
 const source=example?demo:data||{nodes:[],edges:[]};
 const node=source.nodes.find(n=>n.id===selected),edge=source.edges.find(e=>e.id===edgeId);
 const connected=new Set([selected,...source.edges.filter(e=>e.source===selected||e.target===selected).flatMap(e=>[e.source,e.target])]);
 const visible=source.nodes.filter(n=>(type==="전체"||n.type===type)&&(!focus||!selected||connected.has(n.id)));
 const ids=new Set(visible.map(n=>n.id)),visibleEdges=source.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
 const pos=useMemo(()=>viewportWidth<800 ? new Map(source.nodes.map((n,i)=>[n.id,{x:(i%2)*40,y:i*180}])) : positions(source.nodes,source.edges),[source,viewportWidth]);
 const matches=(n:ANode)=>!query||n.title.toLowerCase().includes(query.toLowerCase());
 const nodes=visible.map(n=>({id:n.id,position:pos.get(n.id)!,data:{label:<div className="atlas-node"><small style={{color:colors[n.type]}}>{n.type}</small><strong>{n.title}</strong><span>{n.status}{n.version?" · v"+n.version:""}</span></div>},style:{width:235,borderColor:colors[n.type],borderWidth:selected===n.id?3:1,opacity:matches(n)?1:0.22,borderRadius:14,background:"#fff"},ariaLabel:n.title,selected:selected===n.id}));
 const edges=visibleEdges.map(e=>({...e,label:label(e.kind),type:"default",style:{stroke:e.evidence==="proposed"?"#8e97a8":"#54677f",strokeWidth:edgeId===e.id?3:1.5,strokeDasharray:e.evidence==="proposed"?"6 5":undefined},markerEnd:{type:MarkerType.ArrowClosed,color:"#63748b"},interactionWidth:28,ariaLabel:label(e.kind)+" 관계",labelStyle:{fontSize:11},labelBgPadding:[6,4] as [number,number]}));
 const pick=(id:string)=>{setSelected(id);setEdgeId("");};
 return <section className="atlas-page">
 <div className="section-title"><div><span className="eyebrow">CONNECTED WORK</span><h1>{admin?"내 AI 작업 관계 지도":"AI 작업 관계 지도"}</h1><p>스킬이 프로젝트로, 실험이 다음 개선으로 이어지는 과정을 탐색합니다.</p></div><a className="button" href={admin?"/admin":"/records"}>{admin?"기록 관리":"기록 목록"} →</a></div>
 {admin&&<p className="notice">비공개 초안이 포함된 관리자 지도입니다. 공개 지도에는 게시한 기록과 공개를 허용한 연결만 나타납니다.</p>}
 {error?<div className="panel" role="alert"><p>{error}</p>{admin&&<a className="button primary" href="/admin">관리자 로그인</a>}<button onClick={()=>location.reload()}>다시 시도</button></div>:!data?<p role="status">관계 지도를 불러오는 중…</p>:<>
 <div className="atlas-toolbar"><label>기록 찾기<input type="search" placeholder="스킬이나 프로젝트 이름" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <label>종류<select aria-label="기록 종류" value={type} onChange={e=>setType(e.target.value)}>{["전체",...Object.keys(colors)].map(t=><option key={t}>{t}</option>)}</select></label>
 <label className="check"><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)} disabled={!selected}/>선택한 기록 주변만</label>
 <button onClick={()=>{setQuery("");setType("전체");setSelected("");setEdgeId("");setFocus(false);}}>전체 보기</button></div>
 <div className="atlas-legend">{Object.entries(colors).map(([t,color])=><span key={t}><i style={{background:color}}/>{t}</span>)}<span>― 근거 확인</span><span>┄ 제안</span><span>{source.nodes.length}개 기록 · {source.edges.length}개 연결</span></div>
 {example&&<div className="notice">구조를 설명하기 위한 가상 예시입니다. 실제 기록·실행·성과가 아닙니다. <button onClick={()=>{setExample(false);setSelected("");setEdgeId("");}}>실제 기록 보기</button></div>}
 {!source.nodes.length?<div className="atlas-empty panel"><span className="eyebrow">A PLACE FOR CONNECTIONS</span><h2>{admin?"첫 연결을 만들어 보세요":"공개된 관계 지도를 준비하고 있습니다"}</h2><p>{admin?"기록의 ‘구조’ 단계에서 다른 스킬·프로젝트·실험을 연결하세요.":"게시한 기록이 모이면 스킬과 프로젝트의 연결이 이곳에 표시됩니다."}</p><button className="primary" onClick={()=>setExample(true)}>관계 지도 예시 살펴보기</button>{admin&&<a href="/admin/records/new">새 기록 작성 →</a>}</div>:
 <div className="atlas-workspace">
 <div className="atlas-canvas" aria-label="AI 기록 관계 그래프"><ReactFlow key={type+"-"+focus+"-"+example+"-"+viewportWidth} nodes={nodes} edges={edges} fitView fitViewOptions={{padding:0.25,minZoom:0.15,maxZoom:1.2}} minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_,n)=>pick(n.id)} onEdgeClick={(_,e)=>{setEdgeId(e.id);setSelected("");}} onPaneClick={()=>{setSelected("");setEdgeId("");}}><Background gap={22} color="#d8dfdf"/><Controls showInteractive={false}/></ReactFlow></div>
 <aside className="atlas-inspector" aria-live="polite">
 {edge?<><span className="eyebrow">RELATIONSHIP</span><h2>{label(edge.kind)}</h2><p>{source.nodes.find(n=>n.id===edge.source)?.title} → {source.nodes.find(n=>n.id===edge.target)?.title}</p><span className="atlas-badge">{evidence(edge.evidence)}</span><p>{edge.note||"연결 근거를 아직 작성하지 않았습니다."}</p><p>{edge.version?"대상 게시 버전 v"+edge.version:"특정 게시 버전을 지정하지 않은 관계"}</p>{edge.run&&<p>실행 확인일: {edge.run}</p>}<button onClick={()=>pick(edge.target)}>연결 대상 살펴보기</button></>:
 node?<><span className="eyebrow">{node.type}</span><h2>{node.title}</h2><span className="atlas-badge">{node.status}</span><p>{node.summary||"설명이 아직 없거나 비공개입니다."}</p><p className="muted">{node.origin}{node.version?" · 게시 v"+node.version:" · 게시 버전 없음"}</p>{!example&&<a className="button primary" href={admin?editorPath(node.id):recordPath(node.id)}>{admin?"기록 편집":"기록 자세히 보기"} →</a>}<h3>이어지는 기록</h3>{source.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=><button className="atlas-connection" key={e.id} onClick={()=>{setEdgeId(e.id);setSelected("");}}><small>{e.source===node.id?"→":"←"} {label(e.kind)} · {evidence(e.evidence)}</small>{source.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source))?.title}</button>)}</>:
 <><span className="eyebrow">EXPLORE CONNECTIONS</span><h2>하나의 기록에서 시작하세요</h2><p>점을 누르면 역할과 연결된 기록을, 선을 누르면 관계의 근거와 버전을 볼 수 있습니다.</p><p className="muted">연결 근거를 확인했다는 표시는 실제 실행을 뜻하지 않습니다. 실행 기록은 별도의 근거와 사용 버전을 갖습니다.</p></>}
 </aside></div>}
 <details className="atlas-list" open={!!query}><summary>목록으로 탐색 · {visible.filter(matches).length}개</summary><div>{visible.filter(matches).map(n=><button key={n.id} onClick={()=>pick(n.id)} aria-pressed={selected===n.id}><span style={{color:colors[n.type]}}>{n.type}</span>{n.title}</button>)}</div>{!visible.filter(matches).length&&<p>검색 결과가 없습니다.</p>}</details>
 </>}
 </section>;
}
