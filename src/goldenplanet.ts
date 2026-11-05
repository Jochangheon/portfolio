// Periods and customer aliases follow the career record dated 2024-11-13.
interface ClientProject {
  client: string;
  title: string;
  period: string;
  status?: "종료일 미기재" | "프로젝트 중단";
  role: string;
  result: string;
  casePath?: string;
}

export const clientProjects: ClientProject[] = [
  {
    client: "H’’", period: "2024.09 시작", status: "종료일 미기재",
    title: "뉴스 추천에 쓸 데이터 준비",
    role: "기사 추천 기능을 개선하기 위해 방문 기록이 제대로 모였는지 살펴보고, Google Analytics 4(GA4) 사용 문의에 답했습니다.",
    result: "추천 시스템인 Vertex AI가 학습할 수 있도록 데이터를 정리하고 분류했습니다."
  },
  {
    client: "H’", period: "2024.08 – 2024.10",
    title: "뉴스 독자가 어떤 경로로 이동했는지 분석",
    role: "기사 추천 서비스를 구축하는 과정에서 GA4 이용 기록을 다루는 방법에 관한 문의를 맡았습니다.",
    result: "BigQuery에서 SQL로 방문 기록을 시간순으로 연결해, 독자가 어떤 화면을 거쳤는지 볼 수 있게 했습니다."
  },
  {
    client: "큐텐(WISH+, 티몬)", period: "2024.06 시작", status: "프로젝트 중단",
    title: "쇼핑몰의 구매 과정 기록하기",
    role: "쇼핑몰에서 어떤 행동을 GA4에 기록할지 기획하고 수집되는 데이터를 검수했습니다.",
    result: "고객사 사정으로 구축이 중단됐습니다."
  },
  {
    client: "A", period: "2024.04 시작", status: "종료일 미기재",
    title: "방문 경로별 매출 기록 점검",
    role: "Google Analytics 360 운영을 지원하며 고객사의 질문에 답하고, 필요한 내용은 Google 지원팀에 문의했습니다.",
    result: "방문자가 어디를 통해 들어왔는지에 따라 매출을 나눠 보던 중 이상한 수치를 발견해 고객사에 알리고 조치했습니다."
  },
  {
    client: "B", period: "2024.04 – 2024.05",
    title: "항공사에 맞는 구매 기록 설계",
    role: "GA4를 새로 도입하는 항공사에서 구매 과정의 데이터가 계획대로 들어오는지 확인했습니다.",
    result: "항공사의 판매 방식에 맞춰 구매 정보를 수집하는 구조를 기획하고 분석했습니다."
  },
  {
    client: "C", period: "2024.02 – 2024.08",
    title: "교육 사이트의 이용 현황을 보는 화면 제작",
    role: "방문 기록을 어떻게 모을지 정하고 데이터를 검수했습니다. Figma로 화면을 설계하고 Looker Studio로 보고서를 만들었습니다.",
    result: "구현이 어렵다는 항목은 웹 코드 일부를 직접 살펴보고 개발팀에 수정을 요청했습니다."
  },
  {
    client: "D", period: "2023.10",
    title: "항공사 구매 데이터 검수",
    role: "GA4를 새로 구축하면서 구매 정보가 계획대로 기록되는지 확인했습니다.",
    result: "항공사의 구매 절차에 맞는 데이터 구조를 기획하고 분석했습니다."
  },
  {
    client: "E", period: "2023.09 – 2024.03",
    title: "부서별로 필요한 보고서 7종 제작",
    role: "GA4 수집 항목을 기획하고 검수했습니다. Figma로 화면을 설계하고, 구현 중 문제가 생긴 부분은 웹 코드를 확인해 수정을 요청했습니다.",
    result: "각 부서가 필요한 수치를 확인할 수 있도록 Looker Studio로 보고서 화면 7종을 만들었습니다.",
    casePath: "/projects/team-dashboards"
  },
  {
    client: "F", period: "2023.08",
    title: "안드로이드 앱의 구매 기록 전수 확인",
    role: "GA4에 들어오는 쇼핑 데이터를 검수했습니다.",
    result: "안드로이드 앱에서 수집하기로 한 데이터 항목을 하나씩 모두 확인했습니다."
  },
  {
    client: "G", period: "2023.07 시작", status: "종료일 미기재",
    title: "화면별 성과를 보는 사내 보고서 제작",
    role: "Google Analytics 360 운영을 지원하고, 사내에서 볼 보고서 화면을 만들었습니다.",
    result: "각 화면에서 어떤 수치를 살펴볼지 정리해 보고서에 담았습니다."
  },
  {
    client: "H", period: "2023.04 – 2023.11",
    title: "사이트 전체 화면을 정리해 이용 기록 설계",
    role: "GA4 수집을 기획하고 검수했으며 Looker Studio로 보고서를 만들었습니다.",
    result: "화면별 설명 문서가 없어 사이트의 전체 페이지를 살펴보고 페이지별 기획안을 따로 작성했습니다."
  },
  {
    client: "I", period: "2023.03 – 2023.09",
    title: "같은 행동이 여러 번 기록되는 문제 방지",
    role: "GA4 수집 항목을 설계하고 검수한 뒤 Looker Studio로 보고서 화면을 만들었습니다.",
    result: "초기 구축을 마치고 같은 행동이 지나치게 중복 기록되는 것을 방지했습니다. 2024년 말 업데이트도 논의했습니다."
  },
  {
    client: "J", period: "2023.03 시작", status: "종료일 미기재",
    title: "이메일 서비스의 이용 현황을 매주 분석",
    role: "Google Analytics 360 운영을 지원하며 방문 기록과 고객사가 보유한 외부 데이터를 함께 분석했습니다.",
    result: "이메일 서비스의 이용 현황을 정리해 매주 분석 보고서를 발행했습니다."
  },
  {
    client: "K", period: "2023.01 – 2023.07",
    title: "방문 기록 수집부터 보고서까지 구축",
    role: "GA4로 모을 데이터를 기획하고 검수한 뒤 Looker Studio로 보고서 화면을 만들었습니다.",
    result: "초기 구축을 마쳤고, 2024년 초에는 추가 업데이트를 진행했습니다."
  }
];
