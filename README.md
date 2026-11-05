# 조창헌 개인 포트폴리오

AI 프로젝트 · 실험 노트 · 스킬과 워크플로를 기록하는 한국어 포트폴리오입니다. 기존 React/TypeScript/Express/SQLite 코드를 이어서 구현했습니다. 실제 경력·성과 수치는 임의로 넣지 않습니다.

## 페이지와 실행

| 주소 | 화면 |
| --- | --- |
| / | 소개와 대표 프로젝트 |
| /records | 전체 공개 기록 |
| /records/projects | 프로젝트 |
| /records/experiments | 실험 노트 |
| /records/workflows | 스킬·워크플로 |
| /records/:id | 공개 상세 |
| /approach | 작업 방식 |
| /examples/workflow | 실제 성과가 아닌 기능 예시 |
| /admin | 관리자 기록 목록 |
| /admin/records/new | 새 기록 |
| /admin/records/:id/edit | 저장된 초안 편집 |
| /admin/records/:id/preview | 서버가 공개 범위를 적용한 미리보기 |

각 페이지는 별도 소스 모듈을 사용하고 실제 URL 경로로 이동합니다. 링크 복사, 새로고침, 뒤로가기를 지원합니다. 예전 `?record=...` 주소는 상세 경로로 리디렉션합니다. 존재하지 않거나 비공개인 기록은 운영 서버에서도 404입니다.

Node.js 24 이상:

```sh
npm ci
cp .env.example .env
npm run dev
# 운영 빌드
npm run build
npm start
```

서버는 기본 127.0.0.1:3000에 바인딩합니다. 실제 외부 공개 시 HTTPS reverse proxy를 사용합니다. `DATA_DIR`은 영구 디스크 경로이며 웹 공개 폴더에 두면 안 됩니다.

## 관리자 인증

두 방식 중 설정된 방식을 사용할 수 있습니다.

