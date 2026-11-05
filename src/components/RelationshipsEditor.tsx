import { relationshipLabels, type Relationship } from "../model";
export default function RelationshipsEditor({records,currentId,value,onChange}:{records:any[];currentId:string;value:Relationship[];onChange:(v:Relationship[])=>void}){
 const targets=records.filter(r=>r.id!==currentId);
 const update=(i:number,key:string,v:any)=>onChange(value.map((x,j)=>i===j?{...x,[key]:v}:x));
 return <section className="relationship-editor"><p className="muted">이 작업을 만들 때 사용한 방법이나 확인해 본 글을 골라 연결하세요. 연결했다는 것만으로 실제로 실행했다는 뜻은 아닙니다.</p>
 {value.map((x,i)=><div className="panel" key={i}>
 <label>연결할 기록<select value={x.targetId} onChange={e=>update(i,"targetId",e.target.value)}><option value="">기록 선택</option>{targets.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
 <div className="relationship-row"><label>관계<select value={x.kind} onChange={e=>update(i,"kind",e.target.value)}>{Object.entries(relationshipLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 <label>확인 상태<select value={x.evidence} onChange={e=>update(i,"evidence",e.target.value)}><option value="proposed">아직 확인이 필요해요</option><option value="confirmed">직접 확인했어요</option></select></label>
 <label>당시에 공개한 번호 (선택)<input type="number" min={1} value={x.targetVersion||""} onChange={e=>update(i,"targetVersion",e.target.value?Number(e.target.value):undefined)}/></label></div>
 <label>왜 연결했나요?<textarea aria-label="관계 연결 근거" value={x.note} maxLength={5000} onChange={e=>update(i,"note",e.target.value)}/></label>
 <button onClick={()=>onChange(value.filter((_,j)=>i!==j))}>관계 삭제</button>
 </div>)}
 <button disabled={!targets.length} onClick={()=>onChange([...value,{targetId:targets[0].id,kind:"uses",evidence:"proposed",note:""}])}>+ 다른 작업 연결</button>
 <a className="external" href="/admin/atlas">모든 작업의 연결 보기 →</a>
 </section>;
}
