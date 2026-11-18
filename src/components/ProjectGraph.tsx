import {useEffect,useMemo,useState} from "react";
import {ReactFlow,Background,Controls,MarkerType,Position} from "@xyflow/react";
import {projectGroups,type ProjectRecord} from "../project-graph";
import "./project-graph.css";
export default function ProjectGraph({records}:{records:ProjectRecord[]}){
 const projects=useMemo(()=>projectGroups(records),[records]);
 const [project,setProject]=useState(new URLSearchParams(location.search).get("project")||"");
 const [selected,setSelected]=useState(""),[limit,setLimit]=useState(12);
 useEffect(()=>{const pop=()=>{setProject(new URLSearchParams(location.search).get("project")||"");setSelected("");};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);},[]);
 const active=projects.find(p=>p.name===project),group=active?.groups.find(g=>g.id===selected);
 const chooseProject=(name:string)=>{setProject(name);setSelected("");setLimit(12);const url=new URL(location.href);if(name)url.searchParams.set("project",name);else url.searchParams.delete("project");history.pushState({},"",url);};
 const chooseGroup=(id:string)=>{setSelected(id);setLimit(12);};
 const graph=useMemo(()=>{
  if(!active)return {nodes:projects.map((p,i)=>({id:"project-"+i,position:{x:(i%3)*310,y:Math.floor(i/3)*175},
   data:{label:<div className="project-node"><small>프로젝트</small><strong>{p.name}</strong><span>메인 {p.groups.filter(g=>g.mode==="main").length} · 서브 {p.groups.filter(g=>g.mode==="subagent").length} · 기록 {p.groups.reduce((n,g)=>n+g.records.length,0)}개</span></div>},
   style:{width:260,borderRadius:16,border:"2px solid #2b6f62",background:"#f4faf8"},ariaLabel:p.name})),edges:[]};
  const nodes:any[]=[{id:"project",sourcePosition:Position.Right,targetPosition:Position.Left,position:{x:0,y:0},data:{label:<div className="project-node"><small>프로젝트</small><strong>{active.name}</strong><span>메인 작업과 하위 작업</span></div>},style:{width:240,borderRadius:16,border:"2px solid #2b6f62",background:"#edf7f3"},ariaLabel:active.name}];
  const edges:any[]=[],placed=new Set<string>();let row=0;
  const groups=active.groups;
  function place(id:string,depth:number,parent:string){
   const g=groups.find(x=>x.id===id);if(!g||placed.has(id))return;placed.add(id);
   const y=row++*150;
   nodes.push({id,sourcePosition:Position.Right,targetPosition:Position.Left,position:{x:310+depth*310,y},data:{label:<div className="project-node"><small>{g.mode==="subagent"?"서브 작업":"메인 작업"}</small><strong>{g.mode==="subagent"?(g.role||g.title):g.title}</strong><span>{g.records.length}개 기록{g.records.some(r=>r.capture?.status==="interrupted")?" · 중단 기록 포함":""}</span></div>},
    style:{width:260,borderRadius:14,border:(selected===id?"3px":"1px")+" solid "+(g.mode==="subagent"?"#8d73bc":"#5e8190"),background:g.mode==="subagent"?"#f8f5fc":"#fff"},ariaLabel:g.title});
   edges.push({id:parent+"-"+id,source:parent,target:id,label:g.mode==="subagent"?"하위 작업":"메인 작업",markerEnd:{type:MarkerType.ArrowClosed},style:{stroke:g.mode==="subagent"?"#9b88b8":"#759689"}});
   groups.filter(x=>x.parentId===id).forEach(child=>place(child.id,depth+1,id));
  }
  groups.filter(g=>g.mode==="main").forEach(g=>place(g.id,0,"project"));
  // Retain orphaned children visibly as subordinate work; never relabel them main.
  groups.filter(g=>!placed.has(g.id)).forEach(g=>place(g.id,1,"project"));
  return {nodes,edges};
 },[projects,active,selected]);
 const total=records.length;
 return <div className="project-map">
  <div className="project-map-heading"><div><h2>{active?active.name:"프로젝트별로 모아 보기"}</h2><p>{active?"메인 작업에서 어떤 일을 나누어 맡겼는지 볼 수 있어요. 상자를 누르면 질문과 답변 목록이 나옵니다.":"프로젝트를 고르면 메인 작업과 이를 도운 서브 작업이 펼쳐집니다."}</p></div><span>{projects.length}개 프로젝트 · {total}개 기록</span></div>
  <div className="project-map-toolbar"><button onClick={()=>chooseProject("")} disabled={!project}>← 모든 프로젝트</button><label>프로젝트<select aria-label="프로젝트" value={active?.name||""} onChange={e=>chooseProject(e.target.value)}><option value="">모든 프로젝트</option>{projects.map(p=><option key={p.name}>{p.name}</option>)}</select></label><a href="/workspace">기록 작성·수정 →</a></div>
  {!projects.length?<p className="panel">아직 기록이 없습니다. 작업을 저장하면 프로젝트별로 모입니다.</p>:<div className="project-map-layout" style={{"--project-map-height":String(active?Math.min(1100,Math.max(640,active.groups.length*110)):640)+"px"} as React.CSSProperties}>
   <div className="project-map-canvas" aria-label="프로젝트와 메인·서브 작업 연결 지도"><ReactFlow key={active?.name||"overview"} nodes={graph.nodes} edges={graph.edges} fitView fitViewOptions={{padding:0.22,maxZoom:1}} minZoom={0.1} nodesDraggable={false} nodesConnectable={false}
    onNodeClick={(_,node)=>{if(!active)chooseProject(projects[Number(node.id.replace("project-",""))].name);else if(node.id!=="project")chooseGroup(node.id);}}><Background color="#dce5e1"/><Controls showInteractive={false}/></ReactFlow></div>
   <aside className="project-map-details">
    {group?<><span className={"work-role "+group.mode}>{group.mode==="subagent"?"메인 작업을 돕는 서브 작업":"메인 작업"}</span><h3>{group.title}</h3>{group.mode==="subagent"&&<p>맡은 역할: {group.role||"지정받은 하위 작업"}<br/>연결된 메인 작업: {active?.groups.find(g=>g.id===group.parentId)?.title||"다른 프로젝트 또는 아직 기록되지 않은 메인 작업"}</p>}
     <p>질문 → 상세내용 → 정리 순서로 읽을 수 있어요.</p>
     <ol className="work-records">{group.records.slice(0,limit).map(r=><li key={r.id}><a href={r.capture?"/workspace/pages/"+r.id:"/admin/records/"+r.id+"/edit"}><small>{r.capture?new Date(r.capture.created).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"직접 등록한 기록"}</small><strong>{r.title.replace(/^\d{4}-\d\d-\d\d · /,"")}</strong><span>{r.summary}</span></a></li>)}</ol>
     {limit<group.records.length&&<button onClick={()=>setLimit(limit+12)}>이전 기록 더 보기</button>}
    </>:<><h3>{active?"메인 작업이나 서브 작업을 골라 보세요":"어느 프로젝트를 볼까요?"}</h3><p>메인 작업은 요청을 맡아 진행한 일이고, 서브 작업은 그중 일부를 나누어 맡은 일입니다.</p>
     <div className="project-picks">{active?active.groups.map(g=><button key={g.id} onClick={()=>chooseGroup(g.id)}><small>{g.mode==="subagent"?"↳ 서브":"메인"} · {g.records.length}개 기록</small>{g.title}</button>):projects.map(p=><button key={p.name} onClick={()=>chooseProject(p.name)}>{p.name}<small>{p.groups.length}개 작업 묶음</small></button>)}</div>
    </>}
   </aside>
  </div>}
  <p className="project-map-footnote">연결선은 일을 나누어 맡긴 관계를 보여줍니다. 완료 여부와 확인한 결과는 각 기록에서 확인하세요. 프로젝트 이름은 기록 화면에서 바꿀 수 있습니다.</p>
 </div>;
}
