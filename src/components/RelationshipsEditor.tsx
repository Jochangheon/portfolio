import { relationshipLabels, type Relationship } from "../model";
export default function RelationshipsEditor({records,currentId,value,onChange}:{records:any[];currentId:string;value:Relationship[];onChange:(v:Relationship[])=>void}){
 const targets=records.filter(r=>r.id!==currentId);
 const update=(i:number,key:string,v:any)=>onChange(value.map((x,j)=>i===j?{...x,[key]:v}:x));
 return <section className="relationship-editor"><p className="muted">설계상의 관계와 실제 실행은 구분합니다. 아직 확인하지 않은 연결은 제안으로 남겨 두세요.</p>
 {value.map((x,i)=><div className="panel" key={i}>
 <label>연결할 기록<select value={x.targetId} onChange={e=>update(i,"targetId",e.target.value)}><option value="">기록 선택</option>{targets.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
 <div className="relationship-row"><label>관계<select value={x.kind} onChange={e=>update(i,"kind",e.target.value)}>{Object.entries(relationshipLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 <label>확인 상태<select value={x.evidence} onChange={e=>update(i,"evidence",e.target.value)}><option value="proposed">제안 · 확인 필요</option><option value="confirmed">연결 근거 확인</option></select></label>
 <label>특정 게시 버전 (선택)<input type="number" min={1} value={x.targetVersion||""} onChange={e=>update(i,"targetVersion",e.target.value?Number(e.target.value):undefined)}/></label></div>
 <label>연결 근거<textarea aria-label="관계 연결 근거" value={x.note} maxLength={5000} onChange={e=>update(i,"note",e.target.value)}/></label>
 <button onClick={()=>onChange(value.filter((_,j)=>i!==j))}>관계 삭제</button>
 </div>)}
 <button disabled={!targets.length} onClick={()=>onChange([...value,{targetId:targets[0].id,kind:"uses",evidence:"proposed",note:""}])}>+ 기록 연결</button>
 <a className="external" href="/admin/atlas">전체 관계 지도 보기 →</a>
 </section>;
}
