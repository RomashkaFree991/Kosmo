// WebSocket: изменения данных приходят мгновенно, сигналы звонков
// пересылаются собеседнику, экран входа ждёт подтверждения QR-кода.

import { WebSocketServer } from 'ws';
import { sessionByToken, touchSession } from './auth.js';

const byUser = new Map();      // uid → Set<ws>
const qrWaiters = new Map();   // QR-код → ws экрана входа
let onActive = () => {};

export const connectedUsers = () => [...byUser.keys()];

export function sendTo(uid, msg, exceptConn) {
  const set = byUser.get(uid);
  if (!set) return;
  const data = JSON.stringify(msg);
  for (const ws of set) if (ws !== exceptConn && ws.readyState === 1) ws.send(data);
}
export function sendAll(msg, exceptConn) { for (const uid of byUser.keys()) sendTo(uid, msg, exceptConn); }

// Сессию завершили — закрыть её соединения
export function kickSession(sid) {
  for (const set of byUser.values()) {
    for (const ws of set) if (ws.sid === sid) { ws.send(JSON.stringify({ t: 'logout' })); ws.close(4001, 'session ended'); }
  }
}

export function qrDeliver(code, payload) {
  const ws = qrWaiters.get(code);
  if (!ws || ws.readyState !== 1) return false;
  ws.send(JSON.stringify({ t: 'qr-login', ...payload }));
  qrWaiters.delete(code);
  return true;
}

export function attachRealtime(server, { onActivity, onGateway }) {
  onActive = onActivity;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  // один обработчик upgrade: /ws — приложение, /ws/gateway — телефон-шлюз SMS
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    else if (pathname === '/ws/gateway') onGateway(req, socket, head);
    else socket.destroy();
  });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const s = sessionByToken(url.searchParams.get('token'));
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    if (s) {
      ws.uid = s.userId;
      ws.sid = s.id;
      if (!byUser.has(s.userId)) byUser.set(s.userId, new Set());
      byUser.get(s.userId).add(ws);
      touchSession(s.id);
      onActive(s.userId);
      ws.send(JSON.stringify({ t: 'hello', uid: s.userId, sid: s.id }));
    }
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf); } catch { return; }
      if (msg.t === 'qr-wait' && typeof msg.code === 'string' && /^[A-Z0-9]{6}$/.test(msg.code)) {
        qrWaiters.set(msg.code, ws);
        ws.qrCode = msg.code;
        return;
      }
      if (!ws.uid) return;
      if (msg.t === 'signal' && typeof msg.to === 'string') {
        // звонок: пересылаем собеседнику (во все его вкладки) и своим другим вкладкам
        sendTo(msg.to, { t: 'signal', from: ws.uid, data: msg.data }, ws);
        if (msg.mirror) sendTo(ws.uid, { t: 'signal', from: ws.uid, data: msg.data }, ws);
        return;
      }
      if (msg.t === 'ping') {
        touchSession(ws.sid);
        onActive(ws.uid);
      }
    });
    ws.on('close', () => {
      if (ws.qrCode && qrWaiters.get(ws.qrCode) === ws) qrWaiters.delete(ws.qrCode);
      const set = ws.uid && byUser.get(ws.uid);
      if (set) {
        set.delete(ws);
        if (!set.size) { byUser.delete(ws.uid); onActive(ws.uid); }
      }
    });
  });
  // проверка живых соединений
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  return wss;
}
