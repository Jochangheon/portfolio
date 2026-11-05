import {evidenceName} from "../copy";
import type { NodeData, EdgeData } from "../model";
export default function StructureEditor({
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
        각 항목에 이름과 하는 일을 적고, 어떤 순서로 이어지는지 연결해 주세요. 모르는 부분은 아직 확인이 필요하다고 표시할 수 있어요.
      </p>
      {nodes.map((n, i) => (
        <details key={n.id} className="panel">
          <summary>
            {n.label || "새 항목"} · {evidenceName(n.evidence)}
          </summary>
          {[
            ["label", "이름"],
            ["kind", "어떤 일을 하는 항목인가요?"],
            ["role", "쉬운 설명"],
            ["version", "당시에 쓴 내용의 이름이나 번호"],
            ["source", "어디에서 확인했나요?"],
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
            확인한 방법
            <select
              value={n.evidence}
              onChange={(e) => update(i, "evidence", e.target.value)}
            >
              {["파일에 명시", "작성자 확인", "추정"].map((x) => (
                <option key={x} value={x}>{evidenceName(x)}</option>
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
