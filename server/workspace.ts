import type express from "express";
import { randomUUID } from "node:crypto";
import type { Store } from "./store.ts";
import { blank } from "../src/model.ts";
import type { Note } from "../src/workspace.ts";

export function noteFor(store: Store, id: string): Note | undefined {
  const row: any = store.db.prepare("SELECT * FROM workspace_notes WHERE record_id=?").get(id);
  return row && {folderId:row.folder_id, body:row.body, pinned:!!row.pinned, archived:!!row.archived, updated:row.updated, version:row.version};
}
export function registerWorkspace(app: express.Express, store: Store) {
  const db = store.db;
  const folders = () => db.prepare("SELECT id,name,parent_id AS parentId FROM workspace_folders ORDER BY name,id").all();
  const folderExists = (id: unknown) => id === null || (typeof id === "string" && !!db.prepare("SELECT id FROM workspace_folders WHERE id=?").get(id));
  app.get("/api/admin/workspace", (_req, res) => {
    const pages = store.list(true).map(r => {
      const note = noteFor(store, r.id)!;
      const text = [note.body, r.summary, r.problem, r.humanRole, r.aiRole, r.design, r.validation, r.links].join("\n");
      return {id:r.id, title:r.title, type:r.type, published:r.published, revision:r.revision,
        folderId:note.folderId, pinned:note.pinned, archived:note.archived, updated:note.updated,
        excerpt:(note.body || r.summary || r.design).slice(0, 160),
        searchText:[r.title,r.type,r.project,text].join("\n").toLocaleLowerCase()};
    });
    res.json({folders:folders(), pages});
  });
  app.post("/api/admin/workspace/folders", (req, res) => {
    const {name, parentId = null} = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.length > 80 || !folderExists(parentId))
      return res.status(400).json({error:"폴더 이름과 위치를 확인해 주세요."});
    let ancestor: any = parentId, depth = 0;
    while (ancestor) { ancestor = (db.prepare("SELECT parent_id FROM workspace_folders WHERE id=?").get(ancestor) as any)?.parent_id; depth++; }
    if (depth >= 8) return res.status(400).json({error:"폴더는 8단계까지 만들 수 있습니다."});
    const id = randomUUID();
    db.prepare("INSERT INTO workspace_folders VALUES(?,?,?)").run(id,name.trim(),parentId);
    res.json({id,name:name.trim(),parentId});
  });
  app.patch("/api/admin/workspace/folders/:id", (req, res) => {
    const name = req.body?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      return res.status(400).json({error:"폴더 이름을 80자 이내로 적어 주세요."});
    const result = db.prepare("UPDATE workspace_folders SET name=? WHERE id=?").run(name.trim(),req.params.id as string);
    res.status(result.changes ? 200 : 404).json({ok:!!result.changes});
  });
  app.post("/api/admin/workspace/pages", (req, res) => {
    const {folderId = null, type = "실험 노트"} = req.body || {};
    if (!folderExists(folderId) || !["프로젝트","실험 노트","스킬·워크플로"].includes(type))
      return res.status(400).json({error:"폴더와 기록 종류를 확인해 주세요."});
    const record = {...blank(), title:"제목 없는 기록", type, visibility:{description:false,graph:false,images:false,downloads:false}};
    db.exec("BEGIN IMMEDIATE");
    try {
      store.save(record);
      db.prepare("UPDATE workspace_notes SET folder_id=? WHERE record_id=?").run(folderId,record.id);
      db.exec("COMMIT");
      res.json({id:record.id});
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  });
  app.get("/api/admin/workspace/pages/:id", (req, res) => {
    const id = req.params.id as string, record = store.get(id,true);
    if (!record) return res.status(404).json({error:"기록을 찾을 수 없습니다."});
    const status: any = db.prepare("SELECT published,revision FROM records WHERE id=?").get(id);
    res.json({record,note:noteFor(store,id),published:!!status.published,revision:status.revision,
      assets:record.assets.map(asset=>db.prepare("SELECT id,name,mime,size,analysis FROM assets WHERE id=?").get(asset)).filter(Boolean)});
  });
  app.put("/api/admin/workspace/pages/:id", (req, res) => {
    const id = req.params.id as string, r = store.get(id,true);
    if (!r) return res.status(404).json({error:"기록을 찾을 수 없습니다."});
    const b = req.body || {};
    if (!Number.isInteger(b.version) || typeof b.title !== "string" || !b.title.trim() || b.title.length > 180 ||
      typeof b.body !== "string" || b.body.length > 100000 || typeof b.links !== "string" || b.links.length > 100000 ||
      !["프로젝트","실험 노트","스킬·워크플로"].includes(b.type) || !folderExists(b.folderId) ||
      typeof b.pinned !== "boolean" || typeof b.archived !== "boolean" ||
      !Array.isArray(b.assets) || b.assets.length > 500 || b.assets.some((id: unknown)=>typeof id !== "string" || !db.prepare("SELECT id FROM assets WHERE id=?").get(id)))
      return res.status(400).json({error:"제목, 메모, 폴더와 첨부파일을 확인해 주세요. 메모는 10만 자까지 저장할 수 있습니다."});
    db.exec("BEGIN IMMEDIATE");
    try {
      if (noteFor(store,id)?.version !== b.version) {
        db.exec("ROLLBACK");
        return res.status(409).json({error:"다른 화면에서 이 기록을 수정했습니다. 현재 글을 복사하거나 내려받은 뒤 최신 내용을 다시 열어 주세요."});
      }
      store.save({...r,title:b.title.trim(),type:b.type,links:b.links,assets:[...new Set<string>(b.assets)]});
      db.prepare("UPDATE workspace_notes SET folder_id=?,body=?,pinned=?,archived=? WHERE record_id=?")
        .run(b.folderId,b.body,Number(b.pinned),Number(b.archived),id);
      db.exec("COMMIT");
      res.json(noteFor(store,id));
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  });
}

export function validWorkspaceBackup(value: any, recordIds: Set<string>): boolean {
  if (value === undefined) return true;
  if (!value || !Array.isArray(value.folders) || value.folders.length > 1000 ||
      !Array.isArray(value.notes) || value.notes.length > 1000) return false;
  const id = (v: any) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  if (value.folders.some((f:any)=>!f || !id(f.id) || typeof f.name!=="string" || !f.name.trim() || f.name.length>80) ||
      new Set(value.folders.map((f:any)=>f.id)).size!==value.folders.length ||
      new Set(value.notes.map((n:any)=>n?.record_id)).size!==value.notes.length) return false;
  const folderMap = new Map<string,any>(value.folders.map((f:any)=>[f.id,f]));
  for (const folder of value.folders) {
    const seen = new Set<string>();
    let current: any = folder;
    while (current) {
      if (seen.has(current.id) || seen.size>=8) return false;
      seen.add(current.id);
      if (current.parent_id === null) break;
      if (!id(current.parent_id) || !folderMap.has(current.parent_id)) return false;
      current = folderMap.get(current.parent_id);
    }
  }
  return value.notes.every((n:any)=>n && recordIds.has(n.record_id) &&
    (n.folder_id===null || folderMap.has(n.folder_id)) && typeof n.body==="string" && n.body.length<=100000 &&
    [0,1].includes(n.pinned) && [0,1].includes(n.archived) && typeof n.updated==="string" && n.updated.length<=40);
}
export function restoreWorkspace(store: Store, value: any, recordMap: Map<string,string>) {
  if (!value) return;
  const folderMap = new Map<string,string>();
  const insertFolder = (oldId: string): string => {
    if (folderMap.has(oldId)) return folderMap.get(oldId)!;
    const f = value.folders.find((item:any)=>item.id===oldId);
    const parentId = f.parent_id===null ? null : insertFolder(f.parent_id);
    const id = randomUUID();
    store.db.prepare("INSERT INTO workspace_folders VALUES(?,?,?)").run(id,f.name,parentId);
    folderMap.set(oldId,id);
    return id;
  };
  for (const folder of value.folders) insertFolder(folder.id);
  for (const note of value.notes) store.db.prepare("UPDATE workspace_notes SET folder_id=?,body=?,pinned=?,archived=?,updated=? WHERE record_id=?")
    .run(note.folder_id===null?null:folderMap.get(note.folder_id)!,note.body,note.pinned,note.archived,note.updated,recordMap.get(note.record_id)!);
}
