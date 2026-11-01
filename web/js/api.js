// Связь с сервером Kosmo: REST, WebSocket и синхронизация данных.
// localStorage остаётся кешем: приложение читает его синхронно, а каждая
// запись в коллекцию превращается в патч для сервера. Изменения от других
// приходят по WebSocket и сразу попадают в кеш.

import { store, tab, setWriteHook, toast } from './core.js';
import { COLLECTIONS, diffCollection, applyToCollection } from './patch.js';
import {
  loadKeys, chatKey, groupKeysFor, sealMessage, openMessage, openChatDoc, sealAccountPatch, openAccount, isPublicRoom,
} from './e2ee.js';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const shadow = {};            // последнее известное серверу состояние коллекций
let me = null;
let ws = null;
let connId = null;
let queue = [];
let flushTimer = null;
let retry = 0;
const signalHandlers = new Set();
// свои сообщения, которые ещё не подтвердил сервер (часики в пузыре)
const pending = new Set();
export const isPending = (id) => pending.has(id);
const pendingChanged = () => document.dispatchEvent(new CustomEvent('kosmo:pending'));
const myMsgIds = (patches) => patches.flatMap((p) => (p.col === 'chats' ? (p.msgs?.up ?? []).filter((m) => m.from === me).map((m) => m.id) : []));
const msgHandlers = new Set();

/* ---------- REST ---------- */
export class ApiError extends Error {
  constructor(status, code, message, data = {}) { super(message || code); this.status = status; this.code = code; this.data = data; }
}

