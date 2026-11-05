import { RecordCards, ExampleLink } from "./RecordsPage";
import Links from "../components/Links";
export default function HomePage({records, profile}: {records: any[]; profile: any}) { return <>
<section className="hero">
              <div className="hero-layout">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="dot" /> AI × HUMAN JUDGMENT
                  </div>
                  <h1>
                    AI와 함께 만들고,
                    <br />
                    <span>나의 판단을 기록합니다.</span>
                  </h1>
                  <p>{profile.intro}</p>
                  <a className="button primary" href="/records">
                    기록 살펴보기 <span>↘</span>
                  </a>
                </div>
                <div
                  className="hero-map"
                  aria-label="기록의 구성: 문제 정의, 나의 판단, AI와 작업, 결과 검증"
                >
                  <div className="map-caption">
                    <span>FROM QUESTION TO EVIDENCE</span>
                    <span>↗</span>
                  </div>
                  <div className="map-step">
                    <span>01</span>
                    <div>
                      <small>QUESTION</small>
                      <strong>어떤 문제를 풀었나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step map-highlight">
                    <span>02</span>
                    <div>
                      <small>MY DECISION</small>
                      <strong>무엇을 직접 판단했나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step">
                    <span>03</span>
                    <div>
                      <small>COLLABORATION</small>
                      <strong>AI와 어떻게 만들었나</strong>
                    </div>
                    <span>↓</span>
                  </div>
                  <div className="map-step">
                    <span>04</span>
                    <div>
                      <small>EVIDENCE</small>
                      <strong>어떻게 확인하고 개선했나</strong>
                    </div>
                    <span>↗</span>
                  </div>
                  <p>결과물에, 선택의 이유를 더합니다.</p>
                </div>
              </div>
              <div className="hero-note">
                <span>01 / ARCHIVE</span>
                <span>결과 너머, 그 과정까지.</span>
              </div>
            </section>

<section><div className="section-title"><h2>대표 프로젝트</h2><a href="/records/projects">프로젝트 전체 보기 →</a></div>
<RecordCards records={records.filter(r => r.type === "프로젝트").slice(-3).reverse()}/>
{!records.some(r=>r.type==="프로젝트") && <p className="empty">아직 첫 기록을 준비하고 있습니다.</p>}
</section>
<section><div className="section-title"><h2>최근 기록</h2><a href="/records">모든 기록 →</a></div><RecordCards records={records.slice(-3).reverse()}/><ExampleLink/></section>
<section className="approach"><span className="eyebrow">HOW I WORK</span><h2>결과 너머, 선택과 검증까지.</h2><p>문제를 정의하고, 사람과 AI의 역할을 나누고, 근거로 결과를 확인합니다.</p><a href="/approach">작업 방식 살펴보기 →</a></section>
{(profile.contact || profile.links) && <section className="contact"><h2>이야기를 이어가고 싶다면</h2><p>{profile.contact}</p><Links value={profile.links || ""}/></section>}
</>; }
