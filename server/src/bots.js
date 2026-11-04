// Боты Kosmo: простое HTTP API в духе Telegram.
//   GET/POST /api/bot/<токен>/getMe
//   GET/POST /api/bot/<токен>/getUpdates?offset=N&timeout=30   (long polling)
//   POST     /api/bot/<токен>/sendMessage { chat_id, text, reply_to? }
// Бот — обычный аккаунт с флагом bot (без почты и входа), токен — его сессия.

import { EventEmitter } from 'node:events';
import { sql, users, chats, rateLimit, tx } from './db.js';
import { ApiError, createSession, sessionByToken, deleteSession, sessionsOf, newId } from './auth.js';
import { applyPatches } from './sync.js';

sql.exec(`
  CREATE TABLE IF NOT EXISTS bot_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS bot_updates_bot ON bot_updates(bot_id, id);
`);

const bus = new EventEmitter();
bus.setMaxListeners(0);
const botIds = new Set(sql.prepare("SELECT id FROM users WHERE json_extract(data, '$.bot') = 1").all().map((r) => r.id));
export const isBot = (id) => botIds.has(id);
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9]{3,32}$/;

/* ---------- Управление ботами (владелец) ---------- */
export function createBot(ownerId, name, username) {
  const clean = String(name ?? '').trim().slice(0, 64);
  const uname = String(username ?? '').toLowerCase();
  if (!clean) throw new ApiError(400, 'bad_name', 'Name is required');
  // ник бота заканчивается на bot, как в Telegram
  if (!USERNAME_RE.test(uname) || !uname.endsWith('bot')) throw new ApiError(400, 'bad_username', 'Bot username must end with “bot”');
  if (users.usernameTaken(uname)) throw new ApiError(409, 'username_taken', 'This username is taken');
  if (myBots(ownerId).length >= 20) throw new ApiError(400, 'too_many', 'Up to 20 bots per account');
  const id = newId();
  const now = Date.now();
  const data = {
    name: clean, username: uname, bio: '', createdAt: now, role: 'user', publicId: users.nextPublicId(),
    avatar: { color: null, text: '', photo: null }, chatPrefs: {}, privacy: {}, messages: [], settings: {}, security: {},
    bot: true, botOwner: ownerId,
  };
  tx(() => sql.prepare('INSERT INTO users (id, email, username, pass_hash, pass_salt, data, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)')
    .run(id, uname, '', '', JSON.stringify(data), now));
  botIds.add(id);
  const s = createSession(id, { device: { name: 'Bot API', type: 'desktop' }, trusted: true });
  return { id, name: clean, username: uname, token: s.token };
}

export function myBots(ownerId) {
  return users.all().filter((u) => u.bot && u.botOwner === ownerId).map((u) => ({ id: u.id, name: u.name, username: u.username }));
}

function ownBot(ownerId, botId) {
  const b = users.get(botId);
  if (!b?.bot || b.botOwner !== ownerId) throw new ApiError(404, 'not_found', 'Bot not found');
  return b;
}

export function newToken(ownerId, botId) {
  ownBot(ownerId, botId);
  for (const s of sessionsOf(botId)) deleteSession(s.id);
  return createSession(botId, { device: { name: 'Bot API', type: 'desktop' }, trusted: true }).token;
}

export function deleteBot(ownerId, botId) {
  ownBot(ownerId, botId);
  tx(() => {
    sql.prepare('DELETE FROM bot_updates WHERE bot_id = ?').run(botId);
    sql.prepare('DELETE FROM users WHERE id = ?').run(botId);
  });
  botIds.delete(botId);
}