export async function api(method, path, body, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = tab.get();
  if (auth && t?.token) headers.Authorization = `Bearer ${t.token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'offline', 'No connection to the server');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.error === 'unauthorized') document.dispatchEvent(new CustomEvent('kosmo:session-ended'));
    throw new ApiError(res.status, data.error, data.message, data);
  }
  return data;
}

/* ---------- Загрузка снимка с сервера ---------- */
function writeRaw(col, value) {
  // запись в кеш без отправки на сервер
  setWriteHook(null);
  store.setJSON(col, value);
  setWriteHook(onWrite);
}

export async function loadSnapshot() {
  const snap = await api('GET', '/api/sync');
  me = snap.me;
  await loadKeys(me);
  // сначала профили (в них публичные ключи), потом расшифровка переписки
  if (snap.accounts[me]) snap.accounts[me] = await openAccount(snap.accounts[me]);
  writeRaw('accounts', snap.accounts);
  shadow.accounts = clone(snap.accounts);
  snap.chats = Object.fromEntries(await Promise.all(Object.entries(snap.chats).map(async ([id, c]) => [id, await openChatDoc(c).catch(() => c)])));
  for (const col of COLLECTIONS.filter((x) => x !== 'accounts')) {
    writeRaw(col, snap[col]);
    shadow[col] = clone(snap[col]);
  }
  return snap;
}

/* ---------- Сквозное шифрование патчей ---------- */
async function sealPatch(p) {
  try {
    if (p.col === 'accounts') return p.id === me ? await sealAccountPatch(p) : p;
    if (p.col !== 'chats' || p.op === 'del') return p;
    let c = store.getJSON('chats', {})[p.id] ?? { id: p.id, ...(p.set ?? {}) };
    if (!c.members || isPublicRoom(c)) return p;
    // группа: ключ участникам (создать при первом сообщении, выдать новым)
    const ekeys = await groupKeysFor(c);
    if (ekeys) {
      p = { ...p, set: { ...(p.set ?? {}), ekeys } };
      c = { ...c, ekeys };
      const all = store.getJSON('chats', {});
      if (all[p.id]) { all[p.id].ekeys = ekeys; writeRaw('chats', all); if (shadow.chats?.[p.id]) shadow.chats[p.id].ekeys = clone(ekeys); }
    }
    const key = await chatKey(c);
    if (!key) return p;
    const out = { ...p };
    if (p.msgs?.up?.length) out.msgs = { ...p.msgs, up: await Promise.all(p.msgs.up.map((m) => sealMessage(key, m))) };
    if (p.set?.scheduled) out.set = { ...out.set, scheduled: await Promise.all(p.set.scheduled.map((x) => sealMessage(key, x))) };
    return out;
  } catch (e) {
    console.error('e2ee seal', e);
    return p;
  }
}

async function openPatch(p) {
  try {
    if (p.col === 'accounts') {
      if (p.id !== me || !p.set) return p;
      const opened = await openAccount({ chatPrefs: p.set.chatPrefs, bookmarks: p.set.bookmarks });
      return { ...p, set: { ...p.set, ...(p.set.chatPrefs ? { chatPrefs: opened.chatPrefs } : {}), ...(p.set.bookmarks ? { bookmarks: opened.bookmarks } : {}) } };
    }
    if (p.col !== 'chats' || p.op === 'del') return p;
    const base = p.replace ? p.set : { ...(store.getJSON('chats', {})[p.id] ?? {}), ...(p.set ?? {}) };
    const key = await chatKey(base).catch(() => null);
    if (!key) return p;
    const out = { ...p };
    if (p.msgs?.up?.length) out.msgs = { ...p.msgs, up: await Promise.all(p.msgs.up.map((m) => openMessage(key, m))) };
    if (p.set?.messages) out.set = { ...out.set, messages: await Promise.all(p.set.messages.map((m) => openMessage(key, m))) };
    if (p.set?.scheduled) out.set = { ...out.set, scheduled: await Promise.all(p.set.scheduled.map((x) => openMessage(key, x))) };
    return out;
  } catch (e) {
    console.error('e2ee open', e);
    return p;
  }
}

// Вход в аккаунт этой вкладкой: снимок + живое соединение
export async function boot() {
  await loadSnapshot();
  connect();
  document.dispatchEvent(new CustomEvent('kosmo:booted'));
  return true;
}

// wipe — стереть кеш аккаунта (выход из аккаунта); при переключении кеш остаётся
export function shutdown({ wipe = false } = {}) {
  me = null;
  queue = [];
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  for (const col of COLLECTIONS) { delete shadow[col]; if (wipe) store.remove(col); }
}

/* ---------- Запись в кеш → патчи на сервер ---------- */
function onWrite(key, value) {
  if (!COLLECTIONS.includes(key) || !me || !(key in shadow)) return;
  let patches = diffCollection(key, shadow[key], value);
  // чужие профили менять нельзя — их правки не отправляем
  if (key === 'accounts') patches = patches.filter((p) => p.id === me && p.op !== 'del');
  shadow[key] = clone(value);
  if (!patches.length) return;
  myMsgIds(patches).forEach((id) => pending.add(id));
  queue.push(...patches);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 30);
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  try {
    const sealed = await Promise.all(batch.map(sealPatch));
    const { results } = await api('POST', '/api/sync', { patches: sealed, conn: connId });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast(failed[0].message || 'Could not save the change');
    const ids = myMsgIds(batch);
    if (ids.length) { ids.forEach((id) => pending.delete(id)); pendingChanged(); }
  } catch (e) {
    if (e.status === 0 || e.status >= 500) {
      // нет связи — повторим позже
      queue.unshift(...batch);
      setTimeout(flush, 3000);
    } else {
      toast(e.message);
      myMsgIds(batch).forEach((id) => pending.delete(id));
      pendingChanged();
    }
  }
  if (queue.length) flush();
}

// Другая вкладка этого браузера записала кеш — она же и отправила изменения
window.addEventListener('storage', (e) => {
  const m = e.key?.match(/^kosmo:([^:]+):(\w+)$/);
  const col = m?.[2];
  if (m && m[1] === me && COLLECTIONS.includes(col) && col in shadow) {
    try { shadow[col] = JSON.parse(e.newValue); } catch { /* */ }
  }
});

/* ---------- WebSocket ---------- */
let remoteTimer = null;
function remoteChanged() {
  cancelAnimationFrame(remoteTimer);
  remoteTimer = requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('kosmo:remote')));
}

// изменения с сервера расшифровываются по очереди — порядок сохраняется
let remoteChain = Promise.resolve();
function applyRemote(patch) {
  remoteChain = remoteChain.then(() => applyRemoteNow(patch)).catch((e) => console.error('remote patch', e));
}
async function applyRemoteNow(raw) {
  const patch = await openPatch(raw);
  const col = patch.col;
  if (!COLLECTIONS.includes(col)) return;
  writeRaw(col, applyToCollection(col, store.getJSON(col, col === 'feed' || col === 'stories' ? [] : {}), patch));
  if (col in shadow) shadow[col] = applyToCollection(col, shadow[col], patch);
  remoteChanged();
}

function wsUrl(token) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function connect() {
  const t = tab.get();
  if (!t?.token) return;
  if (ws) { ws.onclose = null; ws.close(); }
  const sock = new WebSocket(wsUrl(t.token));
  ws = sock;
  sock.onopen = () => { retry = 0; };
  sock.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.t === 'conn') connId = msg.id;
    else if (msg.t === 'patch') applyRemote(msg.patch);
    else if (msg.t === 'signal') signalHandlers.forEach((fn) => fn(msg.from, msg.data));
    else if (msg.t === 'logout') document.dispatchEvent(new CustomEvent('kosmo:session-ended'));
    msgHandlers.forEach((fn) => fn(msg));
  };
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    ws = null;
    if (ev.code === 4001) return;
    // переподключение и догрузка пропущенного
    const delay = Math.min(15_000, 1000 * 2 ** retry++);
    setTimeout(async () => {
      if (!tab.get()?.token || ws) return;
      try { await loadSnapshot(); remoteChanged(); } catch { /* сервер ещё недоступен */ }
      connect();
    }, delay);
  };
}

setInterval(() => { if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'ping' })); }, 50_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ws?.readyState === 1) ws.send(JSON.stringify({ t: 'ping' }));
});

/* ---------- Сигналы (звонки) ---------- */
export function sendSignal(to, data) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'signal', to, data }));
}
export const onSignal = (fn) => signalHandlers.add(fn);
export const onServerMessage = (fn) => msgHandlers.add(fn);
export function wsSend(obj) {
  if (ws?.readyState !== 1) return false;
  ws.send(JSON.stringify(obj));
  return true;
}
export function sendTyping(chat, kind = 'text') {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'typing', chat, kind }));
}

// Анонимное соединение для экрана входа (ожидание QR)
export function anonSocket(onMessage) {
  const sock = new WebSocket(wsUrl(null));
  sock.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch { /* */ } };
  return sock;
}

export const isOnline = () => ws?.readyState === 1;
setWriteHook(onWrite);
