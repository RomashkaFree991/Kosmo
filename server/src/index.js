// Kosmo — сервер: REST API + WebSocket + раздача файлов.
// В продакшене перед ним стоит nginx (HTTPS, статика сайта).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { sql, users, chats, posts, stories, tx } from './db.js';
import {
  ApiError, normPhone, startCode, checkCode, useTicket, verifyPass, setPass, createSession, sessionByToken,
  sessionsOf, updateSession, deleteSession, kosmoMessage, newId,
} from './auth.js';
import { smsChannel } from './sms.js';
import { handleGatewayUpgrade, gatewayStatus } from './gateway.js';
import { startBot } from './tgbot.js';
import { snapshot, applyPatches, broadcastUser, housekeeping } from './sync.js';
import { attachRealtime, kickSession, qrDeliver, sendTo } from './realtime.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json',
  '.apk': 'application/vnd.android.package-archive',
};

/* ---------- Вспомогательное ---------- */
function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new ApiError(413, 'too_large', 'Request is too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks))); } catch { reject(new ApiError(400, 'bad_json')); }
    });
    req.on('error', reject);
  });
}
const clientIp = (req) => (config.trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress?.replace('::ffff:', '') || 'Unknown';
function auth(req) {
  const h = req.headers.authorization ?? '';
  const s = sessionByToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!s) throw new ApiError(401, 'unauthorized', 'Session ended');
  return s;
}

// «Был в сети»: обновлять других не чаще раза в 30 секунд
const lastBroadcast = new Map();
function activity(uid) {
  const t = lastBroadcast.get(uid) ?? 0;
  if (Date.now() - t < 30_000) return;
  lastBroadcast.set(uid, Date.now());
  broadcastUser(uid);
}

/* ---------- Маршруты API ---------- */
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

route('GET', '/api/config', () => ({ channel: smsChannel(), testNumbers: config.testNumbers }));
route('GET', '/api/gateway', () => ({ online: gatewayStatus().phones.length }));

route('POST', '/api/auth/code', async (req) => {
  const { phone } = await readBody(req);
  const p = normPhone(phone);
  const info = await startCode(p, 'login', clientIp(req));
  return { sent: true, channel: smsChannel(), ...info };
});

route('POST', '/api/auth/verify', async (req) => {
  const { phone, code } = await readBody(req);
  const p = normPhone(phone);
  const ticket = checkCode(p, 'login', code);
  const u = users.byPhone(p);
  return { ticket, exists: Boolean(u) };
});

route('POST', '/api/auth/login', async (req) => {
  const { ticket, passcode, device, location } = await readBody(req);
  const phone = useTicket(ticket, 'login', false);
  const u = users.byPhone(phone);
  if (!u) throw new ApiError(404, 'no_account');
  if (!verifyPass(u.id, passcode)) throw new ApiError(401, 'wrong_passcode', 'Wrong passcode');
  useTicket(ticket, 'login');
  const trusted = !sessionsOf(u.id).some((s) => s.trusted);
  const ip = clientIp(req);
  const s = createSession(u.id, { device, ip, location, trusted });
  kosmoMessage(u.id, { kind: 'login', sid: s.sid, device: s.session.name, type: s.session.type, ip, location: s.session.location });
  broadcastUser(u.id);
  return { token: s.token, uid: u.id, sid: s.sid };
});

