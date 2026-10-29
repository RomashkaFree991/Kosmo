// Связь с сервером Kosmo: REST, WebSocket и синхронизация данных.
// localStorage остаётся кешем: приложение читает его синхронно, а каждая
// запись в коллекцию превращается в патч для сервера. Изменения от других
// приходят по WebSocket и сразу попадают в кеш.

import { store, tab, setWriteHook, toast } from './core.js';
import { COLLECTIONS, diffCollection, applyToCollection } from './patch.js';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const shadow = {};            // последнее известное серверу состояние коллекций
let me = null;
let ws = null;
let connId = null;
let queue = [];
let flushTimer = null;
let retry = 0;
const signalHandlers = new Set();
const msgHandlers = new Set();

/* ---------- REST ---------- */
export class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
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
    throw new ApiError(res.status, data.error, data.message);
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
  for (const col of COLLECTIONS) {
    writeRaw(col, snap[col]);
    shadow[col] = clone(snap[col]);
  }
  return snap;
}

// Вход в аккаунт этой вкладкой: снимок + живое соединение
export async function boot() {
  await loadSnapshot();
  connect();
  return true;
}

export function shutdown() {
  me = null;
  queue = [];
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  for (const col of COLLECTIONS) { delete shadow[col]; store.remove(col); }
}

/* ---------- Запись в кеш → патчи на сервер ---------- */
function onWrite(key, value) {
  if (!COLLECTIONS.includes(key) || !me || !(key in shadow)) return;
  let patches = diffCollection(key, shadow[key], value);
  // чужие профили менять нельзя — их правки не отправляем
  if (key === 'accounts') patches = patches.filter((p) => p.id === me && p.op !== 'del');
  shadow[key] = clone(value);
  if (!patches.length) return;
  queue.push(...patches);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 30);
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  try {
    const { results } = await api('POST', '/api/sync', { patches: batch, conn: connId });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast(failed[0].message || 'Could not save the change');
  } catch (e) {
    if (e.status === 0 || e.status >= 500) {
      // нет связи — повторим позже
      queue.unshift(...batch);
      setTimeout(flush, 3000);
    } else toast(e.message);
  }
  if (queue.length) flush();
}

// Другая вкладка этого браузера записала кеш — она же и отправила изменения
window.addEventListener('storage', (e) => {
  const col = e.key?.replace(/^kosmo:/, '');
  if (COLLECTIONS.includes(col) && col in shadow) {
    try { shadow[col] = JSON.parse(e.newValue); } catch { /* */ }
  }
});

/* ---------- WebSocket ---------- */
let remoteTimer = null;
function remoteChanged() {
  cancelAnimationFrame(remoteTimer);
  remoteTimer = requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('kosmo:remote')));
}

function applyRemote(patch) {
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

// Анонимное соединение для экрана входа (ожидание QR)
export function anonSocket(onMessage) {
  const sock = new WebSocket(wsUrl(null));
  sock.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch { /* */ } };
  return sock;
}

export const isOnline = () => ws?.readyState === 1;
setWriteHook(onWrite);
