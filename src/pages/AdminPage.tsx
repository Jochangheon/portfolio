import { useState, useEffect } from "react";
import { blank, type RecordData } from "../model";
import { api } from "../lib/api";
import { editorPath } from "../lib/routes";
import Detail from "../components/Detail";
import StructureEditor from "../components/StructureEditor";
import VersionLinksEditor from "../components/VersionLinksEditor";
import { labels } from "../components/fields";
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
    setMsg("초안을 서버에 저장했습니다.");
    return d;
  }
  if (!session) return <p role="status">{msg || "인증 상태 확인 중…"}</p>;
  if (!session.admin)
    return (
      <section className="login panel">
        <span className="eyebrow">관리자 전용</span>
        <h1>기록을 이어가는 공간</h1>
        <p>
          관리자 인증 후 초안과 원본 파일을 관리할 수 있습니다.
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
          <span className="eyebrow">WORKSPACE</span>
          <h1>기록 관리</h1>
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
          <a className="button primary" href="/admin/records/new">+ 새 기록</a>
          {records.map(x => <a className="record-select" key={x.id} href={editorPath(x.id)} aria-current={r.id===x.id ? "page" : undefined}>
            {x.title}<small>{x.published ? "게시됨 · 수정은 초안" : "비공개 초안"} / v{x.revision}</small>
          </a>)}
          <a
            className="external"
            href="/api/admin/export"
            download="portfolio.json"
          >
            JSON 백업 ↓
          </a>
          <label>
            JSON / Markdown 가져오기
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
        {mode === "index" ? <section className="panel"><h2>내 작업을 기록하세요</h2><p>새 기록을 만들거나 왼쪽에서 기록을 선택하세요. 변경 사항은 초안에 저장되며 게시 전까지 기존 공개본이 유지됩니다.</p><a className="button primary" href="/admin/records/new">첫 기록 작성하기 →</a></section> : <div className="editor">
          <nav className="steps" aria-label="등록 단계">
            {["종류", "자료", "구조", "설명", "공개 범위", "미리보기"].map(
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
              <h2>무엇을 기록하나요?</h2>
              <label>
                종류
                <select
                  value={r.type}
                  onChange={(e) => change("type", e.target.value)}
                >
                  {["프로젝트", "실험 노트", "스킬·워크플로"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                연결 프로젝트
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
              <label className="check">
                <input
                  type="checkbox"
                  checked={r.example}
                  onChange={(e) => change("example", e.target.checked)}
                />
                개발용 예시 콘텐츠
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h2>자료를 모아 주세요</h2>
              <p>
                기본 파일 분석만 수행합니다. 코드를 실행하거나 AI 환경에 스킬을
                설치하지 않습니다.
              </p>
              <label className="upload">
                파일 업로드 · 최대 10MB
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
                        "비공개 업로드 완료. 초안 저장을 눌러 기록과 연결하세요.",
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
                  <p>{analysis.analysis.method}</p>
                  <pre>{JSON.stringify(analysis.analysis, null, 2)}</pre>
                </div>
              )}
              <h3>연결된 원본 {r.assets.length}개</h3>
              {r.assets.map((id) => (
                <div key={id}>
                  <a href={"/api/files/" + id}>원본 확인 ↗</a>{" "}
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
                대화에서 만든 지침 · 텍스트
                <textarea
                  rows={8}
                  value={r.design}
                  onChange={(e) => change("design", e.target.value)}
                />
              </label>
              <label>
                GitHub · 배포 사이트 링크
                <textarea
                  value={r.links}
                  onChange={(e) => change("links", e.target.value)}
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2>구조와 관계를 확인하세요</h2>
              <details open>
                <summary>하네스 작업 흐름</summary>
                <StructureEditor
                  nodes={r.nodes}
                  edges={r.edges}
                  onChange={(nodes, edges) => setR({ ...r, nodes, edges })}
                />
              </details>
              <details>
                <summary>스킬 파일 구성</summary>
                <StructureEditor
                  nodes={r.files}
                  edges={r.fileEdges}
                  onChange={(files, fileEdges) =>
                    setR({ ...r, files, fileEdges })
                  }
                />
              </details>
              <h3>관련 기록과 사용 버전</h3>
              <VersionLinksEditor records={records} value={r.relations || []} onChange={value=>change("relations",value)}/>
              <h3>실행 확인 기록</h3>
              <p className="muted">
                실제 확인한 근거를 입력하고, 사용한 기록의 게시 버전을 선택하세요. 자유 텍스트만으로는 실행 버전이 확정되지 않습니다.
              </p>
              {r.runs.map((run, i) => (
                <div className="panel" key={i}>
                  {Object.entries({
                    date: "실행 날짜",
                    skillVersion: "스킬 버전",
                    harnessVersion: "하네스 버전",
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
                + 실행 근거 기록
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <h2>판단과 결과를 기록하세요</h2>
              <label>
                제목
                <input
                  value={r.title}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              {Object.entries(labels).map(([k, l]) => (
                <label key={k}>
                  {l as string}
                  <textarea
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
              <h2>공개할 부분을 선택하세요</h2>
              <p>
                제목·분류·제작 구분은 게시 시 공개됩니다. 파일 원문은 개별 공개
                체크를 함께 확인하세요.
              </p>
              {Object.entries({
                description: "설명",
                graph: "구조도 · 공개 원문 · 실행 근거",
                images: "결과 이미지",
                downloads: "첨부 원본 다운로드",
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
                이번 버전 변경 이유
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
                첨부 원본 {r.assets.length}개 · 이미지{" "}
                {r.visibility.images ? "공개" : "비공개"} · 다운로드{" "}
                {r.visibility.downloads ? "공개" : "비공개"}. 업로드 단계에서
                파일 내용을 확인하세요.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    const d = await save();
                    await api("/admin/publish/" + d.id, "POST");
                    await refresh();
                    setMsg("새 버전을 게시했습니다.");
                  })
                }
              >
                이 내용으로 게시
              </button>
            </>
          )}
          <footer className="editor-actions">
            <button disabled={busy} onClick={() => perform(save)}>
              초안 저장
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
                      setMsg("비공개로 전환했습니다.");
                    })
                  }
                >
                  게시 중단
                </button>
                <button
                  onClick={() =>
                    perform(async () =>
                      setVersions(await api("/admin/versions/" + r.id)),
                    )
                  }
                >
                  버전 이력
                </button>
                <a href={"/api/admin/markdown/" + r.id} download="record.md">
                  Markdown ↓
                </a>
              </>
            )}
          </footer>
          {versions.map((v) => (
            <details className="panel" key={v.id}>
              <summary>
                v{v.number} · {v.created.slice(0, 10)} · {v.reason}
              </summary>
              <Detail record={{ ...v.content, assets: [] }} />
              <details>
                <summary>보존된 전체 원문</summary>
                <pre>{JSON.stringify(v.content, null, 2)}</pre>
              </details>
              <button
                onClick={() => {
                  setR({ ...v.content, reason: "이전 버전에서 새 초안 작성" });
                  setMsg(
                    "이전 버전을 편집기로 가져왔습니다. 저장·게시 전에는 공개본이 유지됩니다.",
                  );
                }}
              >
                이 버전으로 초안 작성
              </button>
            </details>
          ))}
        </div>}
      </div>
      {session.passwordConfigured && <details className="panel"><summary>관리자 비밀번호 변경</summary>
        <form onSubmit={e=>{e.preventDefault();perform(async()=>{await api("/admin/password","POST",{currentPassword:password,newPassword:nextPassword});setPassword("");setNextPassword("");location.assign("/admin");});}}>
          <label>현재 비밀번호<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          <label>새 비밀번호 (12자 이상)<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={nextPassword} onChange={e=>setNextPassword(e.target.value)}/></label>
          <button disabled={busy}>변경 후 다시 로그인</button>
        </form></details>}
      {profile && (
        <details className="panel">
          <summary>홈 소개 · 공개 연락처 설정</summary>
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
            공개 홈 정보 저장
          </button>
        </details>
      )}
    </>
  );
}
