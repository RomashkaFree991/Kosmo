// Проверка изменений от клиента: что пользователь вправе менять.
// Возвращает «очищенный» патч (лишнее отброшено) или бросает ApiError.

import { ApiError } from './auth.js';
import { users, chats as chatsDb } from './db.js';

const isRoom = (c) => c?.type === 'group' || c?.type === 'channel';
const isAdmin = (c, uid) => c?.owner === uid || (c?.admins ?? []).includes(uid);
const deny = (msg) => { throw new ApiError(403, 'forbidden', msg); };
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9]{3,32}$/;
const RESERVED = ['kosmo', 'admin', 'support', 'settings', 'official'];
const LIMIT_TEXT = 8000;

function checkUsername(name, exceptId) {
  if (!name) return;
  if (!USERNAME_RE.test(name) || RESERVED.includes(name)) throw new ApiError(400, 'bad_username', 'Invalid username');
  if (users.usernameTaken(name, exceptId)) throw new ApiError(409, 'username_taken', 'This username is taken');
}

// реакции/голоса: меняется только своё присутствие в списках
function onlyMine(oldMap = {}, newMap = {}, me) {
  const out = {};
  for (const [k, list] of Object.entries(oldMap)) {
    const rest = list.filter((u) => u !== me);
    if (rest.length) out[k] = rest;
  }
  for (const [k, list] of Object.entries(newMap ?? {})) {
    if (Array.isArray(list) && list.includes(me)) (out[k] ??= []).push(me);
  }
  return out;
}
function onlyMeAdded(oldList = [], newList = [], me) {
  const s = new Set(oldList);
  if ((newList ?? []).includes(me)) s.add(me);
  return [...s];
}
const strip = (m) => {
  if (typeof m.text === 'string' && m.text.length > LIMIT_TEXT) m.text = m.text.slice(0, LIMIT_TEXT);
  if (typeof m.caption === 'string' && m.caption.length > LIMIT_TEXT) m.caption = m.caption.slice(0, LIMIT_TEXT);
  return m;
};

/* ---------------------------------------------------------------------------
   Пользователь (только свой документ)
   --------------------------------------------------------------------------- */
const SELF_FIELDS = ['name', 'username', 'bio', 'avatar', 'privacy', 'chatPrefs', 'settings', 'security', 'reminders', 'messages'];

export function checkAccount(me, patch, current) {
  if (patch.id !== me) deny('You can only change your own profile');
  if (patch.op === 'del') deny('Use account deletion');
  const set = {};
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    if (!SELF_FIELDS.includes(k)) continue;
    if (k === 'name') { const n = String(v ?? '').trim().slice(0, 64); if (!n) throw new ApiError(400, 'bad_name', 'Name is required'); set.name = n; continue; }
    if (k === 'bio') { set.bio = String(v ?? '').slice(0, 140); continue; }
    if (k === 'username') { const u = String(v ?? ''); checkUsername(u, me); set.username = u; continue; }
    if (k === 'messages') {
      // клиент может только добавлять напоминания; остальное создаёт сервер
      const known = new Set((current.messages ?? []).map((m) => m.id));
      const added = (Array.isArray(v) ? v : []).filter((m) => !known.has(m.id) && m.kind === 'reminder').slice(0, 20);
      set.messages = [...(current.messages ?? []), ...added].slice(-200);
      continue;
    }
    set[k] = v;
  }
  return { col: 'accounts', id: me, op: 'put', set };
}

/* ---------------------------------------------------------------------------
   Чаты
   --------------------------------------------------------------------------- */
const DM_ID = (a, b) => [a, b].sort().join('_');
const IMMUTABLE = ['id', 'type', 'secret', 'createdAt', 'messages'];

function canPost(c, me) {
  if (!isRoom(c)) return c.members.includes(me);
  if (c.type === 'channel') return isAdmin(c, me);
  return c.members.includes(me);
}

// Новый чат
function checkNewChat(me, doc) {
  const members = [...new Set(doc.members ?? [])];
  if (!members.includes(me)) deny('You must be a member');
  if (isRoom(doc)) {
    if (doc.owner !== me) deny('Owner must be you');
    if (!String(doc.name ?? '').trim()) throw new ApiError(400, 'bad_name', 'Name is required');
    checkUsername(doc.username, doc.id);
    if (!doc.id.startsWith(`${doc.type}_`)) deny('Bad id');
    for (const u of members) {
      if (u === me) continue;
      const other = users.get(u);
      if (!other) deny('Unknown member');
      if (other.privacy?.groups === 'nobody' || (other.privacy?.blocked ?? []).includes(me)) deny('This person can’t be added');
    }
  } else {
    if (members.length !== 2) deny('A private chat has two members');
    const other = members.find((u) => u !== me);
    const expect = doc.secret ? `secret_${DM_ID(me, other)}` : DM_ID(me, other);
    if (doc.id !== expect) deny('Bad chat id');
    const o = users.get(other);
    if (!o) deny('Unknown user');
    if ((o.privacy?.blocked ?? []).includes(me)) deny('You can’t message this person');
    if (o.privacy?.messages === 'nobody') deny('This person doesn’t accept new messages');
  }
  for (const m of doc.messages ?? []) if (m.from !== me) deny('Messages must be yours');
  return { ...doc, members, admins: doc.admins ?? [], read: { [me]: Date.now() }, messages: (doc.messages ?? []).map(strip) };
}

