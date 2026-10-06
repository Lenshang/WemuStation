// SQLite-backed server storage: per-client save files, save states and the
// shared RetroArch configuration. One blob row per file path.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'wemu.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS blobs (
  ns   TEXT NOT NULL,             -- 'save' | 'state' | 'cfg'
  path TEXT NOT NULL,             -- virtual FS path, e.g. /saves/FCEUmm/x.srm
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  PRIMARY KEY (ns, path)
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const insStmt = db.prepare(
  'INSERT INTO blobs (ns, path, data, size, mtime) VALUES (?, ?, ?, ?, ?) ' +
  'ON CONFLICT(ns, path) DO UPDATE SET data=excluded.data, size=excluded.size, mtime=excluded.mtime'
);
const getStmt = db.prepare('SELECT data, mtime FROM blobs WHERE ns = ? AND path = ?');
const listStmt = db.prepare("SELECT path, mtime, size FROM blobs WHERE ns = ? ORDER BY path");
const delStmt = db.prepare('DELETE FROM blobs WHERE ns = ? AND path = ?');

export function putBlob(ns, p, data) {
  const now = Date.now();
  insStmt.run(ns, p, data, data.length, now);
  return now;
}

export function getBlob(ns, p) {
  const row = getStmt.get(ns, p);
  return row ? { path: p, data: row.data, mtime: row.mtime } : null;
}

export function listBlobs(ns) {
  return listStmt.all(ns);
}

export function deleteBlob(ns, p) {
  delStmt.run(ns, p);
}

export function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
