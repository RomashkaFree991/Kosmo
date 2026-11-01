// Сквозное шифрование Kosmo. Сервер хранит и пересылает только шифротекст.
//
//  • У каждого пользователя пара ключей ECDH P-256. Закрытый ключ живёт на
//    его устройствах (IndexedDB). На сервер уходит только публичный ключ и
//    резервная копия закрытого, зашифрованная ключом восстановления, который
//    знает лишь сам человек (PBKDF2 → AES-GCM).
//  • Личный чат: общий ключ двух людей (ECDH → HKDF → AES-GCM 256).
//  • Группа и закрытый канал: случайный ключ группы, для каждого участника
//    зашифрованный общим ключом «автор ↔ участник» (поле ekeys чата).
//  • Шифруются строки сообщений (текст, подписи, цитаты, опросы, списки,
//    геопозиция, расшифровка голосовых), ключи файлов, сами файлы, черновики
//    и закладки. Формат строки: «e1:» + base64(iv | шифротекст).
//  • Публичные группы и каналы (с @username) открыты всем — их не шифруем.

import { db } from './core.js';

const te = new TextEncoder();
const td = new TextDecoder();
export const SEALED = 'e1:';
export const isSealed = (s) => typeof s === 'string' && s.startsWith(SEALED);

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* ---------------------------------------------------------------------------
   Хранилище ключей на устройстве
   --------------------------------------------------------------------------- */
