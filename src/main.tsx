import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  blank,
  example,
  type RecordData,
  type NodeData,
  type EdgeData,
} from "./model";
import "./style.css";
const standalone = !!window.__PORTFOLIO_PREVIEW__;
const homeUrl = standalone ? location.pathname : "/";
async function api(path: string, method = "GET", body?: any) {
  if (window.__PORTFOLIO_PREVIEW__) {
    const snapshot = window.__PORTFOLIO_PREVIEW__;
    if (method !== "GET")
      throw Error("화면 확인용 미리보기에서는 저장할 수 없습니다.");
    if (path === "/records") return snapshot.records;
    if (path === "/profile") return snapshot.profile;
    if (path === "/session") return { admin: false, configured: false };
    if (path.startsWith("/records/")) {
      const record = snapshot.records.find(
        (r) => r.id === decodeURIComponent(path.slice(9)),
      );
      if (record) return record;
    }
    throw Error("미리보기에 포함되지 않은 기록입니다.");
  }
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "portfolio",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "요청 실패");
  return d;
}
const labels: any = {
  summary: "요약과 결과물",
  problem: "문제와 목표",
  humanRole: "나의 역할",
  aiRole: "AI의 역할",
  design: "핵심 설계와 선택 이유",
  validation: "검증 방법과 결과",
  limits: "한계와 다음 개선",
  related: "관련 실험 · 사용 스킬과 버전",
  links: "결과물 링크 (한 줄에 하나)",
  source: "출처",
};
function Links({ value }: { value: string }) {
  return (
    <>
      {value
        .split("\n")
        .filter(Boolean)
        .map((s, i) =>
          /^https?:\/\//.test(s) ? (
            <a
              className="external"
              key={i}
              href={s}
              target="_blank"
              rel="noreferrer"
            >
              {s} ↗
            </a>
          ) : (
            <p key={i}>{s}</p>
          ),
        )}
    </>
  );
}
function Graph({ nodes, edges }: { nodes: NodeData[]; edges: EdgeData[] }) {
  const [selected, setSelected] = useState<NodeData>();
  return (
    <>
      <div className="graph">
        <ReactFlow
          fitView
          nodes={nodes.map((n, i) => ({
            id: n.id,
            position: { x: (i % 3) * 240, y: Math.floor(i / 3) * 170 },
            data: { label: n.label },
            style: {
              borderRadius: 12,
              padding: 12,
              border: "1px solid #b3c9bd",
            },
          }))}
          edges={edges.map((e) => ({
            ...e,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: false,
            label: e.label + " · " + e.evidence,
          }))}
          onNodeClick={(_, n) => {
            setSelected(nodes.find((x) => x.id === n.id));
          }}
          nodesDraggable={false}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <div className="step-list">
        {nodes.map((n, i) => (
          <button
            key={n.id}
            onClick={() => {
              setSelected(n);
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {n.label} ↗
          </button>
        ))}
      </div>
      {selected && (
        <aside className="node-detail">
          <button className="close" onClick={() => setSelected(undefined)}>
            닫기 ×
          </button>
          <small>
            {selected.kind} · {selected.evidence}
          </small>
          <h3>{selected.label}</h3>
          <p>{selected.role}</p>
          <p>
            버전: {selected.version || "미지정"} · 근거:{" "}
            {selected.source || "미입력"}
          </p>
          {edges
            .filter((e) => e.source === selected.id || e.target === selected.id)
            .map((e) => (
              <p key={e.id}>
                {nodes.find((n) => n.id === e.source)?.label} →{" "}
                {nodes.find((n) => n.id === e.target)?.label}: {e.label} (
                {e.evidence})
              </p>
            ))}
          {selected.publicText && selected.text && (
            <details>
              <summary>공개 원문 보기</summary>
              <pre>{selected.text}</pre>
            </details>
          )}
        </aside>
      )}
    </>
  );
}
function Detail({
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
                </div>
              ))
            ) : (
              <p>실행이 확인된 기록이 없습니다.</p>
            )}
          </section>
        </>
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
                    src={"/api/files/" + a.id}
                    alt={a.name}
                  />
                )}
                <a className="external" href={"/api/files/" + a.id}>
                  {a.name} ↓
                </a>
              </div>
            ))}
        </section>
      )}
    </article>
  );
}
function StructureEditor({
  nodes,
  edges,
  onChange,
}: {
  nodes: NodeData[];
  edges: EdgeData[];
  onChange: (n: NodeData[], e: EdgeData[]) => void;
}) {
  const update = (i: number, key: string, value: any) =>
    onChange(
      nodes.map((n, j) => (j === i ? { ...n, [key]: value } : n)),
      edges,
    );
  return (
    <div>
      <p className="muted">
        관계는 자동 확정하지 않습니다. 근거와 버전을 입력해 주세요.
      </p>
      {nodes.map((n, i) => (
        <details key={n.id} className="panel">
          <summary>
            {n.label || "새 항목"} · {n.evidence}
          </summary>
          {[
            ["label", "이름"],
            ["kind", "역할 종류"],
            ["role", "쉬운 설명"],
            ["version", "버전"],
            ["source", "근거 · 관련 자료"],
            ["text", "원문"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <textarea
                value={(n as any)[k] || ""}
                onChange={(e) => update(i, k, e.target.value)}
              />
            </label>
          ))}
          <label>
            근거 구분
            <select
              value={n.evidence}
              onChange={(e) => update(i, "evidence", e.target.value)}
            >
              {["파일에 명시", "작성자 확인", "추정"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!n.publicText}
              onChange={(e) => update(i, "publicText", e.target.checked)}
            />
            원문 공개
          </label>
          <button
            onClick={() =>
              onChange(
                nodes.filter((_, j) => j !== i),
                edges.filter((e) => e.source !== n.id && e.target !== n.id),
              )
            }
          >
            항목 삭제
          </button>
        </details>
      ))}
      <button
        onClick={() =>
          onChange(
            [
              ...nodes,
              {
                id: crypto.randomUUID(),
                label: "새 항목",
                kind: "단계",
                role: "",
                version: "",
                source: "",
                evidence: "추정",
              },
            ],
            edges,
          )
        }
      >
        + 항목 추가
      </button>
      <h3>연결 관계</h3>
      {edges.map((e, i) => (
        <div className="edge-row panel" key={e.id}>
          {["source", "target"].map((k) => (
            <label key={k}>
              {k === "source" ? "출발" : "도착"}
              <select
                value={(e as any)[k]}
                onChange={(ev) =>
                  onChange(
                    nodes,
                    edges.map((x, j) =>
                      j === i ? { ...x, [k]: ev.target.value } : x,
                    ),
                  )
                }
              >
                {nodes.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            연결 설명
            <input
              value={e.label}
              onChange={(ev) =>
                onChange(
                  nodes,
                  edges.map((x, j) =>
                    j === i ? { ...x, label: ev.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label>
            근거
            <select
              value={e.evidence}
              onChange={(ev) =>
                onChange(
                  nodes,
                  edges.map((x, j) =>
                    j === i ? { ...x, evidence: ev.target.value as any } : x,
                  ),
                )
              }
            >
              {["파일에 명시", "작성자 확인", "추정"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              onChange(
                nodes,
                edges.filter((_, j) => j !== i),
              )
            }
          >
            삭제
          </button>
        </div>
      ))}
      <button
        disabled={!nodes.length}
        onClick={() =>
          onChange(nodes, [
            ...edges,
            {
              id: crypto.randomUUID(),
              source: nodes[0].id,
              target: nodes.at(-1)!.id,
              label: "",
              evidence: "추정",
            },
          ])
        }
      >
        + 관계 추가
      </button>
    </div>
  );
}
function Admin() {
  const [session, setSession] = useState<any>();
  const [records, setRecords] = useState<any[]>([]);
  const [r, setR] = useState<RecordData>(blank());
  const [step, setStep] = useState(0);
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
    api("/session").then(setSession);
    api("/profile").then(setProfile);
  }, []);
  const refresh = () => api("/admin/records").then(setRecords);
  useEffect(() => {
    if (session?.admin) refresh().catch((e) => setMsg(e.message));
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
    await refresh();
    setMsg("초안을 서버에 저장했습니다.");
    return d;
  }
  if (!session) return <p>인증 상태 확인 중…</p>;
  if (!session.admin)
    return (
      <section className="login panel">
        <span className="eyebrow">관리자 전용</span>
        <h1>기록을 이어가는 공간</h1>
        <p>
          실제 GitHub 계정과 서버의 관리자 ID가 일치해야 접근할 수 있습니다.
        </p>
        {session.configured ? (
          <a className="button primary" href="/auth/github">
            GitHub로 로그인 ↗
          </a>
        ) : (
          <div className="notice">
            GitHub OAuth가 아직 연결되지 않았습니다. 운영자가 인증 환경변수를
            설정하면 사용할 수 있습니다.
          </div>
        )}
      </section>
    );
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
          <button
            className="primary"
            onClick={() => {
              setR(blank());
              setStep(0);
              setVersions([]);
            }}
          >
            + 새 기록
          </button>
          {records.map((x) => (
            <button
              className="record-select"
              key={x.id}
              onClick={() => {
                setR(x);
                setVersions([]);
                setStep(0);
              }}
            >
              {x.title}
              <small>
                {x.published ? "게시됨 · 수정은 초안" : "비공개 초안"} / v
                {x.revision}
              </small>
            </button>
          ))}
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
        <div className="editor">
          <nav className="steps" aria-label="등록 단계">
            {["종류", "자료", "구조", "설명", "공개 범위", "미리보기"].map(
              (s, i) => (
                <button
                  className={step === i ? "active" : ""}
                  key={s}
                  onClick={() => setStep(i)}
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
              <h3>실행 확인 기록</h3>
              <p className="muted">
                실제 확인한 근거와 버전을 입력한 경우에만 추가하세요.
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
              <Detail
                record={{
                  ...r,
                  nodes: r.nodes.map((n) => ({
                    ...n,
                    text: n.publicText ? n.text : undefined,
                  })),
                  files: r.files.map((n) => ({
                    ...n,
                    text: n.publicText ? n.text : undefined,
                  })),
                  assets: assetInfo.filter(
                    (a) =>
                      r.assets.includes(a.id) &&
                      (r.visibility.downloads ||
                        (r.visibility.images && a.mime.startsWith("image/"))),
                  ),
                }}
                preview
              />
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
              <button className="primary" onClick={() => setStep(step + 1)}>
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
        </div>
      </div>
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
function App() {
  const [data, setData] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});
  const [filter, setFilter] = useState("전체");
  const [selected, setSelected] = useState<any>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const admin = location.pathname.startsWith("/admin");
  useEffect(() => {
    let active = true;
    let navigation = 0;
    const syncLocation = async () => {
      const current = ++navigation;
      setReady(false);
      setError("");
      try {
        const params = new URLSearchParams(location.search);
        const id = params.get("record");
        const record =
          params.get("example") === "1"
            ? example()
            : id
              ? await api("/records/" + encodeURIComponent(id))
              : undefined;
        if (active && current === navigation) setSelected(record);
      } catch (e) {
        if (active && current === navigation) {
          setSelected(undefined);
          setError((e as Error).message);
        }
      } finally {
        if (active && current === navigation) setReady(true);
      }
    };
    Promise.all([api("/records"), api("/profile")])
      .then(([d, p]) => {
        if (active) {
          setData(d);
          setProfile(p);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => {
      active = false;
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);
  useEffect(() => {
    if (!ready || admin || error) return;
    document.title = selected
      ? `${selected.title} | 조창헌 포트폴리오`
      : "조창헌 포트폴리오";
  }, [selected, ready, admin, error]);
  const open = (r: any) => {
    setSelected(r);
    history.pushState(
      {},
      "",
      homeUrl +
        (r.example && r.id === "example"
          ? "?example=1"
          : "?record=" + encodeURIComponent(r.id)),
    );
    window.scrollTo(0, 0);
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <header>
        <a className="brand" href={homeUrl}>
          조창헌<span> / PORTFOLIO</span>
        </a>
        <nav>
          <a href={homeUrl + "#records"}>AI 활용 기록</a>
          <a href={homeUrl + "#approach"}>작업 방식</a>
          {!standalone && (
            <a className="admin-link" href="/admin">
              관리자 ↗
            </a>
          )}
        </nav>
      </header>
      <main id="main-content">
        {standalone && (
          <div className="preview-note">
            화면 확인용 미리보기 · 실제 기록은 아직 없습니다. 예시 구조도를 눌러
            탐색해 보세요.
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {admin ? (
          <Admin />
        ) : selected ? (
          <>
            <button
              className="back"
              onClick={() => {
                setSelected(undefined);
                history.pushState({}, "", homeUrl);
              }}
            >
              ← 기록으로 돌아가기
            </button>
            <Detail record={selected} />
          </>
        ) : (
          <>
            <section className="hero">
              <div className="hero-layout">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="dot" /> AI × HUMAN JUDGMENT
                  </div>
                  <h1>
                    AI와 함께 만들고,
                    <br />
                    <span>나의 판단을 기록합니다.</span>
                  </h1>
                  <p>{profile.intro}</p>
                  <a className="button primary" href="#records">
                    기록 살펴보기 <span>↘</span>
                  </a>
                </div>
                <div
                  className="hero-map"
                  aria-label="기록의 구성: 문제 정의, 나의 판단, AI와 작업, 결과 검증"
                >
                  <div className="map-caption">
                    <span>FROM QUESTION TO EVIDENCE</span>
                    <span>↗</span>
                  </div>
                  <div className="map-step">
                    <span>01</span>
                    <div>
                      <small>QUESTION</small>
                      <strong>어떤 문제를 풀었나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step map-highlight">
                    <span>02</span>
                    <div>
                      <small>MY DECISION</small>
                      <strong>무엇을 직접 판단했나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step">
                    <span>03</span>
                    <div>
                      <small>COLLABORATION</small>
                      <strong>AI와 어떻게 만들었나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step">
                    <span>04</span>
                    <div>
                      <small>EVIDENCE</small>
                      <strong>어떻게 확인하고 개선했나</strong>
                    </div>
                    <span>↗</span>
                  </div>
                  <p>결과물에, 선택의 이유를 더합니다.</p>
                </div>
              </div>
              <div className="hero-note">
                <span>01 / ARCHIVE</span>
                <span>결과 너머, 그 과정까지.</span>
              </div>
            </section>
            <section id="records">
              <div className="section-title">
                <div>
                  <span className="eyebrow">SELECTED WORK & NOTES</span>
                  <h2>
                    AI 활용 기록
                    <span className="count">
                      {data.length.toString().padStart(2, "0")}
                    </span>
                  </h2>
                </div>
                <p className="muted">문제에서 시작해, 검증까지 이어지는 기록</p>
              </div>
              <div className="filters">
                {["전체", "프로젝트", "실험 노트", "스킬·워크플로"].map((x) => (
                  <button
                    key={x}
                    className={filter === x ? "active" : ""}
                    aria-pressed={filter === x}
                    onClick={() => {
                      setFilter(x);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="cards">
                {data
                  .filter((r) => filter === "전체" || r.type === filter)
                  .map((r, i) => (
                    <button className="card" key={r.id} onClick={() => open(r)}>
                      <div className={"card-art art-" + (i % 3)}>
                        <span>
                          {r.type === "프로젝트"
                            ? "↗"
                            : r.type === "실험 노트"
                              ? "⌘"
                              : "⤳"}
                        </span>
                        <small>
                          {r.example ? "EXAMPLE" : "AI RECORD"} /{" "}
                          {String(i + 1).padStart(2, "0")}
                        </small>
                      </div>
                      <div className="card-body">
                        <span className="tag">
                          {r.type}
                          {r.example ? " · 예시" : ""}
                        </span>
                        <h3>
                          {r.title} <span>↗</span>
                        </h3>
                        <p>{r.summary}</p>
                      </div>
                    </button>
                  ))}
              </div>
              {!data.filter((r) => filter === "전체" || r.type === filter)
                .length && (
                <div className="empty">
                  <span>
                    {data.length
                      ? "이 분류에는 아직 공개 기록이 없습니다."
                      : "아직 첫 기록을 준비하고 있습니다."}
                  </span>
                  <p>게시한 작업만 이곳에 표시됩니다.</p>
                </div>
              )}
              <button className="example-card" onClick={() => open(example())}>
                <div>
                  <span className="tag">기능 예시 · 실제 성과 아님</span>
                  <h3>이벤트 정의서 검토 흐름</h3>
                  <p>분기와 재검토를 포함한 구조도를 미리 살펴보세요.</p>
                </div>
                <div className="mini-flow">
                  <span>정의서</span> → <span>검토</span> → <span>판단</span> ↗
                </div>
              </button>
            </section>
            <section id="approach" className="approach">
              <span className="eyebrow">HOW I WORK</span>
              <h2>
                도구보다 중요한 것은,
                <br />
                문제를 바라보는 방식.
              </h2>
              <div className="principles">
                {[
                  [
                    "01",
                    "문제를 먼저 정의합니다",
                    "무엇을 해결할지, 무엇으로 결과를 판단할지 정리합니다.",
                  ],
                  [
                    "02",
                    "역할과 선택을 드러냅니다",
                    "내가 설계하고 결정한 부분과 AI의 도움을 구분해 기록합니다.",
                  ],
                  [
                    "03",
                    "검증하고 다시 다듬습니다",
                    "잘된 결과뿐 아니라 한계와 수정 과정도 함께 남깁니다.",
                  ],
                ].map(([n, t, p]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="section-title">
                <h2>최근 기록</h2>
                <span className="eyebrow">LATEST ENTRIES</span>
              </div>
              {data.length ? (
                data
                  .slice(-4)
                  .reverse()
                  .map((r) => (
                    <button
                      className="recent"
                      key={r.id}
                      onClick={() => open(r)}
                    >
                      <span>{r.type}</span>
                      <strong>{r.title}</strong>
                      <span>↗</span>
                    </button>
                  ))
              ) : (
                <p className="muted">공개된 기록이 아직 없습니다.</p>
              )}
            </section>
            {(profile.contact || profile.links) && (
              <section className="contact">
                <h2>이야기를 이어가고 싶다면</h2>
                <p>{profile.contact}</p>
                <Links value={profile.links || ""} />
              </section>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>조창헌 포트폴리오</span>
        <span>생각하고, 만들고, 기록합니다.</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
