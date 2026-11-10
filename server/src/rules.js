// Проверка изменений от клиента: что пользователь вправе менять.
// Возвращает «очищенный» патч (лишнее отброшено) или бросает ApiError.

import crypto from 'node:crypto';
import { ApiError } from './auth.js';
import { users, chats as chatsDb } from './db.js';

const isRoom = (c) => c?.type === 'group' || c?.type === 'channel';
const isAdmin = (c, uid) => c?.owner === uid || (c?.admins ?? []).includes(uid);
const deny = (msg) => { throw new ApiError(403, 'forbidden', msg); };
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9]{3,32}$/;
const LIMIT_TEXT = 16000;
// отпечаток публичного ключа (тот же, что считает клиент)
const pubFingerprint = (pub) => (pub?.x ? crypto.createHash('sha256').update(`${pub.x}.${pub.y}`).digest('hex').slice(0, 32) : '');   // с запасом под шифротекст (e1:…)

function checkUsername(name, exceptId, ownerId) {
  if (!name) return;
  if (!USERNAME_RE.test(name)) throw new ApiError(400, 'bad_username', 'Invalid username');
  if (users.usernameTaken(name, exceptId, ownerId)) throw new ApiError(409, 'username_taken', 'This username is taken');
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
const SELF_FIELDS = ['name', 'username', 'bio', 'avatar', 'privacy', 'chatPrefs', 'settings', 'security', 'reminders', 'messages', 'bookmarks', 'status', 'e2ee', 'profileChannel', 'music', 'banner'];

export function checkAccount(me, patch, current) {
  if (patch.id !== me) deny('You can only change your own profile');
  if (patch.op === 'del') deny('Use account deletion');
  const set = {};
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    if (!SELF_FIELDS.includes(k)) continue;
    if (k === 'name') { const n = String(v ?? '').trim().slice(0, 64); if (!n) throw new ApiError(400, 'bad_name', 'Name is required'); set.name = n; continue; }
    if (k === 'bio') { set.bio = String(v ?? '').slice(0, 140); continue; }
    if (k === 'username') { const u = String(v ?? ''); checkUsername(u, me); set.username = u; continue; }
    // баннер профиля: фото или видео
    if (k === 'banner') {
      if (!v) { set.banner = null; continue; }
      if (!/^[a-f0-9]{32}$/.test(String(v.media ?? ''))) throw new ApiError(400, 'bad_banner', 'Bad banner file');
      set.banner = { media: v.media, type: v.type === 'video' ? 'video' : 'photo', ...(/^[a-f0-9]{32}$/.test(String(v.poster ?? '')) ? { poster: v.poster } : {}) };
      continue;
    }
    // музыка в профиле: свой загруженный аудиофайл
    if (k === 'music') {
      // плейлист до 50 треков (старый формат — один трек объектом)
      const list = (Array.isArray(v) ? v : v ? [v] : []).slice(0, 50);
      set.music = list.map((t) => {
        if (!/^[a-f0-9]{32}$/.test(String(t?.media ?? ''))) throw new ApiError(400, 'bad_music', 'Bad music file');
        return { media: t.media, title: String(t.title ?? '').slice(0, 80), artist: String(t.artist ?? '').slice(0, 60), dur: Math.max(0, Math.min(3600, Number(t.dur) || 0)) };
      });
      if (!set.music.length) set.music = null;
      continue;
    }
    // канал/группа в профиле: только публичная, где человек владелец
    if (k === 'profileChannel') {
      if (!v) { set.profileChannel = null; continue; }
      const c = chatsDb.get(String(v));
      if (!c || !isRoom(c) || !c.username || c.owner !== me) throw new ApiError(400, 'bad_channel', 'Only your public channel or group can be shown in your profile');
      set.profileChannel = c.id;
      continue;
    }
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
const IMMUTABLE = ['id', 'type', 'secret', 'saved', 'createdAt', 'messages'];

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
    // не больше 3 своих каналов и 3 своих групп
    const ROOM_LIMIT = 3;
    const owned = chatsDb.forUser(me).filter((c) => c.type === doc.type && c.owner === me && c.id !== doc.id).length;
    if (owned >= ROOM_LIMIT) throw new ApiError(403, 'room_limit', doc.type === 'channel' ? `You can have up to ${ROOM_LIMIT} channels` : `You can have up to ${ROOM_LIMIT} groups`);
    if (!String(doc.name ?? '').trim()) throw new ApiError(400, 'bad_name', 'Name is required');
    checkUsername(doc.username, doc.id, me);
    if (!doc.id.startsWith(`${doc.type}_`)) deny('Bad id');
    for (const u of members) {
      if (u === me) continue;
      const other = users.get(u);
      if (!other) deny('Unknown member');
      if (other.privacy?.groups === 'nobody' || (other.privacy?.blocked ?? []).includes(me)) deny('This person can’t be added');
    }
  } else if (doc.saved) {
    // «Избранное» — чат с самим собой
    if (doc.id !== `saved_${me}` || members.length !== 1) deny('Bad chat id');
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
    // ключ группы, зашифрованный для каждого участника (сквозное шифрование):
    // добавить можно только недостающие записи или заменить устаревшую
    // (участник сменил ключ) — чужие действующие записи не трогаются
    if (k === 'ekeys') {
      if (!member) deny('You are not a member of this chat');
      const cur = { ...(old.ekeys ?? {}) };
      for (const [u, entry] of Object.entries(v ?? {})) {
        if (!old.members.includes(u) || !entry || typeof entry.k !== 'string' || entry.by !== me && cur[u]?.k !== entry.k) continue;
        const fp = pubFingerprint(users.get(u)?.e2ee?.pub);
        if (!cur[u] || (cur[u].to !== fp && entry.to === fp)) cur[u] = { by: me, k: entry.k.slice(0, 400), iv: String(entry.iv ?? '').slice(0, 40), to: entry.to };
      }
      set.ekeys = cur;
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
    if (['name', 'username', 'bio', 'avatar', 'settings', 'linked', 'linkedChannel', 'topics', 'invites'].includes(k)) {
      if (k === 'linkedChannel') {
        // привязку группы делает админ канала, который сам админ этой группы
        const ch = v ? chatsDb.get(v) : null;
        if (!admin && !(ch && isAdmin(ch, me))) deny('Only admins can change this');
      } else if (!admin) deny('Only admins can change this');
      if (k === 'username' && v !== old.username) checkUsername(v, old.id);   // своё прежнее имя не проверяем
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
  let echo = false;   // сервер свёл правки — итог нужен и самому отправителю
  const byId = new Map(old.messages.map((m) => [m.id, m]));
  for (const m of patch.msgs?.up ?? []) {
    const prev = byId.get(m.id);
    if (!prev) {
      if (m.from !== me) deny('Messages must be yours');
      if (m.threadOf) {
        const ch = chatsDb.get(old.linkedChannel ?? m.threadOf.channel);
        if (!(after.members.includes(me) && ch && ch.members.includes(me))) deny('Not allowed');
      } else if (!canPost(after, me)) deny('You can’t post here');
      // медленный режим в группе: одно сообщение в N секунд (админам можно)
      const slow = Number(after.settings?.slowMode) || 0;
      if (slow && after.type === 'group' && !admin && !m.threadOf) {
        const last = old.messages.reduce((t, x) => (x.from === me && x.at > t ? x.at : t), 0);
        const wait = Math.ceil((last + slow * 1000 - Date.now()) / 1000);
        if (wait > 0) throw new ApiError(429, 'slow_mode', `Slow mode: wait ${wait} s`, { wait });
      }
      if (!isRoom(old) && !old.saved) {
        const other = users.get(old.members.find((u) => u !== me));
        if ((other?.privacy?.blocked ?? []).includes(me)) deny('You can’t message this person');
      }
      msgs.up.push(strip({ ...m, at: Math.min(Number(m.at) || Date.now(), Date.now() + 5000) }));
      continue;
    }
    if (prev.from === me) {
      // своё сообщение: правлю его, но чужие реакции, голоса и галочки остаются как на сервере
      // (иначе устаревшая копия у автора стирает то, что успели отметить другие)
      const next = strip({ ...m, from: me, at: prev.at });
      let merged = false;
      if (prev.reactions || m.reactions) {
        next.reactions = onlyMine(prev.reactions, m.reactions, me);
        if (!Object.keys(next.reactions).length) delete next.reactions;
        merged = true;
      }
      if (prev.poll && next.poll) { next.poll = { ...next.poll, votes: onlyMine(prev.poll.votes, next.poll.votes, me) }; merged = true; }
      if (prev.todo && next.todo) {
        const newItems = Array.isArray(next.todo.items) ? next.todo.items : [];
        const items = newItems.slice(0, 50).map((n) => {
          const old = (prev.todo.items ?? []).find((x) => x.id === n.id);
          const done = new Set((old?.done ?? []).filter((u) => u !== me));
          if ((n.done ?? []).includes(me)) done.add(me);
          return { ...n, by: old?.by ?? me, done: [...done] };
        });
        // пункты, которые добавили другие, а у автора их ещё нет, — не теряются
        for (const old of prev.todo.items ?? []) if (!items.some((x) => x.id === old.id) && old.by !== me) items.push(old);
        next.todo = { ...next.todo, items };
        merged = true;
      }
      if (prev.hiddenFor) next.hiddenFor = onlyMeAdded(prev.hiddenFor.filter((u) => u !== me), next.hiddenFor, me);
      if (prev.viewedBy) next.viewedBy = prev.viewedBy;
      msgs.up.push(next);
      if (merged) echo = true;
      continue;
    }
    // чужое сообщение: только мои реакции, голос, «скрыть у себя»
    const next = { ...prev };
    next.reactions = onlyMine(prev.reactions, m.reactions, me);
    if (!Object.keys(next.reactions).length) delete next.reactions;
    if (prev.poll && m.poll) {
      next.poll = { ...prev.poll, votes: prev.poll.closed ? prev.poll.votes : onlyMine(prev.poll.votes, m.poll.votes, me) };
      if (m.poll.closed && !prev.poll.closed && isAdmin(old, me)) next.poll.closed = true;
    }
    if (m.hiddenFor) next.hiddenFor = onlyMeAdded(prev.hiddenFor, m.hiddenFor, me);
    // одноразовое фото: отметка «я открыл»
    if (prev.viewOnce && m.viewedBy) {
      next.viewedBy = onlyMeAdded(prev.viewedBy, m.viewedBy, me);
      // посмотрели — фото удаляется, остаётся только след
      if (next.viewedBy.length) { delete next.media; delete next.mk; next.viewed = true; }
    }
    // общий список дел: свои галочки и новые пункты от участников
    if (prev.todo && m.todo) {
      const oldItems = prev.todo.items ?? [];
      const newItems = Array.isArray(m.todo.items) ? m.todo.items : [];
      const items = oldItems.map((it) => {
        const n = newItems.find((x) => x.id === it.id);
        if (!n) return it;
        const done = new Set((it.done ?? []).filter((u) => u !== me));
        if ((n.done ?? []).includes(me)) done.add(me);
        return { ...it, done: [...done] };
      });
      // «отмечает только автор» — чужие галочки не принимаются
      if (prev.todo.solo) items.splice(0, items.length, ...oldItems);
      if (prev.todo.open !== false) {
        for (const n of newItems) {
          if (oldItems.some((x) => x.id === n.id) || items.length >= 50) continue;
          items.push({ id: String(n.id).slice(0, 40), text: String(n.text ?? '').slice(0, 2000), by: me, done: (n.done ?? []).includes(me) ? [me] : [] });
        }
      }
      next.todo = { ...prev.todo, items };
      echo = true;
    }
    if (m.reactions || prev.reactions || (prev.poll && m.poll)) echo = true;
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
  if (echo) Object.defineProperty(out, 'echo', { value: true, enumerable: false });
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
    const { author, at, forwards, shareTo, shareKeys, reactions, views, comments, ...rest } = patch.set ?? {};
    const set = { ...rest, ...postShare(me, old, patch.set ?? {}) };
    // реакции, просмотры и комментарии автора — по тем же правилам, что у всех
    const other = checkPostOthers(me, patch.set ?? {}, old);
    return { col: 'feed', id: patch.id, op: 'put', set: { ...set, ...other } };
  }
  const s = patch.set ?? {};
  const set = { ...checkPostOthers(me, s, old), ...postShare(me, old, s) };
  return { col: 'feed', id: patch.id, op: 'put', set };
}

// Пересылка поста: один и тот же человек в один и тот же чат считается один раз.
// В документе хранятся только хэши пар «кто → куда», не сами чаты.
function postShare(me, old, s) {
  if (!s.shareTo) return {};
  const key = crypto.createHash('sha256').update(`${me}|${s.shareTo}`).digest('base64url').slice(0, 12);
  const keys = Array.isArray(old.shareKeys) ? old.shareKeys : [];
  if (keys.includes(key)) return {};
  return { shareKeys: [...keys, key].slice(-5000), forwards: (old.forwards ?? 0) + 1 };
}

function checkPostOthers(me, s, old) {
  const set = {};
  if (s.reactions) set.reactions = onlyMine(old.reactions, s.reactions, me);
  if (s.views) set.views = onlyMeAdded(old.views, s.views, me);
  if (s.comments) {
    const before = new Map((old.comments ?? []).map((c) => [c.id, c]));
    const nextIds = new Set(s.comments.map((c) => c.id));
    const kept = (old.comments ?? []).filter((c) => nextIds.has(c.id) || c.from !== me);   // удалить можно только своё
    const added = s.comments.filter((c) => !before.has(c.id) && c.from === me)
      .map((c) => ({ id: c.id, from: me, text: String(c.text ?? '').slice(0, 2000), at: Date.now() }));
    set.comments = [...kept, ...added];
  }
  return set;
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