export function checkChat(me, patch, old) {
  if (patch.op === 'del') {
    if (!old) return null;
    if (isRoom(old) ? old.owner === me : old.members.includes(me)) return patch;
    deny('Only the owner can delete this chat');
  }
  if (!old) {
    const doc = checkNewChat(me, { id: patch.id, ...(patch.set ?? {}), messages: patch.msgs?.up ?? [] });
    const { messages, ...set } = doc;
    return { col: 'chats', id: patch.id, op: 'put', set, msgs: messages.length ? { up: messages } : undefined };
  }

  const member = old.members.includes(me);
  const admin = isAdmin(old, me);
  const set = {};
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    if (IMMUTABLE.includes(k)) continue;
    if (k === 'read') { set.read = { ...(old.read ?? {}), [me]: Number(v?.[me]) || Date.now() }; continue; }
    if (k === 'scheduled') {
      const mine = (Array.isArray(v) ? v : []).filter((s) => s.from === me);
      set.scheduled = [...(old.scheduled ?? []).filter((s) => s.from !== me), ...mine].slice(0, 100);
      continue;
    }
    if (k === 'members') {
      const before = new Set(old.members);
      const after = new Set(Array.isArray(v) ? v : []);
      const added = [...after].filter((u) => !before.has(u));
      const removed = [...before].filter((u) => !after.has(u));
      if (!isRoom(old)) { if (added.length || removed.length) deny('Members of a private chat are fixed'); continue; }
      for (const u of added) {
        if (u === me) {
          // вступить: публичная группа/канал или обсуждение канала, где я подписчик
          const linkedCh = old.linkedChannel && chatsDb.get(old.linkedChannel);
          if (!old.username && !(linkedCh && linkedCh.members.includes(me))) deny('This chat is private');
          continue;
        }
        if (!(admin || (old.type === 'group' && member && old.settings?.invite !== false))) deny('You can’t add members');
        const other = users.get(u);
        if (!other || other.privacy?.groups === 'nobody' || (other.privacy?.blocked ?? []).includes(me)) deny('This person can’t be added');
      }
      for (const u of removed) {
        if (u === me) continue;                        // выйти может каждый
        if (u === old.owner) deny('The owner can’t be removed');
        if (!admin) deny('Only admins can remove members');
        if ((old.admins ?? []).includes(u) && old.owner !== me) deny('Only the owner can remove admins');
      }
      set.members = [...after];
      continue;
    }
    if (k === 'owner') {
      if (old.owner !== me) deny('Only the owner can transfer the chat');
      set.owner = v;
      continue;
    }
    if (k === 'admins') { if (old.owner !== me) deny('Only the owner can change admins'); set.admins = v; continue; }
    if (k === 'pinned' || k === 'ttl') {
      if (isRoom(old) ? !admin : !member) deny('Not allowed');
      set[k] = v;
      continue;
    }
    if (['name', 'username', 'bio', 'avatar', 'settings', 'linked', 'linkedChannel'].includes(k)) {
      if (k === 'linkedChannel') {
        // привязку группы делает админ канала, который сам админ этой группы
        const ch = v ? chatsDb.get(v) : null;
        if (!admin && !(ch && isAdmin(ch, me))) deny('Only admins can change this');
      } else if (!admin) deny('Only admins can change this');
      if (k === 'username') checkUsername(v, old.id);
      set[k] = v;
      continue;
    }
  }
  // отписка/вход меняет состав — остальное требует членства
  const joining = set.members && set.members.includes(me) && !member;
  if (!member && !joining) deny('You are not a member of this chat');

  const unset = (patch.unset ?? []).filter((k) => k === 'pinned' ? (isRoom(old) ? admin : member) : ['linked', 'linkedChannel'].includes(k) ? admin : false);
  const after = { ...old, ...set };
  const msgs = { up: [], del: [] };
  const byId = new Map(old.messages.map((m) => [m.id, m]));
  for (const m of patch.msgs?.up ?? []) {
    const prev = byId.get(m.id);
    if (!prev) {
      if (m.from !== me) deny('Messages must be yours');
      if (m.threadOf) {
        const ch = chatsDb.get(old.linkedChannel ?? m.threadOf.channel);
        if (!(after.members.includes(me) && ch && ch.members.includes(me))) deny('Not allowed');
      } else if (!canPost(after, me)) deny('You can’t post here');
      if (!isRoom(old)) {
        const other = users.get(old.members.find((u) => u !== me));
        if ((other?.privacy?.blocked ?? []).includes(me)) deny('You can’t message this person');
      }
      msgs.up.push(strip({ ...m, at: Math.min(Number(m.at) || Date.now(), Date.now() + 5000) }));
      continue;
    }
    if (prev.from === me) { msgs.up.push(strip({ ...m, from: me, at: prev.at })); continue; }
    // чужое сообщение: только мои реакции, голос, «скрыть у себя»
    const next = { ...prev };
    next.reactions = onlyMine(prev.reactions, m.reactions, me);
    if (!Object.keys(next.reactions).length) delete next.reactions;
    if (prev.poll && m.poll) {
      next.poll = { ...prev.poll, votes: prev.poll.closed ? prev.poll.votes : onlyMine(prev.poll.votes, m.poll.votes, me) };
      if (m.poll.closed && !prev.poll.closed && isAdmin(old, me)) next.poll.closed = true;
    }
    if (m.hiddenFor) next.hiddenFor = onlyMeAdded(prev.hiddenFor, m.hiddenFor, me);
    msgs.up.push(next);
  }
  for (const id of patch.msgs?.del ?? []) {
    const m = byId.get(id);
    if (!m) continue;
    const ok = m.from === me || (!isRoom(old) && member) || isAdmin(old, me) || (m.expiresAt && m.expiresAt <= Date.now() + 5000);
    if (!ok) deny('You can’t delete this message');
    msgs.del.push(id);
  }
  const out = { col: 'chats', id: patch.id, op: 'put' };
  if (Object.keys(set).length) out.set = set;
  if (unset.length) out.unset = unset;
  if (msgs.up.length || msgs.del.length) out.msgs = msgs;
  return out;
}

