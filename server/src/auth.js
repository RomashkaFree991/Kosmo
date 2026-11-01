// Вход: код на почту → «билет» на почту → код-пароль → сессия.
// (Код по номеру — та же схема, оставлена для будущего входа по телефону.)
// Коды и пароли хранятся только в виде хешей. Токен сессии — случайные
// 32 байта, в базе лежит его SHA-256.

import crypto from 'node:crypto';
import { sql, users, json, rateLimit } from './db.js';
import { config } from './config.js';
import { sendCode } from './sms.js';
import { codeMail } from './mailer.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const newId = () => crypto.randomUUID();
const CODE_TTL = 5 * 60_000;
const TICKET_TTL = 15 * 60_000;

export class ApiError extends Error {
  constructor(status, code, message, extra) { super(message ?? code); this.status = status; this.code = code; this.extra = extra; }
}

export const normPhone = (p) => {
  const d = String(p ?? '').replace(/\D/g, '');
  if (d.length < 6 || d.length > 15) throw new ApiError(400, 'bad_phone', 'Invalid phone number');
  return `+${d}`;
};
const EMAIL_RE = /^[^\s@]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
export const normEmail = (e) => {
  const v = String(e ?? '').trim().toLowerCase();
  if (v.length > 254 || !EMAIL_RE.test(v)) throw new ApiError(400, 'bad_email', 'Invalid email address');
  return v;
};
// для проверки: адреса …@kosmo.test и номера +000… — код всегда 000000, ничего не отправляется
const isTest = (t) => config.testNumbers && (t.startsWith('+000') || t.endsWith('@kosmo.test'));
const isEmail = (t) => t.includes('@');

/* ---------- Коды подтверждения ---------- */
export async function startCode(target, purpose, ip) {
  const phone = target;
  // тестовые номера SMS не тратят — для них только мягкий лимит по IP
  if (isTest(phone)) {
    if (!rateLimit(`ip-test:${ip}`, 120, 3_600_000)) throw new ApiError(429, 'too_many', 'Too many requests, try later');
  } else {
    if (!rateLimit(`ip:${ip}`, 20, 3_600_000)) throw new ApiError(429, 'too_many', 'Too many requests, try later');
    const prev = sql.prepare('SELECT sent_at FROM codes WHERE target = ? AND purpose = ?').get(phone, purpose);
    if (prev && Date.now() - prev.sent_at < 55_000) throw new ApiError(429, 'wait', 'Wait a minute before requesting a new code');
    if (!rateLimit(`to:${phone}`, 6, 3_600_000)) throw new ApiError(429, 'too_many', isEmail(phone) ? 'Too many codes for this email' : 'Too many codes for this number');
  }
  let info = {};
  const code = isTest(phone) ? '000000' : String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  if (!isTest(phone)) {
    try {
      if (isEmail(phone)) { await codeMail(phone, code, purpose); info = { channel: 'email' }; }
      else info = (await sendCode(phone, code)) ?? {};
    } catch (e) {
      console.error(isEmail(phone) ? '[mail]' : '[sms]', phone, e.message);
      throw new ApiError(502, 'send_failed', 'Could not send the code, try later');
    }
  }
  sql.prepare('INSERT OR REPLACE INTO codes (target, purpose, code_hash, expires, attempts, sent_at) VALUES (?, ?, ?, ?, 0, ?)')
    .run(phone, purpose, sha(`${phone}:${code}`), Date.now() + CODE_TTL, Date.now());
  return info;
}

export function checkCode(phone, purpose, code) {
  const r = sql.prepare('SELECT * FROM codes WHERE target = ? AND purpose = ?').get(phone, purpose);
  if (!r || r.expires < Date.now()) throw new ApiError(400, 'code_expired', 'The code has expired, request a new one');
  if (r.attempts >= 5) throw new ApiError(429, 'too_many', 'Too many attempts, request a new code');
  if (sha(`${phone}:${String(code).trim()}`) !== r.code_hash) {
    sql.prepare('UPDATE codes SET attempts = attempts + 1 WHERE target = ? AND purpose = ?').run(phone, purpose);
    throw new ApiError(400, 'wrong_code', 'Wrong code');
  }
  sql.prepare('DELETE FROM codes WHERE target = ? AND purpose = ?').run(phone, purpose);
  const id = crypto.randomBytes(24).toString('hex');
  sql.prepare('INSERT INTO tickets (id, target, purpose, expires) VALUES (?, ?, ?, ?)').run(id, phone, purpose, Date.now() + TICKET_TTL);
  return id;
}

export function useTicket(id, purpose, consume = true) {
  const r = sql.prepare('SELECT * FROM tickets WHERE id = ?').get(String(id ?? ''));
  if (!r || r.purpose !== purpose || r.expires < Date.now()) throw new ApiError(401, 'bad_ticket', 'Verification expired, start again');
  if (consume) sql.prepare('DELETE FROM tickets WHERE id = ?').run(r.id);
  return r.target;
}