let idbP = null;
function idb() {
  idbP ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('kosmo-e2ee', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return idbP;
}
const idbDo = (mode, fn) => idb().then((d) => new Promise((resolve, reject) => {
  const t = d.transaction('keys', mode);
  const req = fn(t.objectStore('keys'));
  t.oncomplete = () => resolve(req?.result);
  t.onerror = () => reject(t.error);
}));

let me = null;
let keys = null;   // { priv, privJwk, pubJwk }
const cache = new Map();   // ключи чатов
export const mediaKeys = new Map();   // id файла → { key (b64), mime }

export const e2eeReady = () => Boolean(keys);
export const myPub = () => keys?.pubJwk ?? null;

export async function fingerprint(pub) {
  if (!pub?.x) return '';
  const h = await crypto.subtle.digest('SHA-256', te.encode(`${pub.x}.${pub.y}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function importPriv(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
const importPub = (jwk) => crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

export async function loadKeys(uid) {
  me = uid;
  keys = null;
  cache.clear();
  const saved = await idbDo('readonly', (s) => s.get(uid)).catch(() => null);
  if (saved?.privJwk) keys = { privJwk: saved.privJwk, pubJwk: saved.pubJwk, priv: await importPriv(saved.privJwk) };
  return keys;
}

async function storeKeys(privJwk, pubJwk) {
  await idbDo('readwrite', (s) => s.put({ privJwk, pubJwk }, me));
  keys = { privJwk, pubJwk, priv: await importPriv(privJwk) };
  cache.clear();
}

/* ---------------------------------------------------------------------------
   Ключ восстановления: 24 символа (120 бит), им зашифрована копия на сервере
   --------------------------------------------------------------------------- */
const RK_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normRecovery = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function newRecoveryKey() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => RK_ALPHA[b % 32]).join('');
  return raw.match(/.{4}/g).join('-');
}
async function recoveryAes(rk, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(normRecovery(rk)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sealBackup(privJwk, rk) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await recoveryAes(rk, salt), te.encode(JSON.stringify(privJwk)));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}

// Первая настройка: новая пара ключей и ключ восстановления
export async function createKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pubFull = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const pubJwk = { kty: 'EC', crv: 'P-256', x: pubFull.x, y: pubFull.y };
  const rk = newRecoveryKey();
  const backup = await sealBackup(privJwk, rk);
  await storeKeys(privJwk, pubJwk);
  return { e2ee: { pub: pubJwk, backup, at: Date.now() }, recoveryKey: rk };
}

// Новое устройство: открыть копию ключом восстановления
export async function unlockWith(rk, e2ee) {
  const b = e2ee?.backup;
  if (!b) throw new Error('no backup');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, await recoveryAes(rk, unb64(b.salt)), unb64(b.data));
  const privJwk = JSON.parse(td.decode(plain));
  await storeKeys(privJwk, e2ee.pub);
}

// Новый ключ восстановления для того же закрытого ключа
export async function rotateRecovery(e2ee) {
  const rk = newRecoveryKey();
  return { e2ee: { ...e2ee, backup: await sealBackup(keys.privJwk, rk), at: Date.now() }, recoveryKey: rk };
}

/* ---------------------------------------------------------------------------
   Ключи чатов
   --------------------------------------------------------------------------- */
async function derive(pubJwk, info) {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: await importPub(pubJwk) }, keys.priv, 256);
  const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: te.encode('kosmo-e2ee-v1'), info: te.encode(info) },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

const isRoom = (c) => c?.type === 'group' || c?.type === 'channel';
export const isPublicRoom = (c) => isRoom(c) && Boolean(c.username);
const pubOf = (uid) => db.get(uid)?.e2ee?.pub ?? null;

// Шифруется ли чат (и ключ для него). Группе без ключа — null
export async function chatKey(c) {
  if (!keys || !c || isPublicRoom(c)) return null;
  if (c.saved) return memo(`saved:${me}`, () => derive(keys.pubJwk, `saved:${me}`));
  if (!isRoom(c)) {
    const other = c.members.find((u) => u !== me);
    const pub = pubOf(other);
    if (!pub) return null;
    return memo(`dm:${c.id}:${pub.x}`, () => derive(pub, `dm:${c.id}`));
  }
  const entry = c.ekeys?.[me];
  const byPub = entry && (entry.by === me ? keys.pubJwk : pubOf(entry.by));
  if (!entry || !byPub) return null;
  return memo(`grp:${c.id}:${entry.k}`, async () => {
    const wrap = await derive(byPub, `wrap:${c.id}`);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) }, wrap, unb64(entry.k));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  });
}
const selfKey = () => (keys ? memo(`saved:${me}`, () => derive(keys.pubJwk, `saved:${me}`)) : null);

async function memo(id, make) {
  if (!cache.has(id)) cache.set(id, make().catch((e) => { cache.delete(id); throw e; }));
  return cache.get(id);
}

// Группа: недостающие ключи участникам (новым или сменившим ключ).
// Возвращает новое значение ekeys или null, если менять нечего.
export async function groupKeysFor(c) {
  if (!keys || !isRoom(c) || isPublicRoom(c)) return null;
  let groupKey = await chatKey(c).catch(() => null);
  const ekeys = { ...(c.ekeys ?? {}) };
  if (!groupKey) {
    if (Object.keys(ekeys).length) return null;   // ключ есть, но мне его ещё не выдали
    groupKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  const raw = await crypto.subtle.exportKey('raw', groupKey);
  let changed = false;
  for (const u of c.members) {
    const pub = u === me ? keys.pubJwk : pubOf(u);
    if (!pub) continue;
    const to = await fingerprint(pub);
    if (ekeys[u]?.to === to) continue;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrap = await derive(pub, `wrap:${c.id}`);
    ekeys[u] = { by: me, to, iv: b64(iv), k: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, raw)) };
    changed = true;
  }
  return changed ? ekeys : null;
}

/* ---------------------------------------------------------------------------
   Строки и сообщения
   --------------------------------------------------------------------------- */
async function seal(key, s) {
  if (typeof s !== 'string' || !s || isSealed(s)) return s;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(s));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return SEALED + b64(out);
}
async function open(key, s) {
  if (!isSealed(s) || !key) return s;
  try {
    const bytes = unb64(s.slice(SEALED.length));
    return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
  } catch { return s; }
}

const STR = ['text', 'caption', 'quote', 'transcript', 'name', 'mk', 'question'];

export async function sealMessage(key, m) {
  if (!key || !m) return m;
  const o = structuredClone(m);
  for (const f of STR) if (typeof o[f] === 'string') o[f] = await seal(key, o[f]);
  if (Array.isArray(o.winners)) o.winners = await Promise.all(o.winners.map((w) => seal(key, w)));
  if (o.location && !o.location.sealed) {
    const { lat, lon, acc, ...rest } = o.location;
    o.location = { ...rest, sealed: await seal(key, JSON.stringify({ lat, lon, acc })) };
  }
  if (o.poll) {
    o.poll = { ...o.poll, question: await seal(key, o.poll.question), explanation: await seal(key, o.poll.explanation) };
    o.poll.options = await Promise.all((o.poll.options ?? []).map(async (op) => ({ ...op, text: await seal(key, op.text) })));
  }
  if (o.todo) {
    o.todo = { ...o.todo, title: await seal(key, o.todo.title) };
    o.todo.items = await Promise.all((o.todo.items ?? []).map(async (it) => ({ ...it, text: await seal(key, it.text) })));
  }
  if (Array.isArray(o.items)) o.items = await Promise.all(o.items.map(async (it) => ({ ...it, mk: await seal(key, it.mk) })));
  if (o.msg) o.msg = await sealMessage(key, o.msg);   // отложенное
  o.e2e = 1;
  return o;
}

export async function openMessage(key, m) {
  if (!m || !key) return m;
  const o = { ...m };
  for (const f of STR) if (isSealed(o[f])) o[f] = await open(key, o[f]);
  if (Array.isArray(o.winners)) o.winners = await Promise.all(o.winners.map((w) => open(key, w)));
  if (o.location?.sealed) {
    const raw = await open(key, o.location.sealed);
    if (!isSealed(raw)) { const { sealed, ...rest } = o.location; o.location = { ...rest, ...JSON.parse(raw) }; }
  }
  if (o.poll) {
    o.poll = { ...o.poll, question: await open(key, o.poll.question), explanation: await open(key, o.poll.explanation) };
    o.poll.options = await Promise.all((o.poll.options ?? []).map(async (op) => ({ ...op, text: await open(key, op.text) })));
  }
  if (o.todo) {
    o.todo = { ...o.todo, title: await open(key, o.todo.title) };
    o.todo.items = await Promise.all((o.todo.items ?? []).map(async (it) => ({ ...it, text: await open(key, it.text) })));
  }
  if (Array.isArray(o.items)) {
    o.items = await Promise.all(o.items.map(async (it) => ({ ...it, mk: await open(key, it.mk) })));
    o.items.forEach((it) => { if (it.mk && !isSealed(it.mk)) mediaKeys.set(it.media, { key: it.mk, mime: it.mime }); });
  }
  if (o.mk && !isSealed(o.mk) && o.media) mediaKeys.set(o.media, { key: o.mk, mime: o.mime });
  if (o.msg) o.msg = await openMessage(key, o.msg);
  return o;
}

/* ---------- Документ чата целиком (снимок, замена) ---------- */
export async function openChatDoc(c) {
  const key = await chatKey(c).catch(() => null);
  if (!key) return c;
  return {
    ...c,
    messages: await Promise.all((c.messages ?? []).map((m) => openMessage(key, m))),
    ...(c.scheduled ? { scheduled: await Promise.all(c.scheduled.map((s) => openMessage(key, s))) } : {}),
  };
}

/* ---------- Свой профиль: черновики и закладки ---------- */
export async function sealAccountPatch(p) {
  const key = await selfKey();
  if (!key || !p.set) return p;
  const set = { ...p.set };
  if (set.chatPrefs) {
    set.chatPrefs = Object.fromEntries(await Promise.all(Object.entries(set.chatPrefs).map(async ([id, pr]) => [id,
      pr?.draft?.text ? { ...pr, draft: { ...pr.draft, text: await seal(key, pr.draft.text) } } : pr])));
  }
  if (Array.isArray(set.bookmarks)) set.bookmarks = await Promise.all(set.bookmarks.map(async (b) => ({ ...b, text: await seal(key, b.text) })));
  return { ...p, set };
}
export async function openAccount(u) {
  const key = await selfKey();
  if (!key || !u) return u;
  const o = { ...u };
  if (o.chatPrefs) {
    o.chatPrefs = Object.fromEntries(await Promise.all(Object.entries(o.chatPrefs).map(async ([id, pr]) => [id,
      isSealed(pr?.draft?.text) ? { ...pr, draft: { ...pr.draft, text: await open(key, pr.draft.text) } } : pr])));
  }
  if (Array.isArray(o.bookmarks)) o.bookmarks = await Promise.all(o.bookmarks.map(async (b) => ({ ...b, text: await open(key, b.text) })));
  return o;
}

/* ---------------------------------------------------------------------------
   Файлы: у каждого свой случайный ключ, он лежит внутри (зашифрованного) сообщения
   --------------------------------------------------------------------------- */
export async function sealFile(blob) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer());
  const raw = await crypto.subtle.exportKey('raw', key);
  return { blob: new Blob([iv, ct], { type: 'application/octet-stream' }), mk: b64(raw), mime: blob.type || 'application/octet-stream' };
}
export async function openFile(buf, mk, mime) {
  const key = await crypto.subtle.importKey('raw', unb64(mk), 'AES-GCM', false, ['decrypt']);
  const bytes = new Uint8Array(buf);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new Blob([plain], { type: mime || 'application/octet-stream' });
}

// Шифруется ли чат прямо сейчас (для значка замка) — без асинхронщины
export function isEncryptedChat(c) {
  if (!keys || !c || isPublicRoom(c)) return false;
  if (c.saved) return true;
  if (!isRoom(c)) return Boolean(pubOf(c.members.find((u) => u !== me)));
  return Boolean(c.ekeys?.[me]);
}
