import crypto from 'node:crypto';
// Снимок данных для клиента и применение изменений с рассылкой
// всем, кого они касаются, через WebSocket.

import { applyToDoc } from '../../web/js/patch.js';
import { users, chats, posts, stories, tx } from './db.js';
import { project, ApiError } from './auth.js';
import { checkAccount, checkChat, checkPost, checkStory } from './rules.js';
import { noteMessages } from './bots.js';
import { sendTo, sendAll, connectedUsers, isOnline } from './realtime.js';
import { pushMessages } from './push.js';

const DAY = 24 * 3600 * 1000;
const isPublicRoom = (c) => (c?.type === 'group' || c?.type === 'channel') && Boolean(c.username);
const visibleMsgs = (c, now = Date.now()) => ({ ...c, messages: (c.messages ?? []).filter((m) => !m.expiresAt || m.expiresAt > now) });

// Истории видят только те, у кого есть личный чат с автором (и сам автор)
const dmId = (a, b) => [a, b].sort().join('_');
export function storyVisible(s, uid) {
  if (!s || s.author === uid) return true;
  return Boolean(chats.get(dmId(s.author, uid)) || chats.get(`secret_${dmId(s.author, uid)}`));
}

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
    stories: stories.all().filter((s) => now - s.at < DAY && storyVisible(s, uid)),
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
  noteMessages(patch, before, after);   // входящие для ботов-участников
  try { pushMessages(patch, before, after, isOnline); } catch (e) { console.error('push', e.message); }
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
        withJoinNotes(uid, before, p);
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
      if (p.op === 'del') sendAll({ t: 'patch', patch: p }, conn);
      else {
        const story = stories.get(id);
        for (const viewer of connectedUsers()) if (storyVisible(story, viewer)) sendTo(viewer, { t: 'patch', patch: p }, conn);
      }
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
  if (col === 'stories') { const st = stories.get(id); doc = storyVisible(st, uid) ? st : null; }
  sendTo(uid, { t: 'patch', patch: doc ? { col, id, op: 'put', replace: true, set: doc } : { col, id, op: 'del' } });
}

/* ---------- Фоновые задачи: отложенные, исчезающие, истории ---------- */
export function housekeeping() {
  const now = Date.now();
  for (const c of chats.all()) {
    const due = (c.scheduled ?? []).filter((s) => s.sendAt <= now);
    const expired = (c.messages ?? []).filter((m) => m.expiresAt && m.expiresAt <= now).map((m) => m.id);
    // опросы с дедлайном: закрыть и написать итог в чат
    const ended = (c.messages ?? []).filter((m) => m.poll && !m.poll.closed && m.poll.closesAt && m.poll.closesAt <= now);
    if (!due.length && !expired.length && !ended.length) continue;
    const up = due.map((s) => ({ ...s.msg, id: s.id, at: now, scheduledAt: s.sendAt, ...(c.ttl ? { expiresAt: now + c.ttl * 1000 } : {}) }));
    for (const m of ended) {
      up.push({ ...m, poll: { ...m.poll, closed: true } });
      const counts = m.poll.options.map((o) => ({ text: o.text, n: m.poll.votes?.[o.id]?.length ?? 0 }));
      const top = Math.max(0, ...counts.map((x) => x.n));
      up.push({
        id: `${m.id}-result`, at: now, from: m.from, kind: 'poll-result', pollOf: m.id, question: m.poll.question,
        total: new Set(Object.values(m.poll.votes ?? {}).flat()).size,
        winners: top ? counts.filter((x) => x.n === top).map((x) => x.text) : [], top,
      });
    }
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

/* ---------- Вход в группу или канал по ссылке-приглашению ---------- */
const inviteOf = (c, code) => (c.invites ?? []).find((i) => i.code === code);
export function findInvite(code) {
  const c = chats.all().find((x) => inviteOf(x, code));
  if (!c) throw new ApiError(404, 'invite_not_found', 'Invite link not found');
  const inv = inviteOf(c, code);
  if (inv.expires && inv.expires < Date.now()) throw new ApiError(410, 'invite_expired', 'This invite link has expired');
  if (inv.limit && (inv.used ?? 0) >= inv.limit) throw new ApiError(410, 'invite_expired', 'This invite link has expired');
  return { c, inv };
}

// В группе новый участник — служебное сообщение «вступил» / «добавил»
function withJoinNotes(actor, before, p) {
  if (!before || before.type !== 'group' || !Array.isArray(p.set?.members)) return;
  const added = p.set.members.filter((u) => !before.members.includes(u));
  if (!added.length) return;
  const now = Date.now();
  const notes = added.slice(0, 20).map((u, i) => ({ id: crypto.randomUUID(), at: now + i, from: u, kind: 'join', ...(u !== actor ? { by: actor } : {}) }));
  p.msgs = { up: [...(p.msgs?.up ?? []), ...notes], del: p.msgs?.del ?? [] };
}

export function joinByInvite(uid, code) {
  const { c, inv } = findInvite(code);
  if (c.members.includes(uid)) return c.id;
  const p = {
    col: 'chats', id: c.id, op: 'put',
    set: { members: [...c.members, uid], invites: c.invites.map((i) => (i === inv ? { ...i, used: (i.used ?? 0) + 1 } : i)) },
  };
  withJoinNotes(uid, c, p);
  const after = applyToDoc('chats', c, p);
  chats.save(after);
  broadcastChat(p, c, after);
  return c.id;
}