/* ---------------------------------------------------------------------------
   Посты ленты и истории
   --------------------------------------------------------------------------- */
export function checkPost(me, patch, old) {
  if (patch.op === 'del') { if (old && old.author !== me) deny('Only the author can delete'); return patch; }
  if (!old) {
    const doc = { ...(patch.set ?? {}) };
    if (doc.author !== me) deny('Author must be you');
    doc.text = String(doc.text ?? '').slice(0, 4000);
    doc.reactions = {}; doc.comments = []; doc.forwards = 0; doc.views = [me];
    doc.at = Date.now();
    return { col: 'feed', id: patch.id, op: 'put', set: doc };
  }
  if (old.author === me) {
    const { author, at, ...rest } = patch.set ?? {};
    return { col: 'feed', id: patch.id, op: 'put', set: rest };
  }
  const set = {};
  const s = patch.set ?? {};
  if (s.reactions) set.reactions = onlyMine(old.reactions, s.reactions, me);
  if (s.views) set.views = onlyMeAdded(old.views, s.views, me);
  if (s.forwards != null && s.forwards === (old.forwards ?? 0) + 1) set.forwards = s.forwards;
  if (s.comments) {
    const before = new Map((old.comments ?? []).map((c) => [c.id, c]));
    const nextIds = new Set(s.comments.map((c) => c.id));
    const kept = (old.comments ?? []).filter((c) => nextIds.has(c.id) || c.from !== me);   // удалить можно только своё
    const added = s.comments.filter((c) => !before.has(c.id) && c.from === me)
      .map((c) => ({ id: c.id, from: me, text: String(c.text ?? '').slice(0, 2000), at: Date.now() }));
    set.comments = [...kept, ...added];
  }
  return { col: 'feed', id: patch.id, op: 'put', set };
}

export function checkStory(me, patch, old) {
  if (patch.op === 'del') { if (old && old.author !== me) deny('Only the author can delete'); return patch; }
  if (!old) {
    const doc = { ...(patch.set ?? {}) };
    if (doc.author !== me) deny('Author must be you');
    doc.at = Date.now(); doc.views = [me]; doc.likes = [];
    return { col: 'stories', id: patch.id, op: 'put', set: doc };
  }
  if (old.author === me) return { col: 'stories', id: patch.id, op: 'put', set: { text: patch.set?.text ?? old.text } };
  const set = {};
  if (patch.set?.views) set.views = onlyMeAdded(old.views, patch.set.views, me);
  if (patch.set?.likes) {
    const had = (old.likes ?? []).includes(me);
    const has = patch.set.likes.includes(me);
    set.likes = has === had ? old.likes : has ? [...(old.likes ?? []), me] : old.likes.filter((u) => u !== me);
  }
  return { col: 'stories', id: patch.id, op: 'put', set };
}