- 관리자 비밀번호: `ADMIN_PASSWORD_HASH`에 scrypt salt:hash를 설정합니다. 로그인 시 평문 비밀번호를 저장하지 않습니다. 15분에 IP별 5회 실패 제한, HttpOnly/SameSite 쿠키, HTTPS Secure, 8시간 세션, 서버 Origin 검사를 사용합니다. 관리자 화면에서 비밀번호를 바꾸면 기존 세션이 모두 폐기됩니다.
- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_GITHUB_ID=88309559` 설정. callback은 `APP_URL/auth/callback`. GitHub가 반환한 숫자 ID와 Jochangheon 로그인 이름을 함께 검사합니다. GitHub 연결 도구의 저장소 인증과 웹사이트 OAuth는 서로 별개입니다.

서버 환경변수와 비밀번호는 Git에 저장하지 않습니다. 테스트 인증 대체 함수는 테스트에서만 주입하며 운영 환경변수로 인증을 우회할 수 없습니다.

## 등록 → 미리보기 → 게시

1. 새 기록에서 분류와 제목을 입력합니다.
2. 파일 첨부, 텍스트 붙여넣기, GitHub·배포 링크를 등록합니다.
3. 하네스 노드/연결 관계, 스킬 파일 구성, 관련 기록의 게시 버전을 선택합니다.
4. 문제와 목표, 나의 판단, AI 역할, 핵심 설계, 검증 결과, 한계, 제작 구분과 출처를 작성합니다.
5. 설명 / 구조도 / 결과 이미지 / 원본 다운로드 공개 여부를 각각 선택합니다.
6. 미리보기로 이동하면 초안이 서버에 저장되고 공개 API와 동일한 필터로 표시됩니다. 다시 게시하기 전까지 기존 공개본은 유지됩니다.

원본은 기본 비공개입니다. `/api/files/:id`는 원본 다운로드 권한, `/api/images/:id`는 결과 이미지 공개 권한을 별도로 검사합니다. 이미지를 공개하면 표시되는 이미지 바이트 자체는 방문자가 저장할 수 있습니다. 원본 다운로드 버튼과 다른 첨부파일 접근은 별도입니다. 비공개 전환은 매 요청 검사에 즉시 반영됩니다.

게시마다 스냅샷과 변경 이유를 보존합니다. 관련 기록·실행 기록은 실제 저장된 기록 ID와 게시 버전 번호를 참조합니다. 실행을 등록할 때 스킬 또는 하네스의 보존된 버전을 선택해야 합니다. 기록의 이후 변경은 기존 참조 버전을 바꾸지 않습니다. 비공개 대상 연결은 공개 응답에서 제거하며, 공개 연결의 링크는 현재 공개본으로 이동합니다. 과거 버전 전체 원문은 관리자만 볼 수 있습니다.

구조도는 노드·관계 입력 폼으로 편집합니다. 클릭해서 역할, 버전, 근거를 확인합니다. 위치는 자동 배치이며 드래그 위치 저장은 지원하지 않습니다. 파일 등록을 실행으로 간주하지 않습니다. 실행 확인은 작성자가 입력한 근거이며 자동 실행 증명은 아닙니다.

## 업로드 · 백업

파일당 10 MiB. Markdown, 텍스트, 코드·설정, ZIP, PDF, XLS/XLSX, PNG/JPEG/WebP를 지원합니다. 텍스트 내용을 확인하고 편집할 수 있으며 원본 파일은 별도로 보존합니다. ZIP은 경로와 내부 텍스트를 살펴보고 관계를 제안합니다. 제안은 추정으로 표시합니다. ZIP은 항목 수 200개, 총 비압축 20 MiB, 항목당 2 MiB, 압축률 200배 제한을 적용하며 경로 이탈과 심볼릭 링크를 차단합니다. 업로드 코드를 실행하거나 AI 환경에 스킬을 설치하지 않습니다.

PDF·엑셀·이미지는 첨부 보관합니다. AI 분석·악성코드 검사 서비스는 연결하지 않았습니다. 원문은 React의 텍스트 렌더링을 사용합니다.

관리자 JSON 내보내기는 초안, 게시 버전 이력, 파일 바이트를 포함합니다. 가져오기는 새 비공개 초안과 새 파일 ID를 만들며 관계의 기록 ID도 다시 연결합니다. 기존 기록을 덮어쓰지 않습니다. 복원 첨부는 검토 전까지 안전한 다운로드 형식으로 저장합니다. 완전한 백업은 JSON 또는 `DATA_DIR` 전체를 사용하세요. Markdown 내보내기는 단일 기록 본문과 메타데이터이며 파일 바이트는 포함하지 않습니다. 요청 크기 제한은 64 MiB입니다.

## 검증

```sh
npm test
npm run build
npm run build:preview
npx playwright install --with-deps chromium
npm run test:browser
npm run test:frontend
```

API 테스트는 관리자/CSRF 차단, 원본과 이미지 권한 분리, 미리보기와 공개 응답 일치, 불변 버전과 실제 버전 참조, 백업/복원, 재접속 지속성, 업로드 검증, 비밀번호 인증·제한을 검사합니다. 브라우저 테스트는 URL 경로, 직접 접근·새로고침·뒤로가기, 관리자 등록·파일 업로드·미리보기·게시·초안 분리·게시 중단, 모바일 너비를 확인합니다. 테스트용 자료는 임시 DB에만 생성합니다.

## 배포 구조

이번 서버용 설정은 `deploy/`에 있습니다.

- 소스: `/srv/portfolio-ai-records/source`
- 영구 데이터와 원본: `/srv/portfolio-ai-records/data`
- 전용 Node 런타임: `/srv/portfolio-ai-records/runtime`
- 비밀 환경변수: `/etc/portfolio-ai-records/app.env`
- 앱 서비스: `portfolio.service`, 비특권 사용자 `portfolio-ai`, 내부 127.0.0.1:3120
- 공개 프록시: Nginx 전용 8443 포트
- IP HTTPS 인증서: 별도 Certbot 환경, `portfolio-cert-renew.timer` 자동 갱신 및 Nginx reload

최초 비밀번호는 서버의 관리자 전용 `/etc/portfolio-ai-records/initial-password` 파일에 있습니다. 로그인 후 관리자 화면에서 변경할 수 있습니다. 기존 서비스와 기존 `/opt/portfolio/index.html`은 별도로 유지합니다.

일반 서버는 Dockerfile로도 실행할 수 있습니다. Docker 컨테이너의 `/data`에 영구 볼륨을 연결하세요. Docker 빌드는 위 Node/브라우저 테스트와 별개 검증입니다.

## 정적 미리보기

`npm run build:site`는 다중 경로 HTML과 공통 assets를 `site/`에 생성합니다. **폴더 전체**가 필요하며 index.html 한 개로 배포하지 않습니다. 정적 미리보기는 로그인·서버 저장 기능이 없습니다. 실제 앱은 Node 서버와 영구 저장소를 함께 실행해야 합니다.

GitHub Actions 워크플로는 같은 테스트를 수행하도록 제공됩니다. 실제 실행 결과와 배포 여부는 해당 커밋의 Actions 결과 및 작업 보고를 확인하세요.