/* ---------- Код-пароль (4 цифры) ---------- */
export function hashPass(code, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(code), salt, 32).toString('hex') };
}
// 3 неверных попытки подряд — ввод код-пароля закрыт на 5 минут (на всех устройствах).
// Неверный код — ошибка wrong_passcode с числом оставшихся попыток.
const PASS_TRIES = 3;
const PASS_LOCK = 5 * 60_000;
const lockedError = (until) => new ApiError(429, 'passcode_locked', 'Too many wrong passcodes. Try again later', { retryAt: until });

export function verifyPass(userId, code) {
  const r = users.row(userId);
  if (!r?.pass_hash) return false;   // у ботов нет код-пароля
  const key = `passfail:${userId}`;
  const now = Date.now();
  const fail = sql.prepare('SELECT count, reset FROM rate WHERE key = ?').get(key);
  const fails = fail && fail.reset > now ? fail.count : 0;
  if (fails >= PASS_TRIES) throw lockedError(fail.reset);
  const { hash } = hashPass(code, r.pass_salt);
  if (crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(r.pass_hash, 'hex'))) {
    sql.prepare('DELETE FROM rate WHERE key = ?').run(key);
    return true;
  }
  const n = fails + 1;
  sql.prepare('INSERT OR REPLACE INTO rate (key, count, reset) VALUES (?, ?, ?)').run(key, n, now + PASS_LOCK);
  if (n >= PASS_TRIES) throw lockedError(now + PASS_LOCK);
  throw new ApiError(401, 'wrong_passcode', 'Wrong passcode', { left: PASS_TRIES - n });
}
export function setPass(userId, code) {
  if (!/^\d{4}$/.test(String(code))) throw new ApiError(400, 'bad_passcode', 'Passcode must be 4 digits');
  const { salt, hash } = hashPass(code);
  sql.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').run(hash, salt, userId);
}

/* ---------- Сессии ---------- */
export function createSession(userId, { device, ip, location, trusted }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = newId();
  const now = Date.now();
  const data = {
    name: String(device?.name ?? 'Browser').slice(0, 60),
    type: ['phone', 'tablet', 'desktop'].includes(device?.type) ? device.type : 'desktop',
    ip: ip ?? 'Unknown',
    location: String(location ?? 'Unknown').slice(0, 80),
    trusted: Boolean(trusted),
    first: false,
  };
  sql.prepare('INSERT INTO sessions (id, user_id, token_hash, data, created_at, last_active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, sha(token), JSON.stringify(data), now, now);
  return { token, sid: id, session: { id, ...data, createdAt: now, lastActive: now } };
}

export function sessionByToken(token) {
  if (!token) return null;
  const r = sql.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha(token));
  return r ? { id: r.id, userId: r.user_id, ...json(r.data), createdAt: r.created_at, lastActive: r.last_active } : null;
}

export function sessionsOf(userId) {
  return sql.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at').all(userId)
    .map((r) => ({ id: r.id, ...json(r.data), createdAt: r.created_at, lastActive: r.last_active }));
}

export function updateSession(id, fn) {
  const r = sql.prepare('SELECT data FROM sessions WHERE id = ?').get(id);
  if (!r) return;
  const d = json(r.data);
  fn(d);
  sql.prepare('UPDATE sessions SET data = ? WHERE id = ?').run(JSON.stringify(d), id);
}

export const touchSession = (id) => sql.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(Date.now(), id);
export const deleteSession = (id) => sql.prepare('DELETE FROM sessions WHERE id = ?').run(id);

/* ---------- Что видят другие (с учётом приватности) ---------- */
export function project(user, viewerId) {
  if (!user) return null;
  const sessions = sessionsOf(user.id);
  if (user.id === viewerId) return { ...user, sessions };
  const p = user.privacy ?? {};
  const lastActive = Math.max(0, ...sessions.map((s) => s.lastActive));
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? '',
    bio: p.hideBio ? '' : user.bio ?? '',
    avatar: p.avatar === 'nobody' ? { ...(user.avatar ?? {}), photo: null } : user.avatar ?? {},
    publicId: user.publicId,
    role: user.role,
    official: Boolean(user.official),
    premium: Boolean(user.premium),
    bot: Boolean(user.bot),
    // статус «эмодзи + текст» до времени until
    status: user.status && (!user.status.until || user.status.until > Date.now()) ? user.status : null,
    createdAt: user.createdAt,
    // почта скрыта, пока человек сам не откроет её в приватности
    email: p.showEmail ? user.email : '',
    phone: '',
    privacy: {
      showEmail: Boolean(p.showEmail), hideBio: Boolean(p.hideBio), lastSeen: p.lastSeen, avatar: p.avatar,
      messages: p.messages, groups: p.groups, readReceipts: p.readReceipts, findByEmail: p.findByEmail,
      blocked: (p.blocked ?? []).includes(viewerId) ? [viewerId] : [],
    },
    sessions: p.lastSeen === 'nobody' ? [] : [{ lastActive }],
    messages: [],
    chatPrefs: {},
  };
}

// Системное сообщение в чат «Kosmo» пользователя
export function kosmoMessage(userId, msg) {
  const u = users.get(userId);
  if (!u) return;
  u.messages = [...(u.messages ?? []), { id: newId(), at: Date.now(), ...msg }].slice(-200);
  users.save(u);
}
