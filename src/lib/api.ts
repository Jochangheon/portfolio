export async function api(path: string, method = "GET", body?: any) {
  if (window.__PORTFOLIO_PREVIEW__) {
    const snapshot = window.__PORTFOLIO_PREVIEW__;
    if (method !== "GET")
      throw Error("화면 확인용 미리보기에서는 저장할 수 없습니다.");
    if (path === "/records") return snapshot.records;
    if (path === "/profile") return snapshot.profile;
    if (path === "/session") return { admin: false, configured: false };
    if (path.startsWith("/records/")) {
      const record = snapshot.records.find(
        (r) => r.id === decodeURIComponent(path.slice(9)),
      );
      if (record) return record;
    }
    throw Error("미리보기에 포함되지 않은 기록입니다.");
  }
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "portfolio",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "요청 실패");
  return d;
}
