import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RecordData } from "../src/model.ts";
export function createStore(dir: string) {
  mkdirSync(join(dir, "files"), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, "portfolio.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,draft TEXT NOT NULL,published TEXT, revision INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,number INTEGER NOT NULL,created TEXT NOT NULL,reason TEXT NOT NULL,content TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,analysis TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_attempts(ip TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts(ip);
 CREATE TABLE IF NOT EXISTS integration_tokens(id TEXT PRIMARY KEY,label TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,created INTEGER NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,last_used INTEGER);
 CREATE TABLE IF NOT EXISTS ingestions(source_key TEXT PRIMARY KEY,record_id TEXT NOT NULL,last_hash TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY,content TEXT NOT NULL);`);
  return {
    db,
    dir,
    list(admin = false) {
      return db
        .prepare(
          admin
            ? "SELECT id,draft,published,revision FROM records"
            : "SELECT id,published FROM records WHERE published IS NOT NULL",
        )
        .all()
        .map((row: any) =>
          admin
            ? {
                ...JSON.parse(row.draft),
                published: !!row.published,
                revision: row.revision,
              }
            : JSON.parse(row.published),
        );
    },
    get(id: string, admin = false): RecordData | undefined {
      const row: any = db.prepare("SELECT * FROM records WHERE id=?").get(id);
      return (
        row &&
        (admin
          ? JSON.parse(row.draft)
          : row.published
            ? JSON.parse(row.published)
            : undefined)
      );
    },
    save(record: RecordData) {
      record.id ||= randomUUID();
      db.prepare(
        "INSERT INTO records(id,draft) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET draft=excluded.draft",
      ).run(record.id, JSON.stringify(record));
      return record;
    },
  };
}
export type Store = ReturnType<typeof createStore>;
