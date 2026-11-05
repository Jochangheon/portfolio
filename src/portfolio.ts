// Source snapshot: Changheon's public Notion portfolio, updated 2024-11-13.

export interface Project {
  slug: string;
  title: string;
  context: string;
  period: string;
  summary: string;
  story: [string, string][];
  tools?: string[];
  video?: string;
}

export const projects: Project[] = [
  {
    slug: "team-dashboards",
    title: "부서별로 다른 숫자를 보여주는 보고서",
    context: "골든플래닛 · 고객사 E",
    period: "2023.09 – 2024.03",
    summary: "웹사이트 이용 기록을 모아 각 부서가 자기 업무에 필요한 숫자를 한눈에 볼 수 있는 보고서 7종을 만들었습니다.",
    story: [
      ["어떤 일이 필요했나요?", "고객사는 웹사이트에서 일어나는 일을 새로 기록하고, 부서별로 그 결과를 볼 수 있는 화면이 필요했습니다."],
      ["내가 한 일", "어떤 행동을 기록할지 정하고 실제로 데이터가 잘 들어오는지 검사했습니다. Figma로 보고서 화면을 설계하고, 개발 중 문제가 생긴 부분은 웹 코드를 확인해 수정을 요청했습니다."],
      ["완성한 것", "방문자의 행동을 기록하는 Google Analytics 4를 바탕으로, Looker Studio에서 부서별 보고서 화면 7종을 만들었습니다."]
    ],
    tools: ["Google Analytics 4", "Figma", "Looker Studio"]
  },
  {
    slug: "welfare-search",
    title: "여러 곳에 흩어진 복지 정책을 한곳에서 찾기",
    context: "동북권 공공데이터 해커톤 · 팀장",
    period: "2022.09.29 – 2022.10.01",
    summary: "같은 지역의 지원 사업도 안내 사이트가 제각각이었습니다. 여러 기관의 정책을 모아 질문으로 찾아볼 수 있는 서비스를 팀으로 만들었습니다.",
    story: [
      ["왜 만들었나요?", "어떤 복지 제도가 있는지 모르면 검색할 말조차 떠올리기 어렵습니다. 지역 주민이 사이트를 하나씩 방문하지 않아도 필요한 정책을 찾도록 돕고 싶었습니다."],
      ["내가 한 일", "팀장으로 아이디어를 기획하고 발표했습니다. 정책 안내를 자동으로 모으는 코드를 짜고, 모은 글을 정리해 검색 기능을 구현했습니다."],
      ["결과", "팀은 사흘 동안 질문을 입력해 정책을 찾는 서비스를 만들었고, 동북권 공공데이터 활용 해커톤에서 최우수상(1위)을 받았습니다."]
    ],
    tools: ["Python", "Scrapy", "TensorFlow"]
  },
  {
    slug: "insurance-claims",
    title: "자동차보험 청구에서 다시 살펴볼 건 찾기",
    context: "데이터 청년 캠퍼스 · 팀장",
    period: "2022.07 – 2022.08",
    summary: "건강보험심사평가원과 함께 자동차보험 청구 기록을 분석했습니다. 평소와 다른 양상을 보이는 건을 일찍 찾아 심사를 돕는 프로젝트였습니다.",
    story: [
      ["왜 만들었나요?", "많은 청구 기록 가운데 추가 검토가 필요한 사례를 먼저 찾으면 심사 담당자가 어디부터 살펴볼지 판단할 수 있습니다."],
      ["내가 한 일", "팀장으로 담당자와 만나 필요한 내용을 듣고 진행 상황을 발표했습니다. 데이터를 정리하고 비교할 항목을 고른 뒤, 특이한 패턴을 찾는 프로그램을 Python으로 작성했습니다."],
      ["결과", "팀이 만든 자동차보험 청구 분석 프로젝트로 건강보험심사평가원장상을 받았습니다."]
    ],
    tools: ["Python", "scikit-learn"]
  },
  {
    slug: "campus-map",
    title: "처음 온 사람을 위한 영남대 길찾기 앱",
    context: "영남대학교 컴퓨터공학과 · 졸업작품",
    period: "2022.04 – 2022.10",
    summary: "학교 홈페이지에서 건물 위치를 찾아도 어떻게 걸어가야 할지 알기 어려웠습니다. 그 불편에서 출발한 교내 지도 앱 ‘찾아 YU’입니다.",
    story: [
      ["왜 만들었나요?", "홈페이지에서는 건물을 찾을 수 있었지만, 거기까지 가는 길과 이동 시간은 따로 알려주지 않았습니다. 학생과 방문객 모두가 겪을 수 있는 불편이었습니다."],
      ["어떻게 만들었나요?", "졸업작품으로 캠퍼스 지도 앱을 제작했습니다. 앱 화면을 Figma로 설계하고 Android Studio를 사용했습니다. 길을 찾는 데에는 여러 경로를 비교하는 A* 알고리즘을 활용했습니다."]
    ],
    tools: ["Android Studio", "Figma", "Python"]
  },
  {
    slug: "department-film",
    title: "영상으로 만나는 영남대 컴퓨터공학과",
    context: "영남대학교 · 학과 홍보",
    period: "2021",
    summary: "컴퓨터공학과 3학년의 과제 생활을 소재로 한 학과 소개 영상입니다. 영남대학교 채널에서 완성된 영상을 볼 수 있습니다.",
    story: [
      ["어떤 영상인가요?", "‘컴퓨터공학과 과제에 묻힌 컴공3학년’이라는 제목으로 대학 생활을 소개하는 영상입니다. 아래에서 영남대학교가 공개한 영상을 볼 수 있습니다."]
    ],
    video: "https://www.youtube.com/watch?v=PF_ge8LBu5E"
  }
];

export const projectPath = (project: Project) => "/projects/" + project.slug;
