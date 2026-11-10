// Push-уведомления (Web Push): сообщения и звонки, когда Kosmo закрыт.
// Ключи VAPID создаются при первом запуске (DATA_DIR/vapid.json). Подписки
// браузеров — в таблице push_subs, по одной на устройство (сеанс).

import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { config } from './config.js';
import { sql, users } from './db.js';

sql.exec(`CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL
); CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id);`);

function vapid() {
  const file = path.join(config.dataDir, 'vapid.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* создадим */ }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}
const KEYS = vapid();
const host = (() => { try { return new URL(config.publicUrl).hostname; } catch { return 'localhost'; } })();
webpush.setVapidDetails(`mailto:${config.mailFrom || `admin@${host}`}`, KEYS.publicKey, KEYS.privateKey);

export const pushKey = () => KEYS.publicKey;

export function subscribe(uid, sid, sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  sql.prepare('INSERT OR REPLACE INTO push_subs (endpoint, user_id, session_id, data, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(sub.endpoint, uid, sid, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }), Date.now());
  return true;
}
export const unsubscribeSession = (sid) => sql.prepare('DELETE FROM push_subs WHERE session_id = ?').run(sid);
export const unsubscribe = (endpoint) => sql.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(String(endpoint ?? ''));

export function pushTo(uid, payload) {
  // устройства с завершённым сеансом не получают уведомлений
  sql.prepare('DELETE FROM push_subs WHERE user_id = ? AND session_id NOT IN (SELECT id FROM sessions)').run(uid);
  const subs = sql.prepare('SELECT endpoint, data FROM push_subs WHERE user_id = ?').all(uid);
  for (const s of subs) {
    webpush.sendNotification(JSON.parse(s.data), JSON.stringify(payload), { TTL: payload.t === 'call' ? 45 : 3600, urgency: 'high', topic: String(payload.tag ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined })
      .catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(s.endpoint); });
  }
}

// Текст уведомления о сообщении
const KIND = { photo: '📷 Photo', video: '📹 Video', voice: '🎤 Voice message', round: '📹 Video message', sticker: 'Sticker', poll: '📊 Poll', todo: '✅ Checklist', location: '📍 Location', file: '📎 File', album: '🖼 Album', call: '📞 Call' };
function preview(m) {
  if (m.kind === 'emoji') return String(m.emoji ?? '');
  const t = String(m.text ?? m.caption ?? '').trim();
  if (t && !t.startsWith('e1:')) return t.slice(0, 180);
  return KIND[m.kind] ?? 'New message';
}

// Новые сообщения → push тем участникам, у кого Kosmo сейчас закрыт
export function pushMessages(patch, before, after, isOnline) {
  if (!after || !patch.msgs?.up?.length) return;
  const known = new Set((before?.messages ?? []).map((m) => m.id));
  const fresh = patch.msgs.up.filter((m) => !known.has(m.id) && !m.silent);
  if (!fresh.length) return;
  const room = after.type === 'group' || after.type === 'channel';
  for (const m of fresh.slice(-3)) {
    const from = users.get(m.from);
    for (const uid of after.members ?? []) {
      if (uid === m.from || isOnline(uid)) continue;
      const u = users.get(uid);
      if (!u || u.bot) continue;
      const n = u.settings?.notify ?? {};
      const kind = after.type === 'channel' ? 'channels' : after.type === 'group' ? 'groups' : 'private';
      if (n[kind] === false || (u.settings?.dnd ?? 0) > Date.now()) continue;
      const title = room ? String(after.name ?? 'Kosmo') : String(from?.name ?? 'Kosmo');
      const body = `${room && after.type === 'group' ? `${from?.name ?? ''}: ` : ''}${n.preview === false ? 'New message' : preview(m)}`;
      pushTo(uid, { t: 'msg', title, body, tag: after.id, chat: after.id });
    }
  }
}
