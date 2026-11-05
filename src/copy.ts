export const typeNames: Record<string,string> = {"프로젝트":"만든 것","실험 노트":"해보고 배운 것","스킬·워크플로":"AI 사용법"};
export const typeDescriptions: Record<string,string> = {
 "프로젝트":"웹사이트, 문서, 도구처럼 실제로 만든 결과물을 소개합니다.",
 "실험 노트":"여러 방법을 비교하고, 잘 안되는 점을 고치면서 배운 것을 적습니다.",
 "스킬·워크플로":"다음에도 AI에게 같은 일을 시킬 수 있도록 적어 둔 설명서입니다."
};
export const typeName=(value:string)=>typeNames[value]||value;
export const roleName=(value:string)=>({"스킬":"AI에게 줄 지침","하네스":"일을 진행하는 순서","관련 실험":"확인해 본 방법","결과물":"만든 결과"} as Record<string,string>)[value]||value;
export const evidenceName=(value:string)=>({"파일에 명시":"자료에서 확인","작성자 확인":"직접 확인","추정":"아직 확인이 필요해요"} as Record<string,string>)[value]||value;
export const shortText=(value:string="",limit=140)=>value.length>limit?value.slice(0,limit).trimEnd()+"…":value;
