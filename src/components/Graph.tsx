import { useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {evidenceName} from "../copy";
import type { NodeData, EdgeData } from "../model";
export default function Graph({ nodes, edges }: { nodes: NodeData[]; edges: EdgeData[] }) {
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
            label: e.label,
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
            {selected.kind} · {evidenceName(selected.evidence)}
          </small>
          <h3>{selected.label}</h3>
          <p>{selected.role}</p>
          <details className="detail-drawer"><summary>자료와 당시 내용 확인하기</summary><p>
            당시 내용: {selected.version || "미지정"} · 근거:{" "}
            {selected.source || "아직 적지 않았어요"}
          </p></details>
          {edges
            .filter((e) => e.source === selected.id || e.target === selected.id)
            .map((e) => (
              <p key={e.id}>
                {nodes.find((n) => n.id === e.source)?.label} →{" "}
                {nodes.find((n) => n.id === e.target)?.label}: {e.label} (
                {evidenceName(e.evidence)})
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
