export type Relationship = { targetId: string; targetVersion?: number; kind: "uses" | "extends" | "tests" | "produces" | "related"; evidence: "confirmed" | "proposed"; note: string; title?: string };
export const relationshipLabels = { uses: "사용했어요", extends: "바꿨어요", tests: "확인했어요", produces: "만들었어요", related: "함께 봐요" };
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
  relationships?: Relationship[];
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
  relationships: [],
  relations: [],
  assets: [],
  nodes: [],
  edges: [],
  files: [],
  fileEdges: [],
  runs: [],
});
export function example():RecordData {
 const r=blank();r.id="example";r.example=true;r.type="스킬·워크플로";
 r.title="긴 글을 짧게 정리하는 AI 사용법";
 r.summary="긴 글을 넣으면 AI가 중요한 내용을 세 줄로 정리하도록 시키는 방법입니다. 이 글은 사이트를 읽는 방법을 보여주는 가상 예시입니다.";
 r.problem="긴 안내문에서 날짜와 준비물을 빨리 찾고 싶은 상황을 가정했습니다. 글이 짧아져도 꼭 필요한 내용은 빠지면 안 됩니다.";
 r.humanRole="이 예시에서는 사람이 ‘세 줄 안에 날짜와 준비물을 넣자’는 기준을 정하고, 원래 글과 비교해 빠진 내용이 있는지 확인합니다.";
 r.aiRole="AI는 긴 글에서 중요한 내용을 찾아 짧은 문장으로 바꾸는 일을 맡도록 설계했습니다.";
 r.design="1. 정리할 글을 넣습니다.\n2. AI에게 중요한 내용을 세 줄로 써 달라고 합니다.\n3. 사람이 원래 글과 비교합니다.\n4. 날짜나 준비물이 빠졌으면 다시 고칩니다.";
 r.validation="아직 실제로 실행한 기록은 없습니다. 읽는 방법을 보여주기 위해 만든 예시입니다.";
 r.limits="AI가 중요한 내용을 빼먹을 수 있으므로 원래 글과 비교하는 과정이 필요합니다.";
 r.visibility.graph=true;
 r.nodes=[["긴 글 넣기","정리할 안내문을 넣습니다."],["세 줄로 정리하기","AI에게 중요한 내용을 짧게 쓰도록 시킵니다."],["빠진 내용 확인하기","사람이 원래 글과 비교합니다."],["짧게 정리한 글","확인을 마친 글입니다."],["빠진 내용 다시 넣기","필요한 내용을 넣고 다시 확인합니다."]].map(([label,role],i)=>({id:String(i),label,kind:i===2?"사람이 확인":"진행 단계",role,version:"설명용 예시",evidence:"추정",source:"읽는 방법을 설명하기 위한 가상 예시"}));
 r.edges=[["0","1","글을 주면"],["1","2","정리한 뒤"],["2","3","빠진 내용이 없으면"],["2","4","빠진 내용이 있으면"],["4","2","다시 확인"]].map(([source,target,label],i)=>({id:String(i),source,target,label,evidence:"추정"}));
 return r;
}
