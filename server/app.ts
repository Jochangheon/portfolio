import express from "express";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, extname, posix } from "node:path";
import AdmZip from "adm-zip";
import { blank, type RecordData } from "../src/model.ts";
import type { Store } from "./store.ts";
const MAX = 10 * 1024 * 1024;
const textExt = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".css",
  ".html",
  ".sh",
  ".ini",
  ".xml",
]);
function valid(r: any): r is RecordData {
  return (
    r &&
    typeof r.title === "string" &&
    r.title.trim().length > 0 &&
    r.title.length <= 180 &&
    ["프로젝트", "실험 노트", "스킬·워크플로"].includes(r.type) &&
    ["직접 제작", "기존 자료를 수정", "외부 도입"].includes(r.origin) &&
    [
      "summary",
      "problem",
      "humanRole",
      "aiRole",
      "design",
      "validation",
      "limits",
      "links",
      "related",
      "source",
      "reason",
      "project",
    ].every((k) => typeof r[k] === "string" && r[k].length <= 100000) &&
    typeof r.example === "boolean" &&
    r.visibility &&
    ["description", "graph", "images", "downloads"].every(
      (k) => typeof r.visibility[k] === "boolean",
    ) &&
    ["assets", "nodes", "edges", "files", "fileEdges", "runs"].every(
      (k) => Array.isArray(r[k]) && r[k].length <= 500,
    ) &&
    r.assets.every((x: any) => typeof x === "string") &&
    [r.nodes, r.files].every(
      (ns) =>
        ns.every(
          (n: any) =>
            n &&
            ["id", "label", "kind", "role", "version", "source"].every(
              (k) => typeof n[k] === "string",
            ) &&
            ["파일에 명시", "작성자 확인", "추정"].includes(n.evidence) &&
            (n.text === undefined || typeof n.text === "string"),
        ) && new Set(ns.map((n: any) => n.id)).size === ns.length,
    ) &&
    [
      [r.nodes, r.edges],
      [r.files, r.fileEdges],
    ].every(([ns, es]) =>
      es.every(
        (e: any) =>
          e &&
          typeof e.id === "string" &&
          typeof e.label === "string" &&
          ["파일에 명시", "작성자 확인", "추정"].includes(e.evidence) &&
          ns.some((n: any) => n.id === e.source) &&
          ns.some((n: any) => n.id === e.target),
      ),
    ) &&
    r.runs.every(
      (x: any) =>
        x &&
        ["date", "skillVersion", "harnessVersion", "evidence", "result"].every(
          (k) => typeof x[k] === "string" && x[k].trim(),
        ),
    )
  );
}
function publicRecord(r: RecordData) {
  const p = structuredClone(r);
  if (!p.visibility.description)
    for (const k of [
      "summary",
      "problem",
      "humanRole",
      "aiRole",
      "design",
      "validation",
      "limits",
      "links",
      "related",
      "source",
    ] as const)
      p[k] = "";
  if (!p.visibility.graph) {
    p.nodes = [];
    p.edges = [];
    p.files = [];
    p.fileEdges = [];
    p.runs = [];
  }
  p.files = p.files.map((f) => ({
    ...f,
    text: f.publicText ? f.text : undefined,
  }));
  p.nodes = p.nodes.map((f) => ({
    ...f,
    text: f.publicText ? f.text : undefined,
  }));
  p.reason = "";
  return p;
}
export function createApp(
  store: Store,
  opts: {
    origin?: string;
    authenticate?: (req: express.Request) => boolean;
  } = {},
) {
  const app = express(),
    db = store.db,
    origin = opts.origin || process.env.APP_URL || "http://localhost:3000";
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    });
    next();
  });
  const cookie = (req: express.Request, name: string) =>
    req.headers.cookie
      ?.split("; ")
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1);
  const authenticated = (req: express.Request) =>
    opts.authenticate
      ? opts.authenticate(req)
      : !!db
          .prepare("SELECT id FROM sessions WHERE id=? AND expires>?")
          .get(cookie(req, "session") || "", Date.now());
  app.use("/api/admin", (req, res, next) => {
    if (!authenticated(req))
      return res.status(401).json({ error: "관리자 로그인이 필요합니다." });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      (req.headers.origin !== origin ||
        req.headers["x-requested-with"] !== "portfolio")
    )
      return res.status(403).json({ error: "요청 출처 확인 실패" });
    next();
  });
  app.get("/api/session", (req, res) =>
    res.json({
      admin: authenticated(req),
      configured: !!(
        process.env.GITHUB_CLIENT_ID &&
        process.env.GITHUB_CLIENT_SECRET &&
        process.env.ADMIN_GITHUB_ID
      ),
    }),
  );
  app.get("/auth/github", (req, res) => {
    if (
      !process.env.GITHUB_CLIENT_ID ||
      !process.env.GITHUB_CLIENT_SECRET ||
      !process.env.ADMIN_GITHUB_ID
    )
      return res
        .status(503)
        .send("GitHub OAuth와 ADMIN_GITHUB_ID 설정이 필요합니다.");
    const state = randomBytes(32).toString("hex");
    res.cookie("oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      maxAge: 600000,
      path: "/auth",
    });
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(origin + "/auth/callback")}&state=${state}`,
    );
  });
  app.get("/auth/callback", async (req, res) => {
    const state = cookie(req, "oauth_state");
    res.clearCookie("oauth_state", { path: "/auth" });
    if (
      !state ||
      typeof req.query.state !== "string" ||
      state.length !== req.query.state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(req.query.state)) ||
      typeof req.query.code !== "string"
    )
      return res.status(403).send("로그인 요청 확인 실패");
    try {
      const tr = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: req.query.code,
          redirect_uri: origin + "/auth/callback",
        }),
      });
      const token: any = await tr.json();
      if (!tr.ok || !token.access_token) throw Error();
      const ur = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/vnd.github+json",
        },
      });
      const u: any = await ur.json();
      if (
        !ur.ok ||
        String(u.id) !== process.env.ADMIN_GITHUB_ID ||
        u.login !== "Jochangheon"
      )
        return res.status(403).send("허용된 관리자 계정이 아닙니다.");
      const sid = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO sessions VALUES(?,?)").run(
        sid,
        Date.now() + 8 * 3600000,
      );
      res.cookie("session", sid, {
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "lax",
        maxAge: 8 * 3600000,
        path: "/",
      });
      res.redirect("/admin");
    } catch {
      res.status(502).send("GitHub 인증 연결 실패");
    }
  });
  app.post("/api/admin/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id=?").run(
      cookie(req, "session") || "",
    );
    res.clearCookie("session");
    res.json({ ok: true });
  });
  app.use(express.json({ limit: "64mb" }));
  const assetsFor = (r: RecordData) =>
    r.assets
      .map((id) =>
        db.prepare("SELECT id,name,mime,size FROM assets WHERE id=?").get(id),
      )
      .filter(
        (a: any) =>
          a &&
          (r.visibility.downloads ||
            (r.visibility.images && a.mime.startsWith("image/"))),
      );
  app.get("/api/records", (_req, res) =>
    res.json(
      store.list().map((r) => ({ ...publicRecord(r), assets: assetsFor(r) })),
    ),
  );
  app.get("/api/records/:id", (req, res) => {
    const r = store.get(req.params.id);
    res
      .status(r ? 200 : 404)
      .json(
        r
          ? { ...publicRecord(r), assets: assetsFor(r) }
          : { error: "기록을 찾을 수 없습니다." },
      );
  });
  app.get("/api/profile", (_req, res) => {
    const row: any = db
      .prepare("SELECT content FROM settings WHERE id=1")
      .get();
    res.json(
      row
        ? JSON.parse(row.content)
        : {
            intro: "AI로 문제를 풀고, 선택과 검증의 과정을 기록합니다.",
            contact: "",
            links: "",
          },
    );
  });
  app.put("/api/admin/profile", (req, res) => {
    const { intro, contact, links } = req.body;
    if (
      ![intro, contact, links].every(
        (x) => typeof x === "string" && x.length < 5000,
      )
    )
      return res.sendStatus(400);
    db.prepare(
      "INSERT INTO settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
    ).run(JSON.stringify({ intro, contact, links }));
    res.json({ ok: true });
  });
  app.get("/api/admin/assets", (_req, res) =>
    res.json(db.prepare("SELECT id,name,mime,size FROM assets").all()),
  );
  app.get("/api/admin/records", (_req, res) => res.json(store.list(true)));
  app.post("/api/admin/records", (req, res) => {
    if (!valid(req.body))
      return res.status(400).json({ error: "기록 필드와 관계를 확인하세요." });
    if (
      req.body.assets.some(
        (id: string) => !db.prepare("SELECT id FROM assets WHERE id=?").get(id),
      )
    )
      return res.status(400).json({ error: "첨부파일이 존재하지 않습니다." });
    res.json(store.save({ ...req.body, id: req.body.id || randomUUID() }));
  });
  app.get("/api/admin/versions/:id", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT * FROM versions WHERE record_id=? ORDER BY number DESC",
        )
        .all(req.params.id)
        .map((v: any) => ({ ...v, content: JSON.parse(v.content) })),
    ),
  );
  app.post("/api/admin/publish/:id", (req, res) => {
    const r = store.get(req.params.id, true);
    if (!r) return res.sendStatus(404);
    if (!r.reason.trim())
      return res.status(400).json({ error: "변경 이유를 입력하세요." });
    db.exec("BEGIN IMMEDIATE");
    try {
      const row: any = db
        .prepare("SELECT revision FROM records WHERE id=?")
        .get(r.id);
      const revision = row.revision + 1;
      db.prepare("INSERT INTO versions VALUES(?,?,?,?,?,?)").run(
        randomUUID(),
        r.id,
        revision,
        new Date().toISOString(),
        r.reason,
        JSON.stringify(r),
      );
      db.prepare("UPDATE records SET published=?,revision=? WHERE id=?").run(
        JSON.stringify(r),
        revision,
        r.id,
      );
      db.exec("COMMIT");
      res.json({ revision });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  app.post("/api/admin/unpublish/:id", (req, res) => {
    db.prepare("UPDATE records SET published=NULL WHERE id=?").run(
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/files/:id", (req, res) => {
    const a: any = db
      .prepare("SELECT * FROM assets WHERE id=?")
      .get(req.params.id);
    if (!a) return res.sendStatus(404);
    if (
      !authenticated(req) &&
      !store
        .list()
        .some(
          (r) =>
            r.assets.includes(a.id) &&
            (r.visibility.downloads ||
              (r.visibility.images && a.mime.startsWith("image/"))),
        )
    )
      return res.sendStatus(404);
    res.set({
      "Content-Type": a.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(readFileSync(join(store.dir, "files", a.id)));
  });
  app.post(
    "/api/admin/upload",
    express.raw({ type: "application/octet-stream", limit: MAX }),
    (req, res) => {
      try {
        const data = req.body;
        if (!Buffer.isBuffer(data) || !data.length) throw Error("빈 파일");
        const name = decodeURIComponent(
          String(req.headers["x-filename"] || ""),
        );
        if (!name || name.length > 180 || /[\\/\x00-\x1f]/.test(name))
          throw Error("파일 이름 오류");
        const ext = extname(name).toLowerCase();
        let mime = "application/octet-stream",
          analysis: any = {
            method: "기본 파일 분석 · AI 분석 아님",
            files: [],
            suggestions: [],
          };
        if (textExt.has(ext)) {
          mime = "text/plain";
          analysis.text = data.toString("utf8");
          if (data.includes(0))
            throw Error("텍스트 파일에 바이너리 데이터가 있습니다.");
        } else if (ext === ".zip") {
          const zip = new AdmZip(data);
          let size = 0;
          const es = zip.getEntries();
          if (es.length > 200) throw Error("ZIP 항목은 최대 200개입니다.");
          for (const e of es) {
            const n = e.entryName;
            if (
              n.startsWith("/") ||
              n.includes("\\") ||
              n.split("/").includes("..") ||
              /^[A-Za-z]:/.test(n) ||
              n.includes("\0") ||
              posix.normalize(n).startsWith("../")
            )
              throw Error("안전하지 않은 ZIP 경로");
            if (((e.attr >>> 16) & 0o170000) === 0o120000)
              throw Error("심볼릭 링크는 허용하지 않습니다.");
            size += e.header.size;
            if (
              size > 20 * 1024 * 1024 ||
              e.header.size > 2 * 1024 * 1024 ||
              e.header.size / Math.max(1, e.header.compressedSize) > 200
            )
              throw Error("압축 해제 크기 또는 압축률 제한 초과");
          }
          for (const e of es) {
            if (e.isDirectory) continue;
            const f: any = { path: e.entryName, size: e.header.size };
            if (textExt.has(extname(e.entryName).toLowerCase())) {
              const b = e.getData();
              if (b.length !== e.header.size) throw Error("ZIP 크기 불일치");
              f.text = b.toString("utf8");
            }
            analysis.files.push(f);
          }
          analysis.suggestions = analysis.files
            .filter((f: any) => f.path.endsWith("SKILL.md"))
            .map((f: any) => ({
              file: f.path,
              note: "스킬 진입점 후보 · 관계는 작성자 확인 필요",
              evidence: "추정",
            }));
        } else if (ext === ".pdf" && data.subarray(0, 5).toString() === "%PDF-")
          mime = "application/pdf";
        else if (
          ext === ".png" &&
          data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          mime = "image/png";
        else if (
          [".jpg", ".jpeg"].includes(ext) &&
          data[0] === 255 &&
          data[1] === 216 &&
          data[2] === 255
        )
          mime = "image/jpeg";
        else if (
          ext === ".webp" &&
          data.subarray(0, 4).toString() === "RIFF" &&
          data.subarray(8, 12).toString() === "WEBP"
        )
          mime = "image/webp";
        else if (ext === ".xlsx" && data.subarray(0, 2).toString() === "PK")
          mime =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        else if (
          ext === ".xls" &&
          data.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))
        )
          mime = "application/vnd.ms-excel";
        else throw Error("지원하지 않거나 형식이 일치하지 않는 파일입니다.");
        const id = randomUUID();
        writeFileSync(join(store.dir, "files", id), data, {
          mode: 0o600,
          flag: "wx",
        });
        db.prepare("INSERT INTO assets VALUES(?,?,?,?,?)").run(
          id,
          name,
          mime,
          data.length,
          JSON.stringify(analysis),
        );
        res.json({ id, name, mime, analysis });
      } catch (e) {
        res
          .status(400)
          .json({ error: e instanceof Error ? e.message : "업로드 실패" });
      }
    },
  );
  app.get("/api/admin/export", (_req, res) => {
    const records = store.list(true);
    res.json({
      format: "portfolio-v1",
      records,
      versions: db.prepare("SELECT * FROM versions").all(),
      assets: db
        .prepare("SELECT * FROM assets")
        .all()
        .map((a: any) => ({
          ...a,
          data: readFileSync(join(store.dir, "files", a.id)).toString("base64"),
        })),
    });
  });
  app.get("/api/admin/markdown/:id", (req, res) => {
    const r = store.get(req.params.id, true);
    if (!r) return res.sendStatus(404);
    res
      .type("text/markdown")
      .send(
        `# ${r.title}\n\n${r.summary}\n\n## 문제와 목표\n${r.problem}\n\n## 나의 역할\n${r.humanRole}\n\n## AI의 역할\n${r.aiRole}\n\n## 설계\n${r.design}\n\n## 검증\n${r.validation}\n\n## 한계\n${r.limits}\n\n<!-- portfolio-v1:${Buffer.from(JSON.stringify(r)).toString("base64")} -->`,
      );
  });
  app.post("/api/admin/import", (req, res) => {
    let records: any[] = req.body.records;
    if (typeof req.body.markdown === "string") {
      const m = req.body.markdown.match(
        /<!-- portfolio-v1:([A-Za-z0-9+/=]+) -->/,
      );
      try {
        records = m
          ? [JSON.parse(Buffer.from(m[1], "base64").toString())]
          : [
              {
                ...blank(),
                title: "가져온 Markdown",
                summary: req.body.markdown,
              },
            ];
      } catch {
        return res.sendStatus(400);
      }
    }
    if (
      !Array.isArray(records) ||
      records.length > 100 ||
      records.some((r) => !valid(r)) ||
      new Set(records.map((r) => r.id)).size !== records.length
    )
      return res
        .status(400)
        .json({ error: "올바른 기록 내보내기 파일이 아닙니다." });
    const assets = req.body.assets || [],
      versions = req.body.versions || [];
    if (
      !Array.isArray(assets) ||
      assets.length > 500 ||
      !Array.isArray(versions) ||
      versions.length > 2000
    )
      return res.sendStatus(400);
    const assetMap = new Map<string, string>(),
      recordMap = new Map<string, string>();
    for (const r of records) recordMap.set(r.id, randomUUID());
    const allowedMime = new Set([
      "text/plain",
      "application/octet-stream",
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]);
    if (
      assets.some(
        (a: any) =>
          !a ||
          typeof a.id !== "string" ||
          typeof a.name !== "string" ||
          /[\\/\x00-\x1f]/.test(a.name) ||
          !allowedMime.has(a.mime) ||
          typeof a.data !== "string" ||
          Buffer.from(a.data, "base64").length > MAX,
      ) ||
      versions.some(
        (v: any) =>
          !v ||
          !valid(JSON.parse(v.content || "null")) ||
          !recordMap.has(v.record_id) ||
          typeof v.reason !== "string" ||
          typeof v.created !== "string" ||
          !Number.isInteger(v.number),
      )
    )
      return res.status(400).json({ error: "백업 첨부 또는 버전 형식 오류" });
    // Imported bytes stay private and use an inert download type until reviewed.
    for (const a of assets) {
      const id = randomUUID();
      assetMap.set(a.id, id);
      const data = Buffer.from(a.data, "base64");
      writeFileSync(join(store.dir, "files", id), data, {
        mode: 0o600,
        flag: "wx",
      });
      db.prepare("INSERT INTO assets VALUES(?,?,?,?,?)").run(
        id,
        a.name,
        "application/octet-stream",
        data.length,
        JSON.stringify({ method: "백업에서 복원 · 형식 재검토 필요" }),
      );
    }
    const remap = (r: RecordData, id: string) => ({
      ...r,
      id,
      assets: r.assets
        .map((x) => assetMap.get(x))
        .filter((x): x is string => !!x),
    });
    db.exec("BEGIN IMMEDIATE");
    try {
      const saved = records.map((r) =>
        store.save({
          ...remap(r, recordMap.get(r.id)!),
          reason: "가져오기 · 비공개 초안",
        }),
      );
      for (const v of versions) {
        const id = recordMap.get(v.record_id)!;
        db.prepare("INSERT INTO versions VALUES(?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          v.number,
          v.created,
          v.reason,
          JSON.stringify(remap(JSON.parse(v.content), id)),
        );
      }
      for (const r of saved) {
        const row: any = db
          .prepare("SELECT MAX(number) AS n FROM versions WHERE record_id=?")
          .get(r.id);
        db.prepare("UPDATE records SET revision=? WHERE id=?").run(
          row.n || 0,
          r.id,
        );
      }
      db.exec("COMMIT");
      res.json({
        count: saved.length,
        note: "새 비공개 초안으로 가져왔습니다. JSON 백업의 첨부와 버전 이력은 보존됩니다. 복원 첨부는 다운로드 자료로 취급하며 게시 전 검토하세요.",
      });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API를 찾을 수 없습니다." }),
  );
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) =>
      res.status(err.status || 500).json({
        error:
          err.status === 413
            ? "요청 크기 제한 초과"
            : "처리 중 오류가 발생했습니다.",
      }),
  );
  return app;
}
