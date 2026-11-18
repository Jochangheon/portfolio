# Codex 전체 작업 기록

사용자는 이 PC의 모든 Codex 작업을 본인의 포트폴리오에 비공개로 보관하도록 요청했다. 일반 작업마다 다시 허락을 묻지 않는다. 나중에 사용자가 특정 대화 제외, 중지, 삭제를 요청하면 그 지시를 우선한다.

## 저장하는 내용

- 작업이 끝날 때 사용자 요청과 AI 최종 답변을 날짜별 글로 저장한다. 대화별 폴더로 묶고 같은 대화의 앞선 작업과 연결한다.
- 이 기록은 AI가 당시 보고한 결과다. 실행 성공이나 성과를 별도로 검증했다고 표현하지 않는다.
- 사람에게 보이지 않는 내부 추론, 시스템·개발자 지시, 도구 출력, 원본 파일은 수집하지 않는다. 첨부 이미지 자체는 저장하지 않는다.
- 인증 관련 문장은 통째로 제외하고 이메일·로컬 경로를 가린다. 자동 가림이 모든 민감정보를 판단하는 것은 아니므로 공개하기 전에는 작성자가 검토한다.
- 모든 자동 기록은 비공개다. 게시·다운로드 공개·GitHub 업로드를 하지 않는다.
- 한 번 저장한 자동 기록은 다시 보내도 덮어쓰지 않는다. 사이트에서 추가한 메모와 제목은 보존된다.

## 설치와 동작

Python 3.11 이상에서 `scripts/install_capture.py`는 현재 사용자의 Codex 스킬과 `config.toml`의 전역 `notify` 명령을 설정한다. 기존 알림 명령은 보관하고 그대로 이어서 호출한다. 다른 설정과 승인 정책은 변경하지 않는다.

Codex가 `agent-turn-complete` 알림을 보내면 `codex_capture.py notify`가 실행된다. 설정을 읽은 이후의 새 대화에서 적용되며, 열려 있던 앱에는 다시 시작이 필요할 수 있다. 다른 PC·클라우드 환경에는 각각 설치와 인증이 필요하다. 완료 알림이 없는 강제 종료·진행 중 작업은 즉시 저장되지 않는다. `backfill`은 로컬 기록의 완료·중단 작업을 보충한다.

```text
python <skill-dir>/scripts/codex_capture.py status
python <skill-dir>/scripts/codex_capture.py flush
python <skill-dir>/scripts/codex_capture.py backfill
python <skill-dir>/scripts/install_capture.py --uninstall-notify
```

`status`의 saved는 서버가 접수를 확인한 수, pending은 아직 전송하지 못한 수다. 실패를 저장 완료로 표현하지 않는다. 대기열에는 가림 처리된 내용만 담으며 `$CODEX_HOME/portfolio-record/state.sqlite`에 저장한다. 전송 실패 시 다음 완료 알림이나 `flush`에서 재시도한다. 재시도마다 동일한 키를 사용해 중복 생성을 막는다.

과거 기록은 `sessions`, `archived_sessions`의 사용자 대화만 읽는다. 도우미·승인 검토 대화는 제외한다. 압축 기록에는 Python `zstandard`가 필요하다. 읽지 못한 파일 수를 보고한다. 형식이 바뀌면 수집을 추측하지 말고 파서를 수정·테스트한다.

토큰은 기존 포트폴리오 전용 연결 키를 Windows 자격 증명 관리자에서 읽는다. 키가 만료되면 관리자 설정에서 새 키를 발급하고 `portfolio.py configure`로 갱신한다. 비밀번호를 코드나 기록 파일에 쓰지 않는다.

## 사람이 읽기 좋은 정리

자동 보관은 빠짐없이 모으기 위한 자료다. 사용자가 정리·소개를 요청하면 저장된 내용으로 목적, 사람이 결정한 부분, AI가 한 일, 확인한 결과, 남은 일을 짧게 요약한다. 별도 프로젝트·스킬 설명 글은 기존 `portfolio.py`로 만들고 자동 보관 글과 연결한다. 대화 제목과 요청을 근거 없이 성과로 바꾸지 않는다.

근거: [Codex 공식 notify 문서](https://learn.chatgpt.com/docs/config-file/config-advanced#notifications).