route('POST', '/api/auth/register', async (req) => {
  const { ticket, passcode, name, username, bio, device, location } = await readBody(req);
  const phone = useTicket(ticket, 'login', false);
  if (users.byPhone(phone)) throw new ApiError(409, 'exists', 'This number is already registered');
  const cleanName = String(name ?? '').trim().slice(0, 64);
  if (!cleanName) throw new ApiError(400, 'bad_name', 'Name is required');
  const uname = String(username ?? '');
  if (uname && (!/^(?=.*[a-z])[a-z0-9]{3,32}$/.test(uname) || users.usernameTaken(uname))) throw new ApiError(409, 'username_taken', 'This username is taken');
  if (!/^\d{4}$/.test(String(passcode))) throw new ApiError(400, 'bad_passcode');
  const id = newId();
  const now = Date.now();
  const data = {
    name: cleanName, username: uname, bio: String(bio ?? '').slice(0, 140), createdAt: now,
    role: users.count() === 0 ? 'owner' : 'user', publicId: users.nextPublicId(),
    avatar: { color: null, text: '', photo: null }, chatPrefs: {}, privacy: { hidePhone: false, hideBio: false },
    messages: [], settings: {}, security: {},
  };
  tx(() => {
    sql.prepare('INSERT INTO users (id, phone, username, pass_hash, pass_salt, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, phone, uname || null, 'x', 'x', JSON.stringify(data), now);
    setPass(id, passcode);
  });
  useTicket(ticket, 'login');
  const ip = clientIp(req);
  const s = createSession(id, { device, ip, location, trusted: true });
  updateSession(s.sid, (d) => { d.first = true; });
  kosmoMessage(id, { kind: 'welcome', sid: s.sid, device: s.session.name, type: s.session.type, ip, location: s.session.location });
  broadcastUser(id);
  return { token: s.token, uid: id, sid: s.sid };
});

route('GET', '/api/sync', (req) => {
  const s = auth(req);
  return { ...snapshot(s.userId), me: s.userId, sid: s.id };
});

route('POST', '/api/sync', async (req) => {
  const s = auth(req);
  const { patches, conn } = await readBody(req);
  return { results: applyPatches(s.userId, patches, conn ? findConn(s.userId, conn) : undefined) };
});

route('POST', '/api/logout', (req) => {
  const s = auth(req);
  deleteSession(s.id);
  kickSession(s.id);
  broadcastUser(s.userId);
  return { ok: true };
});

route('DELETE', '/api/sessions/:id', (req, p) => {
  const s = auth(req);
  const target = sessionsOf(s.userId).find((x) => x.id === p.id);
  if (!target) throw new ApiError(404, 'not_found');
  const me = sessionsOf(s.userId).find((x) => x.id === s.id);
  if (target.id !== s.id && (!me?.trusted || target.first)) throw new ApiError(403, 'forbidden', 'Only a trusted device can do this');
  deleteSession(target.id);
  kickSession(target.id);
  broadcastUser(s.userId);
  return { ok: true };
});

route('POST', '/api/sessions/:id/trust', async (req, p) => {
  const s = auth(req);
  const { trusted } = await readBody(req);
  const me = sessionsOf(s.userId).find((x) => x.id === s.id);
  const target = sessionsOf(s.userId).find((x) => x.id === p.id);
  if (!target || !me?.trusted || target.first || target.id === s.id) throw new ApiError(403, 'forbidden');
  updateSession(target.id, (d) => { d.trusted = Boolean(trusted); });
  broadcastUser(s.userId);
  return { ok: true };
});

route('POST', '/api/passcode/verify', async (req) => {
  const s = auth(req);
  const { code } = await readBody(req);
  return { ok: verifyPass(s.userId, code) };
});

route('POST', '/api/passcode/change', async (req) => {
  const s = auth(req);
  const { current, next } = await readBody(req);
  if (!verifyPass(s.userId, current)) throw new ApiError(401, 'wrong_passcode', 'Wrong passcode');
  setPass(s.userId, next);
  const ses = sessionsOf(s.userId).find((x) => x.id === s.id);
  kosmoMessage(s.userId, { kind: 'passcode', sid: s.id, device: ses?.name, type: ses?.type, ip: clientIp(req), location: ses?.location });
  broadcastUser(s.userId);
  return { ok: true };
});

// Смена номера: код на старый номер → код на новый
route('POST', '/api/phone/code', async (req) => {
  const s = auth(req);
  const { step, phone, ticket } = await readBody(req);
  const u = users.get(s.userId);
  if (step === 'old') return { sent: true, ...(await startCode(u.phone, `phone-old:${u.id}`, clientIp(req))) };
  useTicket(ticket, `phone-old:${u.id}`, false);
  const p = normPhone(phone);
  if (p === u.phone) throw new ApiError(400, 'same_phone', 'This is already your number');
  if (users.byPhone(p)) throw new ApiError(409, 'phone_taken', 'This number is used by another account');
  return { sent: true, ...(await startCode(p, `phone-new:${u.id}`, clientIp(req))) };
});

route('POST', '/api/phone/verify', async (req) => {
  const s = auth(req);
  const { step, phone, code, ticket } = await readBody(req);
  const u = users.get(s.userId);
  if (step === 'old') return { ticket: checkCode(u.phone, `phone-old:${u.id}`, code) };
  useTicket(ticket, `phone-old:${u.id}`);
  const p = normPhone(phone);
  checkCode(p, `phone-new:${u.id}`, code);
  if (users.byPhone(p)) throw new ApiError(409, 'phone_taken', 'This number is used by another account');
  const from = u.phone;
  u.phone = p;
  users.save(u);
  const ses = sessionsOf(s.userId).find((x) => x.id === s.id);
  kosmoMessage(s.userId, { kind: 'phone', sid: s.id, device: ses?.name, type: ses?.type, ip: clientIp(req), location: ses?.location, from, to: p });
  broadcastUser(s.userId);
  return { ok: true, phone: p };
});

route('DELETE', '/api/account', async (req) => {
  const s = auth(req);
  const { passcode } = await readBody(req);
  if (!verifyPass(s.userId, passcode)) throw new ApiError(401, 'wrong_passcode', 'Wrong passcode');
  const uid = s.userId;
  const sids = sessionsOf(uid).map((x) => x.id);
  tx(() => {
    for (const c of chats.all()) {
      if (!c.members.includes(uid)) continue;
      const room = c.type === 'group' || c.type === 'channel';
      if (room && c.owner === uid) chats.remove(c.id);
      else if (room) chats.save({ ...c, members: c.members.filter((x) => x !== uid), admins: (c.admins ?? []).filter((x) => x !== uid) });
    }
    for (const p2 of posts.all()) if (p2.author === uid) posts.remove(p2.id);
    for (const st of stories.all()) if (st.author === uid) stories.remove(st.id);
    sql.prepare('DELETE FROM users WHERE id = ?').run(uid);
  });
  sids.forEach(kickSession);
  broadcastUser(uid);
  return { ok: true };
});

// Вход по QR: вошедшее устройство подтверждает код экрана входа
route('POST', '/api/qr/approve', async (req) => {
  const s = auth(req);
  const me = sessionsOf(s.userId).find((x) => x.id === s.id);
  if (!me?.trusted) throw new ApiError(403, 'forbidden', 'Only a trusted device can link new devices');
  const { code, device } = await readBody(req);
  const c = String(code ?? '').toUpperCase();
  const ip = clientIp(req);
  const ns = createSession(s.userId, { device: device ?? { name: 'Linked device', type: 'desktop' }, ip: 'via QR', location: me.location, trusted: false });
  if (!qrDeliver(c, { token: ns.token, uid: s.userId, sid: ns.sid })) {
    deleteSession(ns.sid);
    throw new ApiError(404, 'qr_not_found', 'Code not found or expired');
  }
  kosmoMessage(s.userId, { kind: 'login', sid: ns.sid, device: 'Linked via QR', type: 'desktop', ip, location: me.location });
  broadcastUser(s.userId);
  return { ok: true };
});

// Звонки: STUN + временные логин/пароль для своего TURN (coturn)
route('GET', '/api/ice', (req) => {
  const s = auth(req);
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (config.turnHost && config.turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:${s.userId}`;
    const credential = crypto.createHmac('sha1', config.turnSecret).update(username).digest('base64');
    servers.push({ urls: [`turn:${config.turnHost}:3478?transport=udp`, `turn:${config.turnHost}:3478?transport=tcp`], username, credential });
  }
  return { iceServers: servers };
});

/* ---------- Медиа: загрузка и раздача ---------- */
const mediaPath = (id) => path.join(config.dataDir, 'media', id);
async function uploadMedia(req, res) {
  const s = auth(req);
  const mime = String(req.headers['content-type'] ?? 'application/octet-stream').split(';')[0].slice(0, 80);
  if (!/^(image|video|audio)\//.test(mime)) throw new ApiError(415, 'bad_type', 'Unsupported file type');
  const len = Number(req.headers['content-length'] ?? 0);
  if (len > config.maxUpload) throw new ApiError(413, 'too_large', 'File is too large');
  const id = crypto.randomBytes(16).toString('hex');
  const tmp = `${mediaPath(id)}.part`;
  await new Promise((resolve, reject) => {
    let size = 0;
    const out = fs.createWriteStream(tmp);
    req.on('data', (c) => {
      size += c.length;
      if (size > config.maxUpload) { req.destroy(); out.destroy(); fs.rm(tmp, () => {}); reject(new ApiError(413, 'too_large')); }
    });
    req.pipe(out);
    out.on('finish', () => {
      fs.renameSync(tmp, mediaPath(id));
      sql.prepare('INSERT INTO media (id, owner, mime, size, created_at) VALUES (?, ?, ?, ?, ?)').run(id, s.userId, mime, size, Date.now());
      resolve();
    });
    out.on('error', reject);
  });
  send(res, 200, { id });
}

function serveMedia(req, res, id) {
  if (!/^[a-f0-9]{32}$/.test(id)) return send(res, 404, { error: 'not_found' });
  const r = sql.prepare('SELECT mime, size FROM media WHERE id = ?').get(id);
  if (!r) return send(res, 404, { error: 'not_found' });
  const file = mediaPath(id);
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const headers = { 'Content-Type': r.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), r.size - 1) : r.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${r.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return undefined;
  }
  res.writeHead(200, { ...headers, 'Content-Length': r.size });
  fs.createReadStream(file).pipe(res);
  return undefined;
}

/* ---------- Статика (для запуска без nginx) ---------- */
function serveStatic(req, res, pathname) {
  const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.normalize(path.join(config.webDir, rel));
  if (!file.startsWith(config.webDir)) return send(res, 403, { error: 'forbidden' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not_found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
    return undefined;
  });
  return undefined;
}

/* ---------- Сервер ---------- */
let wss = null;
function findConn(uid, connId) {
  for (const ws of wss?.clients ?? []) if (ws.uid === uid && ws.connId === connId) return ws;
  return undefined;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && pathname === '/api/media') return await uploadMedia(req, res);
    if (req.method === 'GET' && pathname.startsWith('/media/')) return serveMedia(req, res, pathname.slice(7));
    if (pathname.startsWith('/api/')) {
      for (const r of routes) {
        const m = r.method === req.method && pathname.match(r.re);
        if (m) return send(res, 200, await r.fn(req, m.groups ?? {}));
      }
      return send(res, 404, { error: 'not_found' });
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    if (e instanceof ApiError) return send(res, e.status, { error: e.code, message: e.message });
    console.error(e);
    return send(res, 500, { error: 'server_error', message: 'Something went wrong' });
  }
});

wss = attachRealtime(server, { onActivity: activity, onGateway: (req, socket, head) => handleGatewayUpgrade(req, socket, head, clientIp(req)) });
wss.on('connection', (ws) => { ws.connId = crypto.randomBytes(8).toString('hex'); ws.send(JSON.stringify({ t: 'conn', id: ws.connId })); });

if (config.smsProvider === 'tgbot') startBot();
setInterval(() => { try { housekeeping(); } catch (e) { console.error('housekeeping', e); } }, 5000);
sql.prepare('DELETE FROM tickets WHERE expires < ?').run(Date.now());

server.listen(config.port, config.host, () => {
  console.log(`Kosmo server on http://${config.host}:${config.port} · SMS: ${config.smsProvider} · data: ${config.dataDir}`);
});
export { sendTo };
