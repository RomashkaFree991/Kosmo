// База данных — SQLite-файл на сервере (встроенный в Node модуль node:sqlite).
// Документы (пользователи, чаты, посты, истории) хранятся как JSON,
// служебное (сессии, коды, медиа) — обычными колонками.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(path.join(config.dataDir, 'media'), { recursive: true });

export const sql = new DatabaseSync(path.join(config.dataDir, 'kosmo.db'));
sql.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    username TEXT,
    pass_hash TEXT NOT NULL,
    pass_salt TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(username) WHERE username IS NOT NULL AND username <> '';

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS codes (
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL,
    PRIMARY KEY (phone, purpose)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    public INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    PRIMARY KEY (chat_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS chat_members_user ON chat_members(user_id);

  CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL);

  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
`);

export const json = (s) => (s == null ? null : JSON.parse(s));

// Небольшая обёртка: транзакция
export function tx(fn) {
  sql.exec('BEGIN');
  try {
    const r = fn();
    sql.exec('COMMIT');
    return r;
  } catch (e) {
    sql.exec('ROLLBACK');
    throw e;
  }
}

/* ---------- Пользователи ---------- */
export const users = {
  get(id) {
    const r = sql.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return r ? { ...json(r.data), id: r.id, phone: r.phone } : null;
  },
  row(id) { return sql.prepare('SELECT * FROM users WHERE id = ?').get(id); },
  byPhone(phone) {
    const r = sql.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    return r ? this.get(r.id) : null;
  },
  all() {
    return sql.prepare('SELECT id, phone, data FROM users').all().map((r) => ({ ...json(r.data), id: r.id, phone: r.phone }));
  },
  usernameTaken(name, exceptId) {
    if (!name) return false;
    if (sql.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(name, exceptId ?? '')) return true;
    return Boolean(sql.prepare("SELECT 1 FROM chats WHERE json_extract(data, '$.username') = ? AND id <> ?").get(name, exceptId ?? ''));
  },
  save(user) {
    const { id, phone, ...rest } = user;
    sql.prepare('UPDATE users SET data = ?, username = ?, phone = ? WHERE id = ?').run(JSON.stringify(rest), rest.username || null, phone, id);
  },
  count() { return sql.prepare('SELECT COUNT(*) AS n FROM users').get().n; },
  nextPublicId() {
    const r = sql.prepare("SELECT MAX(CAST(json_extract(data, '$.publicId') AS INTEGER)) AS m FROM users").get();
    return String((r.m ?? 0) + 1);
  },
};

/* ---------- Чаты ---------- */
export const chats = {
  get(id) {
    const r = sql.prepare('SELECT data FROM chats WHERE id = ?').get(id);
    return r ? json(r.data) : null;
  },
  forUser(uid) {
    return sql.prepare(`
      SELECT c.data FROM chats c WHERE c.id IN (SELECT chat_id FROM chat_members WHERE user_id = ?) OR c.public = 1
    `).all(uid).map((r) => json(r.data));
  },
  save(chat) {
    const pub = (chat.type === 'group' || chat.type === 'channel') && chat.username ? 1 : 0;
    sql.prepare('INSERT INTO chats (id, data, public, updated) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, public = excluded.public, updated = excluded.updated')
      .run(chat.id, JSON.stringify(chat), pub, Date.now());
    sql.prepare('DELETE FROM chat_members WHERE chat_id = ?').run(chat.id);
    const ins = sql.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)');
    for (const m of chat.members ?? []) ins.run(chat.id, m);
  },
  remove(id) { sql.prepare('DELETE FROM chats WHERE id = ?').run(id); },
  all() { return sql.prepare('SELECT data FROM chats').all().map((r) => json(r.data)); },
};

/* ---------- Посты и истории ---------- */
function docTable(table) {
  return {
    get(id) { const r = sql.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id); return r ? json(r.data) : null; },
    all() { return sql.prepare(`SELECT data FROM ${table} ORDER BY at`).all().map((r) => json(r.data)); },
    save(doc) {
      sql.prepare(`INSERT INTO ${table} (id, data, at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, at = excluded.at`)
        .run(doc.id, JSON.stringify(doc), doc.at ?? Date.now());
    },
    remove(id) { sql.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); },
  };
}
export const posts = docTable('posts');
export const stories = docTable('stories');

/* ---------- Ограничение частоты ---------- */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const r = sql.prepare('SELECT count, reset FROM rate WHERE key = ?').get(key);
  if (!r || r.reset < now) {
    sql.prepare('INSERT OR REPLACE INTO rate (key, count, reset) VALUES (?, 1, ?)').run(key, now + windowMs);
    return true;
  }
  if (r.count >= limit) return false;
  sql.prepare('UPDATE rate SET count = count + 1 WHERE key = ?').run(key);
  return true;
}
