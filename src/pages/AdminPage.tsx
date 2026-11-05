import { useState, useEffect } from "react";
import { blank, type RecordData } from "../model";
import { api } from "../lib/api";
import { editorPath } from "../lib/routes";
import Detail from "../components/Detail";
import StructureEditor from "../components/StructureEditor";
import VersionLinksEditor from "../components/VersionLinksEditor";
import RelationshipsEditor from "../components/RelationshipsEditor";
import IntegrationSettings from "../components/IntegrationSettings";
import {typeName} from "../copy";
import { labels,hints } from "../components/fields";
function PublicPreview({recordId}: {recordId: string}) {
 const [record,setRecord]=useState<any>(); const [error,setError]=useState("");
 useEffect(()=>{let active=true; api("/admin/preview/"+encodeURIComponent(recordId)).then(r=>{if(active)setRecord(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[recordId]);
 return error ? <p role="alert">{error}</p> : record ? <Detail record={record} preview/> : <p role="status">공개 범위를 확인하는 중…</p>;
}
export default function Admin({recordId, mode}: {recordId?: string; mode: "index" | "new" | "edit" | "preview"}) {
  const [session, setSession] = useState<any>();
  const [password,setPassword]=useState("");
  const [nextPassword,setNextPassword]=useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [r, setR] = useState<RecordData>(blank());
  const [step, setStep] = useState(mode === "preview" ? 5 : 0);
  const [loadingRecord, setLoadingRecord] = useState(!!recordId);
  const [recordError, setRecordError] = useState("");
  const [msg, setMsg] = useState("");
  const [versions, setVersions] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>();
  const [profile, setProfile] = useState<any>();
  const [assetInfo, setAssetInfo] = useState<any[]>([]);
  useEffect(() => {
    if (session?.admin)
      api("/admin/assets")
        .then(setAssetInfo)
        .catch((e) => setMsg(e.message));
  }, [session, r.assets.join(",")]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/session").then(setSession).catch(e=>setMsg(e.message));
    api("/profile").then(setProfile).catch(e=>setMsg(e.message));
  }, []);
  const refresh = () => api("/admin/records").then(setRecords);
  useEffect(() => {
    if (session?.admin) {
      api("/admin/records").then(items => {
        setRecords(items);
        if (recordId) {
          const item = items.find((x: any)=>x.id===recordId);
          if (item) setR(item); else setRecordError("기록을 찾을 수 없습니다.");
        }
      }).catch(e=>setRecordError(e.message)).finally(()=>setLoadingRecord(false));
    }
  }, [session]);
  const change = (k: string, v: any) => setR((x) => ({ ...x, [k]: v }));
  const perform = async (f: () => Promise<any>) => {
    setBusy(true);
    try {
      await f();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function save() {
    const d = await api("/admin/records", "POST", r);
    setR(d);
    history.replaceState({}, "", editorPath(d.id, step === 5));
    await refresh();
    setMsg("나만 보는 글로 저장했습니다.");
    return d;
  }
  if (!session) return <p role="status">{msg || "인증 상태 확인 중…"}</p>;
  if (!session.admin)
    return (
      <section className="login panel">
        <span className="eyebrow">나만 쓰는 공간</span>
        <h1>내 글을 쓰고 보관하는 곳</h1>
        <p>
          로그인하면 나만 보는 글을 저장하고, 준비된 글만 다른 사람에게 공개할 수 있어요.
        </p>
        {session.passwordConfigured && <form onSubmit={e=>{e.preventDefault();perform(async()=>{await api("/login","POST",{password});setPassword("");location.reload();});}}>
          <label>관리자 비밀번호<input type="password" autoComplete="current-password" required minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label>
          <button className="primary" disabled={busy}>로그인</button>
        </form>}
        {msg && <p role="alert">{msg}</p>}
        {session.configured ? (
          <a className="button primary" href="/auth/github">
            GitHub로 로그인 ↗
          </a>
        ) : !session.passwordConfigured ? (
          <div className="notice">
            GitHub OAuth가 아직 연결되지 않았습니다. 운영자가 인증 환경변수를
            설정하면 사용할 수 있습니다.
          </div>
        ) : null}
      </section>
    );
  if (loadingRecord) return <p role="status">기록을 불러오는 중…</p>;
  if (recordError) return <section role="alert"><h1>{recordError}</h1><a href="/admin">기록 관리로 돌아가기</a></section>;
  return (
    <>
      <div className="section-title">
        <div>
          <span className="eyebrow">나만 쓰는 공간</span>
          <h1>내 글 관리</h1>
        </div>
        <button
          onClick={() =>
            perform(async () => {
              await api("/admin/logout", "POST");
              location.reload();
            })
          }
        >
          로그아웃
        </button>
      </div>
      <p role="status" className="status">
        {busy ? "처리 중…" : msg}
      </p>
      <div className="admin-layout">
        <aside>
          <a className="button primary" href="/admin/records/new">+ 새 글 쓰기</a><a className="button" href="/admin/atlas">내 작업 연결 보기 →</a>
          {records.map(x => <a className="record-select" key={x.id} href={editorPath(x.id)} aria-current={r.id===x.id ? "page" : undefined}>
            {x.title}<small>{x.published ? "공개 중 · 수정한 내용은 나만 보여요" : "나만 보는 글"}{x.revision>0?" · "+x.revision+"번 공개":""}</small>
          </a>)}
          <a
            className="external"
            href="/api/admin/export"
            download="portfolio.json"
          >
            모든 글과 파일 보관본 내려받기 ↓
          </a>
          <label>
            보관해 둔 글 가져오기 (JSON / Markdown)
            <input
              type="file"
              accept=".json,.md"
              onChange={(e) =>
                perform(async () => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await f.text();
                  const result = await api(
                    "/admin/import",
                    "POST",
                    f.name.endsWith(".md")
                      ? { markdown: text }
                      : JSON.parse(text),
                  );
                  setMsg(result.note);
                  await refresh();
                })
              }
            />
          </label>
        </aside>
        {mode === "index" ? <section className="panel"><h2>한 가지 작업부터 소개해 보세요.</h2><p>무엇을 만들었는지 적고 사진이나 파일을 붙여 보세요. 저장한 글은 나만 볼 수 있습니다. 마지막에 확인하고 공개하면 다른 사람도 읽을 수 있어요.</p><p>이미 공개한 글을 고쳐도, 다시 공개하기 전까지 방문자에게는 원래 글이 보입니다.</p><a className="button primary" href="/admin/records/new">새 글 쓰기 →</a></section> : <div className="editor">
          <nav className="steps" aria-label="등록 단계">
            {["이름과 소개", "사진·파일", "만드는 방법", "작업 이야기", "공개할 내용", "마지막 확인"].map(
              (s, i) => (
                <button
                  className={step === i ? "active" : ""}
                  key={s}
                  onClick={() => {
                    if (i === 5) perform(async()=>{const d=await save(); location.assign(editorPath(d.id,true));});
                    else { setStep(i); if(r.id) history.replaceState({}, "", editorPath(r.id)); }
                  }}
                >
                  {i + 1}. {s}
                </button>
              ),
            )}
          </nav>
          {step === 0 && (
            <>
              <h2>무엇을 만들었나요?</h2><p>어려운 이름보다 하는 일을 적어 주세요. “글을 세 줄로 줄여 주는 도구”처럼요.</p>
              <label>
                종류
                <select
                  value={r.type}
                  onChange={(e) => change("type", e.target.value)}
                >
                  {["프로젝트", "실험 노트", "스킬·워크플로"].map((x) => (
                    <option key={x} value={x}>{typeName(x)}</option>
                  ))}
                </select>
              </label>
              <label>
                함께 만든 작업 이름 (선택)
                <input
                  list="projects"
                  value={r.project}
                  onChange={(e) => change("project", e.target.value)}
                />
                <datalist id="projects">
                  {records
                    .filter((x) => x.type === "프로젝트")
                    .map((x) => (
                      <option key={x.id} value={x.title} />
                    ))}
                </datalist>
              </label>
              <label>
                제목
                <input
                  value={r.title}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <label>무엇을 만들었고, 어디에 쓰나요?<textarea aria-label="무엇을 만들었고, 어디에 쓰나요?" rows={3} placeholder="무엇을 넣으면 어떤 결과가 나오는지 두 문장으로 적어 주세요." value={r.summary} onChange={e=>change("summary",e.target.value)}/></label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={r.example}
                  onChange={(e) => change("example", e.target.checked)}
                />
                실제 작업이 아닌 설명용 예시
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h2>완성한 모습이나 파일을 붙여 주세요.</h2>
              <p>
                사진, 문서, 코드 파일을 보관할 수 있어요. 올린 파일은 나만 볼 수 있으며, 공개 여부는 뒤에서 따로 고릅니다. 코드 파일을 올려도 실행되지는 않습니다.
              </p>
              <label className="upload">
                사진·파일 올리기 · 최대 10MB
                <input
                  type="file"
                  onChange={(e) =>
                    perform(async () => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 10 * 1024 * 1024)
                        throw Error("최대 10MB입니다.");
                      const response = await fetch("/api/admin/upload", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/octet-stream",
                          "X-Requested-With": "portfolio",
                          "X-Filename": encodeURIComponent(f.name),
                        },
                        body: f,
                      });
                      const a = await response.json();
                      if (!response.ok) throw Error(a.error);
                      setAnalysis(a);
                      setR((old) => ({
                        ...old,
                        assets: [...old.assets, a.id],
                        files: [
                          ...old.files,
                          ...(a.analysis.files.length
                            ? a.analysis.files
                            : [{ path: f.name, text: a.analysis.text }]
                          ).map((x: any) => ({
                            id: crypto.randomUUID(),
                            label: x.path,
                            kind: "파일",
                            role: "역할을 직접 설명하세요.",
                            version: "",
                            evidence: "추정" as const,
                            source: f.name,
                            text: x.text,
                            publicText: false,
                          })),
                        ],
                      }));
                      setMsg(
                        "파일을 나만 볼 수 있게 올렸습니다. 저장 버튼을 눌러 글에 붙여 주세요.",
                      );
                    })
                  }
                />
              </label>
              <p className="muted">
                Markdown, 텍스트, 코드·설정, ZIP, PDF, XLS/XLSX, PNG/JPEG/WebP
              </p>
              {analysis && (
                <div className="panel">
                  <b>{analysis.name}</b>
                  <p>파일을 보관했습니다. 아래 내용이 맞는지 확인해 주세요.</p>
                  {analysis.analysis.text&&<details><summary>파일 안의 글 보기</summary><pre>{analysis.analysis.text}</pre></details>}
                  {analysis.analysis.files?.map((f:any)=><details key={f.path}><summary>{f.path}</summary>{f.text?<pre>{f.text}</pre>:<p>파일 목록에서 확인했습니다.</p>}</details>)}
                </div>
              )}
              <h3>이 글에 붙인 파일 {r.assets.length}개</h3>
              {r.assets.map((id) => (
                <div key={id}>
                  <a href={"/api/files/" + id}>{assetInfo.find(a=>a.id===id)?.name || "첨부 파일 보기"} ↗</a>{" "}
                  <button
                    onClick={() =>
                      change(
                        "assets",
                        r.assets.filter((x) => x !== id),
                      )
                    }
                  >
                    연결 해제
                  </button>
                </div>
              ))}
              <label>
                AI와 이야기하며 정한 내용
                <textarea
                  rows={8}
                  value={r.design}
                  onChange={(e) => change("design", e.target.value)}
                />
              </label>
              <label>
                완성한 웹사이트나 코드 주소
                <textarea
                  value={r.links}
                  onChange={(e) => change("links", e.target.value)}
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2>어떤 방법을 썼나요?</h2><p>이 단계는 나중에 채워도 괜찮아요. 사용한 방법과 다른 작업의 연결을 자세히 남기고 싶을 때 적습니다.</p>
              <details className="detail-drawer">
                <summary>일이 진행되는 순서 그리기 (선택)</summary>
                <StructureEditor
                  nodes={r.nodes}
                  edges={r.edges}
                  onChange={(nodes, edges) => setR({ ...r, nodes, edges })}
                />
              </details>
              <details>
                <summary>어떤 파일로 이루어졌나요? (선택)</summary>
                <StructureEditor
                  nodes={r.files}
                  edges={r.fileEdges}
                  onChange={(files, fileEdges) =>
                    setR({ ...r, files, fileEdges })
                  }
                />
              </details>
              <h3>함께 쓴 방법이나 작업 연결하기</h3><RelationshipsEditor records={records} currentId={r.id} value={r.relationships||[]} onChange={value=>change("relationships",value)}/>
              <details className="detail-drawer"><summary>당시에 쓴 내용과 실행 기록 자세히 남기기 (선택)</summary><h3>사용한 내용 고르기</h3>
              <VersionLinksEditor records={records} value={r.relations || []} onChange={value=>change("relations",value)}/>
              <h3>실제로 해 본 기록</h3>
              <p className="muted">
                직접 해 본 날짜와 결과를 적습니다. 나중에 내용이 바뀌어도 무엇을 썼는지 알 수 있도록, 당시 공개했던 내용을 골라 연결합니다.
              </p>
              {r.runs.map((run, i) => (
                <div className="panel" key={i}>
                  {Object.entries({
                    date: "실행 날짜",
                    skillVersion: "AI 지침의 이름과 당시 내용",
                    harnessVersion: "작업 순서의 이름과 당시 내용",
                    evidence: "확인 근거",
                    result: "결과",
                  }).map(([k, l]) => (
                    <label key={k}>
                      {l}
                      <input
                        value={(run as any)[k]}
                        onChange={(e) =>
                          change(
                            "runs",
                            r.runs.map((x, j) =>
                              j === i ? { ...x, [k]: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <VersionLinksEditor records={records} value={run.references || []} execution onChange={value=>change("runs",r.runs.map((x,j)=>j===i ? {...x,references:value} : x))}/>
                  <button
                    onClick={() =>
                      change(
                        "runs",
                        r.runs.filter((_, j) => j !== i),
                      )
                    }
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  change("runs", [
                    ...r.runs,
                    {
                      date: "",
                      skillVersion: "",
                      harnessVersion: "",
                      evidence: "",
                      result: "",
                    },
                  ])
                }
              >
                + 실제로 해 본 일 추가
              </button></details>
            </>
          )}
          {step === 3 && (
            <>
              <h2>처음 보는 사람에게 설명해 주세요.</h2><p>왜 만들었는지부터 적으면 읽는 사람이 이해하기 쉬워요. 모르는 용어는 하는 일로 풀어 써 주세요.</p>
              <label>
                제목
                <input
                  value={r.title}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              {Object.entries(labels).map(([k, l]) => (
                <label key={k}>
                  {l}<span className="field-help">{hints[k]}</span>
                  <textarea
                    aria-label={l}
                    rows={4}
                    value={(r as any)[k]}
                    onChange={(e) => change(k, e.target.value)}
                  />
                </label>
              ))}
              <label>
                제작 구분
                <select
                  value={r.origin}
                  onChange={(e) => change("origin", e.target.value)}
                >
                  {["직접 제작", "기존 자료를 수정", "외부 도입"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <h2>다른 사람에게 무엇을 보여줄까요?</h2>
              <p>
                마지막에 ‘이 내용 공개하기’를 눌러야 다른 사람에게 보입니다. 제목과 종류는 함께 공개됩니다. 파일 설명을 보여주는 것과 원본 파일을 내려받게 하는 것은 별개예요.
              </p>
              {Object.entries({
                description: "소개와 만든 이야기",
                graph: "진행 순서 · 작업 연결 · 공개로 고른 파일 내용 · 실행 기록",
                images: "완성한 모습의 사진",
                downloads: "원본 파일 내려받기",
              }).map(([k, l]) => (
                <label className="check panel" key={k}>
                  <input
                    type="checkbox"
                    checked={(r.visibility as any)[k]}
                    onChange={(e) =>
                      change("visibility", {
                        ...r.visibility,
                        [k]: e.target.checked,
                      })
                    }
                  />
                  {l}
                </label>
              ))}
              <label>
                이번에는 무엇을 바꿨나요?
                <textarea
                  value={r.reason}
                  onChange={(e) => change("reason", e.target.value)}
                />
              </label>
            </>
          )}
          {step === 5 && (
            <>
              <PublicPreview recordId={r.id}/>
              <p className="notice">
                붙인 파일 {r.assets.length}개 · 사진{" "}
                {r.visibility.images ? "공개" : "비공개"} · 원본 내려받기{" "}
                {r.visibility.downloads ? "공개" : "비공개"}. 파일 내용도 한 번 더 확인해 주세요.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    const d = await save();
                    await api("/admin/publish/" + d.id, "POST");
                    await refresh();
                    setMsg("이 내용을 공개했습니다.");
                  })
                }
              >
                이 내용 공개하기
              </button>
            </>
          )}
          <footer className="editor-actions">
            <button disabled={busy} onClick={() => perform(save)} >
              나만 보이게 저장
            </button>
            {step < 5 && (
              <button className="primary" onClick={() => {
                if(step===4) perform(async()=>{const d=await save(); location.assign(editorPath(d.id,true));});
                else setStep(step+1);
              }}>
                다음 단계 →
              </button>
            )}
            {r.id && (
              <>
                <button
                  onClick={() =>
                    perform(async () => {
                      await api("/admin/unpublish/" + r.id, "POST");
                      await refresh();
                      setMsg("이제 이 글은 나만 볼 수 있습니다.");
                    })
                  }
                >
                  공개 멈추기
                </button>
                <button
                  onClick={() =>
                    perform(async () =>
                      setVersions(await api("/admin/versions/" + r.id)),
                    )
                  }
                >
                  전에 공개했던 내용
                </button>
                <a href={"/api/admin/markdown/" + r.id} download="record.md">
                  이 글 내려받기 ↓
                </a>
              </>
            )}
          </footer>
          {versions.map((v) => (
            <details className="panel" key={v.id}>
              <summary>
                {v.number}번째 공개 · {v.created.slice(0, 10)} · {v.reason}
              </summary>
              <Detail record={{ ...v.content, assets: [] }} />
              <details>
                <summary>당시 저장한 전체 자료</summary>
                <pre>{JSON.stringify(v.content, null, 2)}</pre>
              </details>
              <button
                onClick={() => {
                  setR({ ...v.content, reason: "전에 공개한 내용에서 다시 고침" });
                  setMsg(
                    "전에 공개한 내용을 가져왔습니다. 다시 공개하기 전까지 방문자는 원래 글을 봅니다.",
                  );
                }}
              >
                이 내용을 가져와서 고치기
              </button>
            </details>
          ))}
        </div>}
      </div>
      <IntegrationSettings/>
      {session.passwordConfigured && <details className="panel"><summary>관리자 비밀번호 변경</summary>
        <form onSubmit={e=>{e.preventDefault();perform(async()=>{await api("/admin/password","POST",{currentPassword:password,newPassword:nextPassword});setPassword("");setNextPassword("");location.assign("/admin");});}}>
          <label>현재 비밀번호<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          <label>새 비밀번호 (12자 이상)<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={nextPassword} onChange={e=>setNextPassword(e.target.value)}/></label>
          <button disabled={busy}>변경 후 다시 로그인</button>
        </form></details>}
      {profile && (
        <details className="panel">
          <summary>첫 화면 소개와 연락처 고치기</summary>
          {Object.entries({
            intro: "소개",
            contact: "공개 연락처",
            links: "공개 외부 링크",
          }).map(([k, l]) => (
            <label key={k}>
              {l}
              <textarea
                value={profile[k]}
                onChange={(e) =>
                  setProfile({ ...profile, [k]: e.target.value })
                }
              />
            </label>
          ))}
          <button
            onClick={() =>
              perform(async () => {
                await api("/admin/profile", "PUT", profile);
                setMsg("홈 공개 정보를 저장했습니다.");
              })
            }
          >
            첫 화면에 반영하기
          </button>
        </details>
      )}
    </>
  );
}
