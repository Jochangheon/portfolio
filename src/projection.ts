import { blank, type RecordData, type NodeData, type VersionReference } from "./model.ts";
// Public output is an allowlist: unknown imported fields and editor metadata stay private.
export function publicRecord(input: RecordData): RecordData {
 const p = Object.fromEntries(Object.keys(blank()).map(k=>[k,structuredClone((input as any)[k] ?? (blank() as any)[k])])) as RecordData;
 if(!p.visibility.description) {
  for(const k of ["summary","problem","humanRole","aiRole","design","validation","limits","links","related","source","project"] as const) p[k]="";
  p.relations=[];
 }
 const node=(n:NodeData):NodeData=>({
  id:n.id,label:n.label,kind:n.kind,role:n.role,version:n.version,evidence:n.evidence,source:n.source,
  publicText:n.publicText===true,...(n.publicText===true?{text:n.text}:{})
 });
 const ref=(r:VersionReference):VersionReference=>({recordId:r.recordId,version:r.version,role:r.role,note:r.note,...(r.title?{title:r.title}:{})});
 if(!p.visibility.graph) { p.nodes=[];p.edges=[];p.files=[];p.fileEdges=[];p.runs=[]; }
 else {
  p.nodes=p.nodes.map(node);p.files=p.files.map(node);
  const edge=(e:any)=>({id:e.id,source:e.source,target:e.target,label:e.label,evidence:e.evidence});
  p.edges=p.edges.map(edge);p.fileEdges=p.fileEdges.map(edge);
  p.runs=p.runs.map(r=>({date:r.date,skillVersion:r.skillVersion,harnessVersion:r.harnessVersion,evidence:r.evidence,result:r.result,references:(r.references||[]).map(ref)}));
 }
 p.relations=(p.relations||[]).map(ref);
 p.visibility={description:p.visibility.description,graph:p.visibility.graph,images:p.visibility.images,downloads:p.visibility.downloads};
 p.reason="";
 return p;
}
