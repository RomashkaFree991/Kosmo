// Снимок данных для клиента и применение изменений с рассылкой
// всем, кого они касаются, через WebSocket.

import { applyToDoc } from '../../web/js/patch.js';
import { users, chats, posts, stories, tx } from './db.js';
import { project, ApiError } from './auth.js';
import { checkAccount, checkChat, checkPost, checkStory } from './rules.js';
import { sendTo, sendAll, connectedUsers } from './realtime.js';

const DAY = 24 * 3600 * 1000;
const isPublicRoom = (c) => (c?.type === 'group' || c?.type === 'channel') && Boolean(c.username);
const visibleMsgs = (c, now = Date.now()) => ({ ...c, messages: (c.messages ?? []).filter((m) => !m.expiresAt || m.expiresAt > now) });

export function snapshot(uid) {
  const accounts = {};
  for (const u of users.all()) accounts[u.id] = project(u, uid);
  const myChats = {};
  for (const c of chats.forUser(uid)) myChats[c.id] = visibleMsgs(c);
  const now = Date.now();
  return {
    accounts,
    chats: myChats,
    feed: posts.all().sort((a, b) => b.at - a.at),
    stories: stories.all().filter((s) => now - s.at < DAY),
  };
}

/* ---------- Рассылка ---------- */
export function broadcastUser(userId, exceptConn) {
  const u = users.get(userId);
  for (const viewer of connectedUsers()) {
    if (!u) { sendTo(viewer, { t: 'patch', patch: { col: 'accounts', id: userId, op: 'del' } }, exceptConn); continue; }
    sendTo(viewer, { t: 'patch', patch: { col: 'accounts', id: userId, op: 'put', replace: true, set: project(u, viewer) } }, exceptConn);
  }
}

function broadcastChat(patch, before, after, exceptConn) {
  const audience = new Set([...(before?.members ?? []), ...(after?.members ?? [])]);
  // публичные группы и каналы видят все
  if (isPublicRoom(before) || isPublicRoom(after)) connectedUsers().forEach((u) => audience.add(u));
  for (const u of audience) {
    // тому, кого убрали из закрытого чата, — удаление
    if (after && !after.members.includes(u) && !isPublicRoom(after)) sendTo(u, { t: 'patch', patch: { col: 'chats', id: patch.id, op: 'del' } }, exceptConn);
    else if (before && !before.members.includes(u) && !isPublicRoom(before) && after) {
      // новый участник получает весь чат
      sendTo(u, { t: 'patch', patch: { col: 'chats', id: after.id, op: 'put', replace: true, set: visibleMsgs(after) } }, exceptConn);
    } else sendTo(u, { t: 'patch', patch }, exceptConn);
  }
}

/* ---------- Применение патчей клиента ---------- */
export function applyPatches(uid, list, conn) {
  const results = [];
  for (const raw of Array.isArray(list) ? list.slice(0, 200) : []) {
    try {
      results.push({ ok: true, id: raw.id, col: raw.col, patch: applyOne(uid, raw, conn) });
    } catch (e) {
      if (!(e instanceof ApiError)) console.error('patch failed', e);
      results.push({ ok: false, id: raw.id, col: raw.col, error: e.code ?? 'error', message: e.message });
      // клиенту — актуальная версия документа, чтобы откатить свою
      resync(uid, raw.col, raw.id);
    }
  }
  return results;
}

function applyOne(uid, raw, conn) {
  const id = String(raw.id ?? '');
  if (!id || id.length > 120) throw new ApiError(400, 'bad_id');
  switch (raw.col) {
    case 'accounts': {
      const cur = users.get(uid);
      const p = checkAccount(uid, { ...raw, id }, cur);
      const next = applyToDoc('accounts', cur, p);
      users.save(next);
      broadcastUser(uid, conn);
      return p;
    }
    case 'chats': {
      return tx(() => {
        const before = chats.get(id);
        const p = checkChat(uid, { ...raw, id }, before);
        if (!p) return null;
        if (p.op === 'del') {
          chats.remove(id);
          broadcastChat({ col: 'chats', id, op: 'del' }, before, null, conn);
          return p;
        }
        const after = applyToDoc('chats', before, p);
        chats.save(after);
        broadcastChat(p, before, after, conn);
        return p;
      });
    }
    case 'feed': {
      const before = posts.get(id);
      const p = checkPost(uid, { ...raw, id }, before);
      if (p.op === 'del') posts.remove(id);
      else posts.save(applyToDoc('feed', before, p));
      sendAll({ t: 'patch', patch: p }, conn);
      return p;
    }
    case 'stories': {
      const before = stories.get(id);
      const p = checkStory(uid, { ...raw, id }, before);
      if (p.op === 'del') stories.remove(id);
      else stories.save(applyToDoc('stories', before, p));
      sendAll({ t: 'patch', patch: p }, conn);
      return p;
    }
    default:
      throw new ApiError(400, 'bad_collection');
  }
}

function resync(uid, col, id) {
  let doc = null;
  if (col === 'accounts') doc = project(users.get(id), uid);
  if (col === 'chats') { const c = chats.get(id); doc = c && (c.members.includes(uid) || isPublicRoom(c)) ? visibleMsgs(c) : null; }
  if (col === 'feed') doc = posts.get(id);
  if (col === 'stories') doc = stories.get(id);
  sendTo(uid, { t: 'patch', patch: doc ? { col, id, op: 'put', replace: true, set: doc } : { col, id, op: 'del' } });
}

/* ---------- Фоновые задачи: отложенные, исчезающие, истории ---------- */
export function housekeeping() {
  const now = Date.now();
  for (const c of chats.all()) {
    const due = (c.scheduled ?? []).filter((s) => s.sendAt <= now);
    const expired = (c.messages ?? []).filter((m) => m.expiresAt && m.expiresAt <= now).map((m) => m.id);
    if (!due.length && !expired.length) continue;
    const up = due.map((s) => ({ ...s.msg, id: s.id, at: now, scheduledAt: s.sendAt, ...(c.ttl ? { expiresAt: now + c.ttl * 1000 } : {}) }));
    const p = { col: 'chats', id: c.id, op: 'put', set: { scheduled: (c.scheduled ?? []).filter((s) => s.sendAt > now) }, msgs: { up, del: expired } };
    if (due.length) p.set.read = { ...(c.read ?? {}), ...Object.fromEntries(due.map((s) => [s.from, now])) };
    const after = applyToDoc('chats', c, p);
    chats.save(after);
    broadcastChat(p, c, after);
  }
  for (const s of stories.all()) {
    if (now - s.at >= DAY) { stories.remove(s.id); sendAll({ t: 'patch', patch: { col: 'stories', id: s.id, op: 'del' } }); }
  }
}