/* ---------- Входящие для ботов ---------- */
// Вызывается при каждом изменении чата: новые сообщения людей — ботам-участникам
export function noteMessages(patch, before, after) {
  if (!after || !patch.msgs?.up?.length) return;
  const bots = after.members.filter(isBot);
  if (!bots.length) return;
  const known = new Set((before?.messages ?? []).map((m) => m.id));
  for (const m of patch.msgs.up) {
    if (known.has(m.id) || isBot(m.from)) continue;
    const from = users.get(m.from);
    const msg = {
      message_id: m.id, date: Math.floor(m.at / 1000), kind: m.kind ?? 'text', text: m.text ?? m.caption ?? '',
      chat: { id: after.id, type: after.type ?? 'private', title: after.name ?? null },
      from: { id: m.from, name: from?.name ?? '', username: from?.username ?? '' },
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    };
    for (const b of bots) {
      if (b === m.from) continue;
      sql.prepare('INSERT INTO bot_updates (bot_id, data, at) VALUES (?, ?, ?)').run(b, JSON.stringify({ message: msg }), Date.now());
      bus.emit(b);
    }
  }
}

/* ---------- API бота ---------- */
export function botByToken(token) {
  const s = sessionByToken(token);
  if (!s || !isBot(s.userId)) throw new ApiError(401, 'bad_token', 'Invalid bot token');
  if (!rateLimit(`botapi:${s.userId}`, 120, 60_000)) throw new ApiError(429, 'too_many', 'Too many requests');
  return users.get(s.userId);
}

export function getMe(bot) {
  return { id: bot.id, name: bot.name, username: bot.username, is_bot: true };
}

export async function getUpdates(bot, offset = 0, timeout = 0) {
  // старые (подтверждённые offset) обновления больше не нужны
  if (offset) sql.prepare('DELETE FROM bot_updates WHERE bot_id = ? AND id < ?').run(bot.id, offset);
  const read = () => sql.prepare('SELECT id, data FROM bot_updates WHERE bot_id = ? AND id >= ? ORDER BY id LIMIT 100').all(bot.id, offset)
    .map((r) => ({ update_id: r.id, ...JSON.parse(r.data) }));
  let list = read();
  const wait = Math.min(50, Math.max(0, Number(timeout) || 0));
  if (!list.length && wait) {
    await new Promise((resolve) => {
      const done = () => { clearTimeout(t); bus.off(bot.id, done); resolve(); };
      const t = setTimeout(done, wait * 1000);
      bus.on(bot.id, done);
    });
    list = read();
  }
  return list;
}

export function sendMessage(bot, { chat_id: chatId, text, reply_to: replyTo }) {
  const body = String(text ?? '').trim();
  if (!body) throw new ApiError(400, 'bad_text', 'Text is required');
  let id = String(chatId ?? '').trim();
  // можно указать и пользователя (внутренний id, ID из профиля или @username) — тогда это личный чат с ботом
  const who = users.get(id) ?? users.all().find((u) => !u.bot && (String(u.publicId) === id || (u.username && `@${u.username}` === id.toLowerCase()) || (u.username && u.username === id.toLowerCase())));
  if (who) id = [bot.id, who.id].sort().join('_');
  const c = chats.get(id);
  if (!c && !who) throw new ApiError(404, 'chat_not_found', 'Chat not found. Use chat.id from getUpdates, a user ID or @username');
  if (c && !c.members.includes(bot.id)) throw new ApiError(403, 'not_member', 'The bot is not a member of this chat');
  const m = { id: newId(), at: Date.now(), from: bot.id, kind: 'text', text: body.slice(0, 4000), ...(replyTo ? { replyTo: String(replyTo) } : {}) };
  const patch = c
    ? { col: 'chats', id, op: 'put', msgs: { up: [m], del: [] } }
    : { col: 'chats', id, op: 'put', set: { id, members: id.split('_'), read: {} }, msgs: { up: [m], del: [] } };
  const [r] = applyPatches(bot.id, [patch]);
  if (!r.ok) throw new ApiError(403, r.error, r.message);
  return { message_id: m.id, chat: { id }, date: Math.floor(m.at / 1000), text: m.text };
}
