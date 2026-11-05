export type VersionReference = { recordId: string; version: number; role: string; note: string; title?: string };
export type NodeData = {
  id: string;
  label: string;
  kind: string;
  role: string;
  version: string;
  evidence: "파일에 명시" | "작성자 확인" | "추정";
  source: string;
  text?: string;
  publicText?: boolean;
};
export type EdgeData = {
  id: string;
  source: string;
  target: string;
  label: string;
  evidence: "파일에 명시" | "작성자 확인" | "추정";
};
export type RecordData = {
  id: string;
  title: string;
  type: "프로젝트" | "실험 노트" | "스킬·워크플로";
  project: string;
  example: boolean;
  summary: string;
  problem: string;
  humanRole: string;
  aiRole: string;
  design: string;
  validation: string;
  limits: string;
  links: string;
  related: string;
  origin: "직접 제작" | "기존 자료를 수정" | "외부 도입";
  source: string;
  reason: string;
  visibility: {
    description: boolean;
    graph: boolean;
    images: boolean;
    downloads: boolean;
  };
  relations?: VersionReference[];
  assets: string[];
  nodes: NodeData[];
  edges: EdgeData[];
  files: NodeData[];
  fileEdges: EdgeData[];
  runs: {
    references?: VersionReference[];
    date: string;
    skillVersion: string;
    harnessVersion: string;
    evidence: string;
    result: string;
  }[];
};
export const blank = (): RecordData => ({
  id: "",
  title: "",
  type: "프로젝트",
  project: "",
  example: false,
  summary: "",
  problem: "",
  humanRole: "",
  aiRole: "",
  design: "",
  validation: "",
  limits: "",
  links: "",
  related: "",
  origin: "직접 제작",
  source: "",
  reason: "첫 기록",
  visibility: {
    description: true,
    graph: false,
    images: false,
    downloads: false,
  },
  relations: [],
  assets: [],
  nodes: [],
  edges: [],
  files: [],
  fileEdges: [],
  runs: [],
});
export function example(): RecordData {
  const r = blank();
  r.id = "example";
  r.title = "이벤트 정의서 검토 흐름";
  r.example = true;
  r.type = "스킬·워크플로";
  r.summary =
    "누락을 검토하고 기준에 미달하면 수정하는 흐름입니다. 기능을 설명하기 위한 예시이며 실제 실행·성과 기록이 아닙니다.";
  r.humanRole = "검토 기준과 통과 조건을 설계하고 결과를 판단합니다.";
  r.aiRole = "누락 후보를 정리하고 수정안을 제안합니다.";
  r.visibility.graph = true;
  r.nodes = [
    "이벤트 정의서",
    "누락 검토",
    "기준 통과 여부",
    "보고서",
    "수정",
  ].map((label, i) => ({
    id: String(i),
    label,
    kind: i === 2 ? "판단" : "단계",
    role: label,
    version: "예시 v1",
    evidence: "작성자 확인",
    source: "설명용 예시",
  }));
  r.edges = [
    ["0", "1", "입력"],
    ["1", "2", "검토"],
    ["2", "3", "통과"],
    ["2", "4", "미통과"],
    ["4", "1", "수정 후 재검토"],
  ].map(([source, target, label], i) => ({
    id: String(i),
    source,
    target,
    label,
    evidence: "작성자 확인",
  }));
  return r;
}
