import ReactMarkdown from "react-markdown";
import Graph from "./Graph";
import Links from "./Links";
import { relationshipLabels } from "../model";
import { labels } from "./fields";
import { recordPath } from "../lib/routes";
export default function Detail({
  record: r,
  preview = false,
}: {
  record: any;
  preview?: boolean;
}) {
  return (
    <article className="detail">
      {preview && (
        <div className="notice">공개 미리보기 · 아직 게시되지 않았습니다</div>
      )}
      <span className="eyebrow">
        {r.type} / {r.example ? "예시 콘텐츠" : "AI 활용 기록"}
      </span>
      <h1>{r.title}</h1>
      <p className="muted">
        {r.origin} {r.project && " · " + r.project}
      </p>
      {r.visibility.description &&
        Object.entries(labels).map(
          ([k, label]) =>
            r[k] && (
              <section key={k}>
                <h2>{label as string}</h2>
                {k === "links" ? (
                  <Links value={r[k]} />
                ) : (
                  <ReactMarkdown>{r[k]}</ReactMarkdown>
                )}
              </section>
            ),
        )}
      {r.visibility.graph && (
        <>
          <section>
            <span className="tag">설계된 흐름</span>
            <h2>하네스의 작업 흐름</h2>
            {r.nodes.length ? (
              <Graph nodes={r.nodes} edges={r.edges} />
            ) : (
              <p className="muted">등록된 흐름이 없습니다.</p>
            )}
          </section>
          <section>
            <h2>스킬의 내부 구성</h2>
            {r.files.length ? (
              <Graph nodes={r.files} edges={r.fileEdges} />
            ) : (
              <p className="muted">등록된 파일 구조가 없습니다.</p>
            )}
          </section>
          <section>
            <h2>실행 확인 기록</h2>
            <p className="muted">
              작성자가 실행 근거와 당시 버전을 입력한 기록입니다. 파일 등록은
              실행을 의미하지 않습니다.
            </p>
            {r.runs.length ? (
              r.runs.map((run: any, i: number) => (
                <div className="panel" key={i}>
                  <b>{run.date}</b>
                  <p>
                    스킬 {run.skillVersion} · 하네스 {run.harnessVersion}
                  </p>
                  <p>{run.result}</p>
                  <p>근거: {run.evidence}</p>
                  {run.references?.map((ref: any, j: number) => <p key={j}>
                    사용 버전: <a href={recordPath(ref.recordId)}>{ref.title || ref.role}</a> · v{ref.version}
                  </p>)}
                </div>
              ))
            ) : (
              <p>실행이 확인된 기록이 없습니다.</p>
            )}
          </section>
        </>
      )}
      {r.visibility.graph && r.relationships?.length > 0 && <section><h2>이 기록의 연결</h2>{r.relationships.map((x:any,i:number)=><div className="panel" key={i}><a href={recordPath(x.targetId)}>{x.title||"연결 기록"}</a><p>{(relationshipLabels as any)[x.kind]} · {x.evidence==="proposed"?"제안 · 확인 필요":"연결 근거 확인"}{x.targetVersion?" · v"+x.targetVersion:""}</p><p>{x.note}</p></div>)}<a href="/atlas">전체 관계 지도 →</a></section>}
      {r.visibility.description && r.relations?.length > 0 && (
        <section><h2>연결된 기록과 사용 버전</h2>
          {r.relations.map((ref: any, i: number) => <p key={i}>
            <a href={recordPath(ref.recordId)}>{ref.title || "연결 기록"}</a>
            {" · v" + ref.version} · {ref.role} {ref.note && "— " + ref.note}
            <small className="muted"> (링크는 현재 공개본으로 이동)</small>
          </p>)}
        </section>
      )}
      {r.assets?.length > 0 && (
        <section>
          <h2>공개 결과물</h2>
          {r.assets
            .filter((a: any) => typeof a === "object")
            .map((a: any) => (
              <div key={a.id}>
                {a.mime.startsWith("image/") && r.visibility.images && (
                  <img
                    className="artifact"
                    src={"/api/images/" + a.id}
                    alt={a.name}
                  />
                )}
                {r.visibility.downloads && <a className="external" href={"/api/files/" + a.id}>
                  {a.name} ↓
                </a>}
              </div>
            ))}
        </section>
      )}
    </article>
  );
}
