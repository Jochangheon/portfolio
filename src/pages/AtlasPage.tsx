import {useEffect,useMemo,useState} from "react";
import {ReactFlow,Background,Controls,MarkerType} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {typeName} from "../copy";
import {api} from "../lib/api";
import {editorPath,recordPath} from "../lib/routes";
import {relationshipLabels} from "../model";
type ANode={id:string;title:string;type:string;summary:string;origin:string;status:string;version:number};
type AEdge={id:string;source:string;target:string;kind:string;evidence:string;note:string;version?:number;run?:string};
type Atlas={nodes:ANode[];edges:AEdge[]};
const colors:Record<string,string>={"프로젝트":"#2b6f62","스킬·워크플로":"#725dc0","실험 노트":"#b9712d"};
const evidence=(s:string)=>s==="execution"?"실제로 해 본 기록이 있어요":s==="confirmed"?"이 연결을 확인했어요":"아직 확인이 필요해요";
const statusName=(s:string)=>s==="공개"?"다른 사람도 볼 수 있어요":s==="예시"?"설명용 예시":s.includes("게시됨")?"공개한 글을 고치는 중":"나만 보는 글";
const label=(k:string)=>(relationshipLabels as any)[k]||k;
const demo:Atlas={nodes:[
 {id:"p",title:"긴 글 정리 도구",type:"프로젝트",summary:"긴 글을 넣으면 중요한 내용만 짧게 보여주는 도구를 가정한 예시입니다. 실제 작업이 아닙니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"s",title:"세 줄로 정리하는 지침",type:"스킬·워크플로",summary:"AI에게 중요한 내용을 세 줄로 적으라고 시키는 방법을 가정했습니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"e",title:"중요한 내용이 빠지는지 확인",type:"실험 노트",summary:"짧게 줄인 글에서 날짜와 준비물이 빠지지 않는지 확인하는 상황입니다.",origin:"설명용 예시",status:"예시",version:0},
 {id:"s2",title:"준비물도 챙기는 지침",type:"스킬·워크플로",summary:"원래 지침에 준비물을 꼭 넣으라는 말을 추가한 상황입니다.",origin:"설명용 예시",status:"예시",version:0}],
 edges:[{id:"a",source:"p",target:"s",kind:"uses",evidence:"confirmed",note:"긴 글 정리 도구에 세 줄로 정리하는 지침을 넣는다는 뜻입니다. 설명용 예시이며 실제로 실행한 기록은 아닙니다."},
 {id:"b",source:"e",target:"s",kind:"tests",evidence:"proposed",note:"이 지침을 쓰면 중요한 내용이 빠지는지 확인해 보자는 뜻입니다. 아직 확인하지 않은 연결은 점선으로 표시합니다."},
 {id:"c",source:"s2",target:"s",kind:"extends",evidence:"confirmed",note:"세 줄로 정리하라는 지침을 바탕으로, 준비물도 꼭 넣도록 바꿨다는 뜻입니다."}]};
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
 const nodes=visible.map(n=>({id:n.id,position:pos.get(n.id)!,data:{label:<div className="atlas-node"><small style={{color:colors[n.type]}}>{typeName(n.type)}</small><strong>{n.title}</strong><span>{statusName(n.status)}</span></div>},style:{width:235,borderColor:colors[n.type],borderWidth:selected===n.id?3:1,opacity:matches(n)?1:0.22,borderRadius:14,background:"#fff"},ariaLabel:n.title,selected:selected===n.id}));
 const edges=visibleEdges.map(e=>({...e,label:label(e.kind),type:"default",style:{stroke:e.evidence==="proposed"?"#8e97a8":"#54677f",strokeWidth:edgeId===e.id?3:1.5,strokeDasharray:e.evidence==="proposed"?"6 5":undefined},markerEnd:{type:MarkerType.ArrowClosed,color:"#63748b"},interactionWidth:28,ariaLabel:label(e.kind)+" 관계",labelStyle:{fontSize:11},labelBgPadding:[6,4] as [number,number]}));
 const pick=(id:string)=>{setSelected(id);setEdgeId("");};
 return <section className="atlas-page">
 <div className="section-title"><div><span className="eyebrow">작업을 연결해서 보기</span><h1>{admin?"내 작업은 이렇게 이어져요":"작업은 이렇게 이어져요"}</h1><p>어떤 것을 만들 때 어떤 AI 사용법을 썼는지 선으로 이어 봤어요. 작업 이름을 누르면 소개를 볼 수 있습니다.</p></div><a className="button" href={admin?"/admin":"/records"}>{admin?"내 글 관리":"작업 목록"} →</a></div>
 {admin&&<p className="notice">여기에는 나만 보는 글도 나옵니다. 다른 사람에게는 공개한 작업과 공개하기로 고른 연결만 보여요.</p>}
 {error?<div className="panel" role="alert"><p>{error}</p>{admin&&<a className="button primary" href="/admin">관리자 로그인</a>}<button onClick={()=>location.reload()}>다시 시도</button></div>:!data?<p role="status">작업의 연결을 불러오는 중…</p>:<>
 <div className="atlas-toolbar"><label>제목으로 찾기<input type="search" placeholder="궁금한 작업 이름" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <label>종류<select aria-label="작업 종류" value={type} onChange={e=>setType(e.target.value)}>{["전체",...Object.keys(colors)].map(t=><option key={t} value={t}>{typeName(t)}</option>)}</select></label>
 <label className="check"><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)} disabled={!selected}/>이 작업과 이어진 것만</label>
 <button onClick={()=>{setQuery("");setType("전체");setSelected("");setEdgeId("");setFocus(false);}}>전체 보기</button></div>
 <div className="atlas-legend">{Object.entries(colors).map(([t,color])=><span key={t}><i style={{background:color}}/>{typeName(t)}</span>)}<span>― 확인한 연결</span><span>┄ 아직 확인 전</span><span>{source.nodes.length}개 작업 · {source.edges.length}개 연결</span></div>
 {example&&<div className="notice">연결 그림을 설명하는 가상 예시입니다. 실제로 만들거나 써 본 작업이 아닙니다. <button onClick={()=>{setExample(false);setSelected("");setEdgeId("");}}>내 작업으로 돌아가기</button></div>}
 {!source.nodes.length?<div className="atlas-empty panel"><span className="eyebrow">작업이 모이면 연결도 보여요</span><h2>{admin?"함께 쓴 작업을 연결해 보세요":"공개한 작업이 모이면 여기서 이어 볼 수 있어요"}</h2><p>{admin?"글을 고칠 때 ‘만드는 방법’에서 함께 쓴 AI 사용법이나 확인해 본 글을 골라 주세요.":"어떤 작업에 어떤 방법을 썼는지 알아볼 수 있는 그림입니다. 아래 예시로 모양을 먼저 살펴볼 수 있어요."}</p><button className="primary" onClick={()=>setExample(true)}>연결 그림 예시 보기</button>{admin&&<a href="/admin/records/new">새 글 쓰기 →</a>}</div>:
 <div className="atlas-workspace">
 <div className="atlas-canvas" aria-label="작업과 사용한 방법을 이어 놓은 그림"><ReactFlow key={type+"-"+focus+"-"+example+"-"+viewportWidth} nodes={nodes} edges={edges} fitView fitViewOptions={{padding:0.25,minZoom:0.15,maxZoom:1.2}} minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_,n)=>pick(n.id)} onEdgeClick={(_,e)=>{setEdgeId(e.id);setSelected("");}} onPaneClick={()=>{setSelected("");setEdgeId("");}}><Background gap={22} color="#d8dfdf"/><Controls showInteractive={false}/></ReactFlow></div>
 <aside className="atlas-inspector" aria-live="polite">
 {edge?<><span className="eyebrow">두 작업이 이어지는 이유</span><h2>{label(edge.kind)}</h2><p>{source.nodes.find(n=>n.id===edge.source)?.title} → {source.nodes.find(n=>n.id===edge.target)?.title}</p><span className="atlas-badge">{evidence(edge.evidence)}</span><p>{edge.note||"왜 이어지는지 아직 적지 않았어요."}</p><details className="atlas-meta"><summary>당시에 쓴 내용 확인하기</summary><p>{edge.version?"당시에 공개한 내용: "+edge.version:"어느 때의 내용인지는 따로 지정하지 않았어요."}</p>{edge.run&&<p>직접 해 본 날짜: {edge.run}</p>}</details><button onClick={()=>pick(edge.target)}>이어진 작업 살펴보기</button></>:
 node?<><span className="eyebrow">{typeName(node.type)}</span><h2>{node.title}</h2><span className="atlas-badge">{statusName(node.status)}</span><p>{node.summary||"아직 설명을 적지 않았거나, 나만 보도록 해 두었어요."}</p><details className="atlas-meta"><summary>참고 자료와 이전 내용</summary><p>{node.origin}{node.version?" · "+node.version+"번째 공개한 내용":" · 아직 공개하지 않았어요"}</p></details>{!example&&<a className="button primary" href={admin?editorPath(node.id):recordPath(node.id)}>{admin?"글 고치기":"어떤 작업인지 읽기"} →</a>}<h3>함께 보면 좋은 작업</h3>{source.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=><button className="atlas-connection" key={e.id} onClick={()=>{setEdgeId(e.id);setSelected("");}}><small>{e.source===node.id?"→":"←"} {label(e.kind)} · {evidence(e.evidence)}</small>{source.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source))?.title}</button>)}</>:
 <><span className="eyebrow">상자를 눌러 보세요</span><h2>궁금한 작업 하나를 골라 보세요.</h2><p>작업 이름을 누르면 무엇을 만든 것인지 설명이 나옵니다. 선을 누르면 두 작업이 왜 이어지는지 볼 수 있어요.</p><p className="muted">실선은 확인한 연결, 점선은 아직 확인이 필요한 연결입니다. 연결해 놓았다고 해서 실제로 실행해 봤다는 뜻은 아니에요.</p></>}
 </aside></div>}
 <details className="atlas-list" open={!!query}><summary>제목 목록에서 고르기 · {visible.filter(matches).length}개</summary><div>{visible.filter(matches).map(n=><button key={n.id} onClick={()=>pick(n.id)} aria-pressed={selected===n.id}><span style={{color:colors[n.type]}}>{typeName(n.type)}</span>{n.title}</button>)}</div>{!visible.filter(matches).length&&<p>검색 결과가 없습니다.</p>}</details>
 </>}
 </section>;
}
