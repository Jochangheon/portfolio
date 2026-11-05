export default function ApproachPage() { return (
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
); }
