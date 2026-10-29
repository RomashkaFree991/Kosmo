// Свой SMS-шлюз: Android-телефон с приложением Kosmo SMS подключается сюда
// по WebSocket (/ws/gateway?key=…) и отправляет коды со своей SIM-карты.
// Никаких сторонних сервисов: сервер → телефон → SMS.

import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { rateLimit } from './db.js';

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const phones = [];               // подключённые телефоны, последний — основной
const pending = new Map();       // id → { resolve, reject, timer }

// ключ вида ABCD-EFGH-JKLM-NPQR: регистр и дефисы не важны
const norm = (k) => String(k ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const digest = (k) => crypto.createHash('sha256').update(norm(k)).digest();
const keyOk = (k) => Boolean(norm(config.gatewayKey)) && crypto.timingSafeEqual(digest(k), digest(config.gatewayKey));

export function handleGatewayUpgrade(req, socket, head, ip) {
  const url = new URL(req.url, 'http://x');
  if (!rateLimit(`gw:${ip}`, 60, 3_600_000) || !keyOk(url.searchParams.get('key'))) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.device = (url.searchParams.get('device') ?? 'Android').slice(0, 60);
    ws.isAlive = true;
    phones.push(ws);
    console.log(`[gateway] phone connected: ${ws.device}`);
    ws.send(JSON.stringify({ t: 'hello' }));
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf); } catch { return; }
      ws.isAlive = true;
      if (msg.t === 'ping') { ws.send(JSON.stringify({ t: 'pong' })); return; }
      if (msg.t === 'ack' && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.ok) p.resolve();
        else p.reject(new Error(`phone: ${String(msg.error ?? 'not sent').slice(0, 200)}`));
      }
    });
    ws.on('close', () => {
      const i = phones.indexOf(ws);
      if (i >= 0) phones.splice(i, 1);
      console.log(`[gateway] phone disconnected: ${ws.device}`);
    });
  });
}

setInterval(() => {
  for (const ws of [...phones]) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

export const gatewayStatus = () => ({ phones: phones.filter((w) => w.readyState === 1).map((w) => w.device) });

export function sendViaGateway(to, text) {
  const ws = [...phones].reverse().find((w) => w.readyState === 1);
  if (!ws) return Promise.reject(new Error('SMS phone is offline'));
  const id = crypto.randomBytes(8).toString('hex');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('SMS phone did not answer')); }, 30_000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ t: 'sms', id, to, text }));
  });
}
