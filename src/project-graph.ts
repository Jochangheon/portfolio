export type CaptureInfo={threadId:string;rootThreadId:string;mode:"main"|"subagent";parentThreadId?:string;parentTurnId?:string;threadTitle:string;agentName?:string;agentRole?:string;status:string;created:string};
export type ProjectRecord={id:string;title:string;type:string;summary:string;project?:string;capture?:CaptureInfo};
export type WorkGroup={id:string;title:string;mode:"main"|"subagent";parentId?:string;records:ProjectRecord[];role?:string};
export function projectGroups(records:ProjectRecord[]){
 const projects=new Map<string,{name:string;groups:Map<string,WorkGroup>}>();
 for(const record of records){
  const name=record.project?.trim()||"분류 전";
  let project=projects.get(name);if(!project){project={name,groups:new Map()};projects.set(name,project);}
  const capture=record.capture,id=capture?.threadId||"record-"+record.id;
  let group=project.groups.get(id);
  if(!group){group={id,title:capture?.threadTitle||record.title,mode:capture?.mode||"main",parentId:capture?.parentThreadId,role:capture?.agentRole,records:[]};project.groups.set(id,group);}
  group.records.push(record);
 }
 return [...projects.values()].map(project=>({name:project.name,groups:[...project.groups.values()].map(group=>({...group,records:group.records.sort((a,b)=>(b.capture?.created||"").localeCompare(a.capture?.created||""))}))})).sort((a,b)=>a.name.localeCompare(b.name,"ko"));
}
