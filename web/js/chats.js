// Чаты: личные, группы и каналы. Список (закрепить / архив / удалить по долгому
// нажатию), архив отдельным экраном, чат Kosmo с уведомлениями о входах.
// В чате: вложения с подписью, голосовые с настоящей волной, свои эмодзи,
// реакции, ответ, изменение, закрепление, удаление (у себя или у всех),
// свой просмотрщик фото и видео, комментарии под постами каналов,
// альбомы, кружки, стикеры, опросы, звонки, отложенные и исчезающие
// сообщения, секретные чаты, свайпы (ответ / переслать), поиск по чату.
// Демо: переписка хранится в localStorage этого браузера, файлы — в IndexedDB.

import {
  $, $$, db, store, uid, toast, escapeHtml, userAvatarHtml, kosmoAvatar, cosmicBadge,
  formatDate, formatTime, refreshRefraction, timeAgo, patchList,
} from './core.js';
import { formatPhone, openSheet } from './phone.js';
import { state, openPanel, panelOpen, onPanelClose, overlayOpen } from './panels.js';
import { putBlob, mediaUrl, hydrateMedia, compressImage, mediaDuration, analyzeAudio } from './media.js';
import { EMOJI, EMOJI_IDS, REACTIONS, emojiSvg } from './emoji.js';
import { showUser } from './people.js';
import { openViewer } from './viewer.js';
import { posts } from './feeddata.js';
import { stickerHtml, stickerPickerHtml, stickerByRef } from './stickers.js';
import { pollHtml, openPollCreator, closePoll, retractVote } from './polls.js';
import { roundHtml, openRoundRecorder } from './round.js';
import { startCall } from './calls.js';
import { pickTime, schedule, myScheduled, openScheduledList, addReminder, TTL_OPTIONS, ttlLabel } from './schedule.js';

export const KOSMO = 'kosmo';
const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

/* ---------------------------------------------------------------------------
   Данные
   --------------------------------------------------------------------------- */
export const chats = {
  all() { return store.getJSON('chats', {}); },
  get(id) { return this.all()[id] ?? null; },
  idFor: (a, b) => [a, b].sort().join('_'),
  forUser(userId) { return Object.values(this.all()).filter((c) => c.members.includes(userId)); },
  save(chat) {
    const all = this.all();
    all[chat.id] = chat;
    store.setJSON('chats', all);
    return chat;
  },
  send(id, members, msg) {
    const all = this.all();
    const chat = all[id] ?? { id, members, messages: [], read: {} };
    const m = { id: uid(), at: Date.now(), ...msg };
    chat.messages.push(m);
    chat.read[m.from] = m.at;
    all[id] = chat;
    store.setJSON('chats', all);
    return m;
  },
  update(id, fn) {
    const all = this.all();
    if (!all[id]) return null;
    fn(all[id]);
    store.setJSON('chats', all);
    return all[id];
  },
  remove(id) {
    const all = this.all();
    delete all[id];
    store.setJSON('chats', all);
  },
  markRead(id, userId) { this.update(id, (c) => { c.read[userId] = Date.now(); }); },
};

// Группы и каналы
export const isRoom = (c) => c?.type === 'group' || c?.type === 'channel';
export const isSecret = (c) => Boolean(c?.secret);
export const secretIdFor = (a, b) => `secret_${[a, b].sort().join('_')}`;
export function roleOf(c, userId) {
  if (!c) return null;
  if (c.owner === userId) return 'owner';
  if (c.admins?.includes(userId)) return 'admin';
  return c.members.includes(userId) ? 'member' : null;
}
export const isAdmin = (c, userId) => ['owner', 'admin'].includes(roleOf(c, userId));
function canPost(c, me) {
  if (!c || !isRoom(c)) return true;
  return c.type === 'channel' ? isAdmin(c, me) : Boolean(roleOf(c, me));
}

// Чужой профиль с учётом приватности (скрытое фото и т. п.)
export function publicUser(u) {
  if (!u || u.id === state.acc?.user.id) return u;
  if (u.privacy?.avatar !== 'nobody' || !u.avatar?.photo) return u;
  return { ...u, avatar: { ...u.avatar, photo: null } };
}

const prefs = (id) => state.acc.user.chatPrefs?.[id] ?? {};

function setPref(id, patch) {
  db.update(state.acc.user.id, (u) => {
    u.chatPrefs ??= {};
    u.chatPrefs[id] = { ...(u.chatPrefs[id] ?? {}), ...patch };
  });
  state.reload();
}

/* ---------------------------------------------------------------------------
   Иконки
   --------------------------------------------------------------------------- */
const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  desktop: svg('<rect x="3" y="4.5" width="18" height="12" rx="2.2"/><path d="M8.5 20h7M12 16.5V20"/>'),
  phone: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>'),
  tablet: svg('<rect x="4.5" y="2.5" width="15" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5z"/>'),
  pinMap: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  shield: svg('<path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
  pin: svg('<path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/>'),
  unpin: svg('<path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6M4 4l16 16"/>'),
  archive: svg('<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'),
  unarchive: svg('<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M12 18v-5.5M9.5 15l2.5-2.5 2.5 2.5"/>'),
  trash: svg('<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M10 11v6M14 11v6"/>'),
  leave: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>'),
  photo: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l4.8-4.3 3.4 3 3.3-3.4 4.5 4.2"/>'),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>'),
  code: svg('<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>'),
  music: svg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: svg('<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  reply: svg('<path d="M10 8L5 12.5l5 4.5"/><path d="M5.5 12.5H14a5 5 0 0 1 5 5v1"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
  users: svg('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 6.2a3 3 0 0 1 0 5.6M17 14.2a5 5 0 0 1 3.5 4.8"/>'),
  channel: svg('<path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6"/>'),
  comment: svg('<path d="M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  forward: svg('<path d="M14 8l5 4.5-5 4.5"/><path d="M18.5 12.5H10a5 5 0 0 0-5 5v1"/>'),
  chevron: svg('<path d="M9.5 6l6 6-6 6"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  timer: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>'),
  call: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  callOut: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2zM15 3.5h5.5V9M20.5 3.5L14 10"/>'),
  callIn: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2zM20.5 9.5H15V4M15 9.5L21.5 3"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>'),
  bell: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  poll: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  round: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
  more: svg('<circle cx="12" cy="5.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor"/>'),
  invite: svg('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6"/>'),
  silent: svg('<path d="M6 16.5V11a6 6 0 0 1 9.4-4.9M18 11v5.5l1.5 2H7M10 20.5a2.2 2.2 0 0 0 4 0M3 3l18 18"/>'),
};
export const deviceIcon = (type) => ICON[type] ?? ICON.desktop;
export const KOSMO_NAME = `<span class="name-with-badge">Kosmo ${cosmicBadge('official')}</span>`;

// Галочки «отправлено / прочитано»; cls — анимация появления
function ticks(read, cls = '') {
  return `<svg class="ticks${read ? ' is-read' : ''} ${cls}" viewBox="0 0 24 24" aria-label="${read ? 'Read' : 'Sent'}">
    <path class="t1" pathLength="1" d="${read ? 'M2.5 12.5l4 4L15 8' : 'M5 12.5l4.5 4.5L19 7.5'}"/>
    ${read ? '<path class="t2" pathLength="1" d="M10.5 15.5l1 1L20 8"/>' : ''}
  </svg>`;
}

const shortTime = (t) => (new Date(t).toDateString() === new Date().toDateString() ? formatTime(t) : formatDate(t).split(',')[0]);
export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function displayName(u) {
  return `<span class="name-with-badge">${escapeHtml(u.name)}${u.role === 'owner' ? cosmicBadge('owner') : ''}</span>`;
}

export function roomAvatar(c, cls = '') {
  return userAvatarHtml({ name: c.name, avatar: c.avatar ?? {} }, `${cls} avatar-room`);
}

function roomName(c) {
  const icon = c.type === 'channel' ? ICON.channel : ICON.users;
  return `<span class="name-with-badge"><span class="room-icon">${icon}</span>${escapeHtml(c.name)}</span>`;
}

/* ---------------------------------------------------------------------------
   Сообщения Kosmo: приветствие, новые входы, смена номера
   --------------------------------------------------------------------------- */
function kosmoCopy(m) {
  const first = escapeHtml(state.acc.user.name.split(/\s+/)[0]);
  if (m.kind === 'welcome') return { title: `Welcome to Kosmo, ${first}!`, text: 'Your account has been created. This device was added as a trusted device.' };
  if (m.kind === 'login') return { title: 'New login to your account', text: 'A device signed in to your account. If it wasn\'t you, terminate this session.' };
  if (m.kind === 'passcode') return { title: 'Passcode changed', text: 'The passcode of your account was changed.' };
  if (m.kind === 'reminder') return { title: 'Reminder', text: escapeHtml(m.text) };
  return {
    title: 'Phone number changed',
    text: `Your number was changed from <b>${escapeHtml(formatPhone(m.from))}</b> to <b>${escapeHtml(formatPhone(m.to))}</b>.`,
  };
}

const canControl = (s) => state.acc.session.trusted && s.id !== state.acc.session.id && !s.first;

function kosmoAction(m) {
  if (m.kind !== 'login') return '';
  const s = state.acc.user.sessions.find((x) => x.id === m.sid);
  if (m.sid === state.acc.session.id) return `<span class="msg-chip">${ICON.shield}This device</span>`;
  if (!s) return '<span class="msg-chip is-muted">Session terminated</span>';
  if (canControl(s)) return `<button class="btn btn-danger msg-btn" type="button" data-terminate="${s.id}">Terminate session</button>`;
  return '<span class="msg-chip is-muted">Only a trusted device can terminate it</span>';
}

const detailRow = (icon, label, value) =>
  `<div class="msg-row">${icon}<span class="msg-label">${label}</span><span class="msg-value">${escapeHtml(value)}</span></div>`;

function kosmoCard(m, isNew) {
  const copy = kosmoCopy(m);
  if (m.kind === 'reminder') {
    return `
    <article class="msg msg-reminder${isNew ? ' is-new' : ''}">
      <h3 class="msg-title">${ICON.bell}${copy.title}</h3>
      <p class="msg-text">${copy.text}</p>
      ${chats.get(m.chatId) ? `<button class="btn btn-secondary glass msg-btn" type="button" data-goto="${m.chatId}" data-goto-msg="${m.msgId}">Open message</button>` : ''}
      <span class="msg-time">${formatTime(m.at)}</span>
    </article>`;
  }
  return `
    <article class="msg${isNew ? ' is-new' : ''}">
      <h3 class="msg-title">${copy.title}</h3>
      <p class="msg-text">${copy.text}</p>
      <div class="msg-rows">
        ${detailRow(deviceIcon(m.type), 'Device', m.device)}
        ${detailRow(ICON.globe, 'IP address', m.ip)}
        ${detailRow(ICON.pinMap, 'Location', m.location)}
        ${detailRow(ICON.clock, 'Time', formatDate(m.at))}
      </div>
      ${kosmoAction(m)}
      <span class="msg-time">${formatTime(m.at)}</span>
    </article>`;
}

function kosmoMessages() {
  const cleared = prefs(KOSMO).clearedAt ?? 0;
  const alerts = state.acc.user.security?.loginAlerts !== false;
  return state.acc.user.messages.filter((m) => m.at > cleared && (alerts || m.kind !== 'login'));
}

function kosmoUnread() {
  const readAt = state.acc.session.readAt ?? state.acc.session.createdAt - 1;
  return kosmoMessages().filter((m) => m.at > readAt).length;
}

/* ---------------------------------------------------------------------------
   Список чатов
   --------------------------------------------------------------------------- */
export function previewText(m) {
  if (!m) return '';
  const cap = m.caption ? ` · ${m.caption}` : '';
  switch (m.kind) {
    case 'photo': return `Photo${cap}`;
    case 'video': return `Video${cap}`;
    case 'voice': return `Voice message · ${fmtDur(m.duration ?? 0)}`;
    case 'audio': return m.name ?? 'Music';
    case 'code': return `Code · ${m.lang}${cap}`;
    case 'emoji': return `${EMOJI[m.emoji]?.label ?? 'Emoji'} emoji`;
    case 'post': return 'Shared post';
    case 'album': return `Album · ${m.items.length}${cap}`;
    case 'round': return `Video message · ${fmtDur(m.duration ?? 0)}`;
    case 'sticker': return `Sticker${m.sticker?.text ? ` · ${m.sticker.text}` : ''}`;
    case 'poll': return `${m.poll.quiz ? 'Quiz' : 'Poll'}: ${m.poll.question}`;
    case 'invite': return 'Invitation';
    case 'call': return `${m.video ? 'Video call' : 'Call'}${m.duration ? ` · ${fmtDur(m.duration)}` : ''}`;
    default: return m.text;
  }
}

// Сообщения чата, которые видит этот пользователь (комментарии к постам — отдельно)
function visible(c, me) {
  const cleared = prefs(c.id).clearedAt ?? 0;
  const now = Date.now();
  return c.messages.filter((m) => m.at > cleared && !m.hiddenFor?.includes(me) && (!m.expiresAt || m.expiresAt > now));
}
const mainMessages = (c, me) => visible(c, me).filter((m) => !m.threadOf);

function listItems() {
  const me = state.acc.user.id;
  const items = [];
  const kMsgs = kosmoMessages();
  if (kMsgs.length) {
    const p = prefs(KOSMO);
    const last = kMsgs[kMsgs.length - 1];
    items.push({
      id: KOSMO, kosmo: true, lastAt: last.at, unread: kosmoUnread(),
      pinned: p.pinned ?? 1, archived: p.archived, preview: kosmoCopy(last).title,
    });
  }
  for (const c of chats.forUser(me)) {
    const p = prefs(c.id);
    const msgs = mainMessages(c, me);
    if (!msgs.length && !isRoom(c) && !isSecret(c)) continue;
    const last = msgs[msgs.length - 1];
    const lastAt = last?.at ?? c.createdAt ?? 0;
    const unread = msgs.filter((m) => m.from !== me && m.at > (c.read[me] ?? 0)).length;
    if (isRoom(c)) {
      const who = last && c.type === 'group' ? (last.from === me ? 'You' : db.get(last.from)?.name.split(/\s+/)[0] ?? '') : '';
      items.push({
        id: c.id, room: c, lastAt, unread, pinned: p.pinned ?? 0, archived: p.archived,
        preview: last ? `${who ? `<b>${escapeHtml(who)}:</b> ` : ''}${escapeHtml(previewText(last))}` : (c.type === 'channel' ? 'Channel created' : 'Group created'),
      });
      continue;
    }
    const otherId = c.members.find((x) => x !== me) ?? me;
    const other = publicUser(db.get(otherId)) ?? { id: otherId, name: 'Deleted account', username: '', avatar: {} };
    items.push({
      id: c.id, other, lastAt, unread, pinned: p.pinned ?? 0, archived: p.archived, secret: isSecret(c),
      preview: last ? `${last.from === me ? '<b>You:</b> ' : ''}${escapeHtml(previewText(last))}` : 'Secret chat created',
      mineRead: last?.from === me && isRead(c, last),
      mine: last?.from === me,
    });
  }
  return items.sort((a, b) => (b.pinned || 0) - (a.pinned || 0) || b.lastAt - a.lastAt);
}

// Прочитано ли моё сообщение (с учётом отключённых отчётов о прочтении)
function isRead(c, m) {
  const me = state.acc.user.id;
  if (state.acc.user.privacy?.readReceipts === false) return false;
  return c.members.some((uidX) => uidX !== me && (c.read[uidX] ?? 0) >= m.at
    && db.get(uidX)?.privacy?.readReceipts !== false);
}

function chatRow(it, i) {
  const avatar = it.kosmo ? kosmoAvatar() : it.room ? roomAvatar(it.room) : userAvatarHtml(it.other);
  const name = it.kosmo ? KOSMO_NAME : it.room ? roomName(it.room)
    : it.secret ? `<span class="name-with-badge is-secret"><span class="room-icon">${ICON.lock}</span>${escapeHtml(it.other.name)}</span>` : displayName(it.other);
  const status = it.unread ? `<span class="badge">${it.unread}</span>` : it.pinned ? svg('<path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/>', 'i pin') : '';
  return `
    <li class="chat ripple-host" data-chat="${it.id}" tabindex="0" role="button">
      ${avatar}
      <div class="chat-top"><span class="chat-name">${name}</span></div>
      <div class="chat-meta"><span class="chat-time">${it.mine ? ticks(it.mineRead) : ''}${shortTime(it.lastAt)}</span>${status}</div>
      <div class="chat-bottom"><span class="chat-text">${it.preview}</span></div>
    </li>`;
}

// Архив — отдельный экран: в основном списке архивных чатов нет,
// сверху только строка «Archived chats», а в архиве вместо «+» — «назад»
let archiveMode = false;
let listSig = '';

function setArchiveMode(on) {
  if (archiveMode === on) return;
  archiveMode = on;
  $('#new-btn').hidden = on;
  $('#archive-back').hidden = !on;
  $('#chats-title').textContent = on ? 'Archive' : 'Chats';
  const list = $('#chat-list');
  list.classList.remove('slide-in-left', 'slide-in-right');
  void list.offsetWidth;
  list.classList.add(on ? 'slide-in-right' : 'slide-in-left');
  listSig = '';
  renderChatList();
  refreshRefraction();
}
$('#archive-back').addEventListener('click', () => setArchiveMode(false));
export const leaveArchive = () => setArchiveMode(false);

// Папки: все, личные, группы, каналы, непрочитанные
const FOLDERS = [['all', 'All'], ['personal', 'Personal'], ['groups', 'Groups'], ['channels', 'Channels'], ['unread', 'Unread']];
let folder = 'all';
const inFolder = (it, f) => (f === 'all' ? true
  : f === 'personal' ? !it.room
    : f === 'groups' ? it.room?.type === 'group'
      : f === 'channels' ? it.room?.type === 'channel'
        : it.unread > 0);

function paintFolders(items) {
  const box = $('#folders');
  box.hidden = archiveMode;
  box.innerHTML = FOLDERS.map(([id, label]) => {
    const n = items.filter((it) => !it.archived && inFolder(it, id)).reduce((a, it) => a + (it.unread || 0), 0);
    return `<button class="folder${folder === id ? ' is-active' : ''}" type="button" role="tab" aria-selected="${folder === id}" data-folder="${id}">${label}${n && id !== 'all' ? `<span class="folder-n">${n}</span>` : ''}</button>`;
  }).join('');
}
$('#folders').addEventListener('click', (e) => {
  const f = e.target.closest('[data-folder]');
  if (!f || f.dataset.folder === folder) return;
  folder = f.dataset.folder;
  listSig = '';
  renderChatList();
  f.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
});

export function renderChatList() {
  const items = listItems();
  const main = items.filter((it) => !it.archived && inFolder(it, folder));
  const archived = items.filter((it) => it.archived);
  const total = items.reduce((n, it) => n + (it.unread || 0), 0);
  const badge = $('#chats-badge');
  badge.hidden = !total;
  badge.textContent = total;
  if (archiveMode && !archived.length) { setArchiveMode(false); return; }
  const sig = JSON.stringify([items.map((it) => [it.id, it.lastAt, it.unread, it.pinned, it.archived, it.preview, it.mineRead, it.other?.avatar, it.other?.name, it.room?.name, it.room?.avatar]), archiveMode, folder]);
  if (sig === listSig) return;
  listSig = sig;

  paintFolders(items);
  // по ключам: строки, которые не поменялись, не перерисовываются и не мигают
  const rows = [];
  const add = (key, html) => rows.push({ key, sig: html, html });
  if (archiveMode) {
    archived.forEach((it, i) => add(it.id, chatRow(it, i)));
  } else {
    const archiveRow = archived.length && folder === 'all' ? `
      <li class="chat archive-row ripple-host" data-archive-open tabindex="0" role="button">
        <span class="avatar archive-avatar">${ICON.archive}</span>
        <div class="chat-top"><span class="chat-name">Archived chats</span></div>
        <div class="chat-meta">${archived.some((a) => a.unread) ? `<span class="badge is-muted">${archived.reduce((n, a) => n + a.unread, 0)}</span>` : ''}</div>
        <div class="chat-bottom"><span class="chat-text">${archived.map((a) => (a.kosmo ? 'Kosmo' : escapeHtml(a.room?.name ?? a.other.name))).join(', ')}</span></div>
      </li>` : '';
    if (archiveRow) add('archive', archiveRow);
    main.forEach((it, i) => add(it.id, chatRow(it, i)));
    if (!main.length) {
      add('empty', `<li class="list-empty">${ICON.users}<span>${folder === 'all' ? 'No chats yet. Find people in Search or create a group.' : 'No chats in this folder'}</span></li>`);
    }
  }
  // появление лесенкой — только у новых строк
  let n = 0;
  patchList($('#chat-list'), rows, (el) => { el.classList.add('is-new'); el.style.setProperty('--i', Math.min(n++, 12)); });
  hydrateMedia($('#chat-list'));
}

/* ---------------------------------------------------------------------------
   Долгое нажатие / правый клик по чату: закрепить, архив, удалить
   --------------------------------------------------------------------------- */
const ctx = { el: null, row: null, id: null, suppressClick: false };

function placeMenu(menu, rect, x, height) {
  const top = rect.bottom + 8 + height < innerHeight ? rect.bottom + 8 : rect.top - height - 8;
  menu.style.top = `${Math.max(12, top)}px`;
  menu.style.left = `${Math.min(Math.max(16, (x ?? rect.left + 24) - 40), innerWidth - 246)}px`;
  menu.style.transformOrigin = top > rect.top ? '40px 0' : '40px 100%';
}

function openCtx(row, x) {
  closeCtx();
  const id = row.dataset.chat;
  const item = listItems().find((it) => it.id === id);
  if (!item) return;
  navigator.vibrate?.(12);
  ctx.row = row;
  ctx.id = id;
  ctx.item = item;
  row.classList.add('is-held');
  const scrim = document.createElement('div');
  scrim.className = 'ctx-scrim';
  const menu = document.createElement('div');
  menu.className = 'menu ctx-menu glass glass-text';
  menu.setAttribute('role', 'menu');
  const del = item.room
    ? `<button class="menu-item danger" type="button" role="menuitem" data-ctx="delete">${ICON.leave}${item.room.type === 'channel' ? 'Leave channel' : 'Leave group'}</button>`
    : `<button class="menu-item danger" type="button" role="menuitem" data-ctx="delete">${ICON.trash}Delete</button>`;
  menu.innerHTML = `
    <button class="menu-item" type="button" role="menuitem" data-ctx="pin">${item.pinned ? ICON.unpin : ICON.pin}${item.pinned ? 'Unpin' : 'Pin'}</button>
    <button class="menu-item" type="button" role="menuitem" data-ctx="archive">${item.archived ? ICON.unarchive : ICON.archive}${item.archived ? 'Unarchive' : 'Archive'}</button>
    ${del}`;
  $('#app').append(scrim, menu);
  ctx.el = menu;
  ctx.scrim = scrim;
  placeMenu(menu, row.getBoundingClientRect(), x, 200);
  scrim.addEventListener('click', closeCtx);
  menu.querySelector('.menu-item').focus({ preventScroll: true });
  refreshRefraction();
}

function closeCtx() {
  if (!ctx.el) return;
  const { el, scrim, row } = ctx;
  el.classList.add('is-closing');
  scrim.classList.add('is-closing');
  row?.classList.remove('is-held');
  setTimeout(() => { el.remove(); scrim.remove(); }, 170);
  ctx.el = ctx.row = null;
}

// Выйти из группы/канала (владелец может удалить её для всех)
export function leaveRoom(id, forAll = false) {
  const me = state.acc.user.id;
  const c = chats.get(id);
  if (!c) return;
  if (forAll && c.owner === me) {
    chats.remove(id);
    // ссылка на обсуждение у связанного канала/группы тоже снимается
    if (c.linked) chats.update(c.linked, (x) => { delete x.linked; });
  } else {
    chats.update(id, (x) => {
      x.members = x.members.filter((u) => u !== me);
      x.admins = (x.admins ?? []).filter((u) => u !== me);
      // владелец уходит — права переходят первому админу или участнику
      if (x.owner === me) x.owner = x.admins[0] ?? x.members[0] ?? null;
    });
  }
  setPref(id, { pinned: 0, archived: false });
  if (openChatId() === id) $('#panel-chat [data-close-panel]').click();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ctx]');
  if (!btn || !ctx.el) return;
  const { id, item } = ctx;
  const action = btn.dataset.ctx;
  if (action === 'pin') {
    setPref(id, { pinned: item.pinned ? 0 : Date.now() });
    toast(item.pinned ? 'Unpinned' : 'Pinned');
  } else if (action === 'archive') {
    setPref(id, { archived: !item.archived, pinned: 0 });
    toast(item.archived ? 'Moved back to chats' : 'Moved to archive');
  } else if (action === 'delete') {
    // подтверждение прямо в меню
    if (item.room) {
      const owner = item.room.owner === state.acc.user.id;
      const what = item.room.type === 'channel' ? 'channel' : 'group';
      ctx.el.innerHTML = `
        <p class="ctx-confirm">Leave this ${what}?</p>
        <button class="menu-item danger" type="button" data-ctx="leave">${ICON.leave}Leave ${what}</button>
        ${owner ? `<button class="menu-item danger" type="button" data-ctx="leave-all">${ICON.trash}Delete ${what} for everyone</button>` : ''}
        <button class="menu-item" type="button" data-ctx="cancel">Cancel</button>`;
      return;
    }
    const name = item.kosmo ? 'Kosmo' : escapeHtml(item.other.name.split(/\s+/)[0]);
    ctx.el.innerHTML = `
      <p class="ctx-confirm">Delete this chat?</p>
      <button class="menu-item danger" type="button" data-ctx="delete-me">${ICON.user}Delete for me</button>
      ${item.kosmo ? '' : `<button class="menu-item danger" type="button" data-ctx="delete-all">${ICON.users}Delete for me and ${name}</button>`}
      <button class="menu-item" type="button" data-ctx="cancel">Cancel</button>`;
    return;
  } else if (action === 'delete-me') {
    setPref(id, { clearedAt: Date.now(), pinned: 0, archived: false });
    toast('Chat deleted for you');
  } else if (action === 'delete-all') {
    chats.remove(id);
    setPref(id, { pinned: 0, archived: false });
    toast('Chat deleted for both of you');
  } else if (action === 'leave' || action === 'leave-all') {
    leaveRoom(id, action === 'leave-all');
    toast(action === 'leave-all' ? 'Deleted for everyone' : 'You left');
  }
  closeCtx();
  renderChatList();
});

(() => {
  const list = $('#chat-list');
  let timer = null;
  let start = null;
  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.chat[data-chat]');
    if (!row || e.button > 0) return;
    start = { x: e.clientX, y: e.clientY };
    row.classList.add('is-pressing');
    timer = setTimeout(() => {
      ctx.suppressClick = true;
      row.classList.remove('is-pressing');
      openCtx(row, start.x);
    }, 450);
  });
  const cancel = () => { clearTimeout(timer); $$('.chat.is-pressing', list).forEach((r) => r.classList.remove('is-pressing')); };
  list.addEventListener('pointermove', (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel(); });
  list.addEventListener('pointerup', cancel);
  list.addEventListener('pointerleave', cancel);
  list.addEventListener('pointercancel', cancel);
  list.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.chat[data-chat]');
    if (!row) return;
    e.preventDefault();
    cancel();
    openCtx(row, e.clientX);
  });
  list.addEventListener('click', (e) => {
    if (ctx.suppressClick) { ctx.suppressClick = false; e.stopPropagation(); return; }
    if (e.target.closest('[data-archive-open]')) { setArchiveMode(true); return; }
    const row = e.target.closest('.chat[data-chat]');
    if (row) openChat(row.dataset.chat);
  }, true);
  list.addEventListener('keydown', (e) => {
    if (e.target.closest('[data-archive-open]') && e.key === 'Enter') { setArchiveMode(true); return; }
    const row = e.target.closest('.chat[data-chat]');
    if (row && e.key === 'Enter') openChat(row.dataset.chat);
    if (row && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); openCtx(row); }
  });
  // Escape закрывает только меню, а не весь чат
  document.addEventListener('keydown', (e) => {
    const pickerOpen = !$('#emoji-picker').hidden || !$('#attach-menu').hidden;
    if (e.key !== 'Escape' || !(ctx.el || mm.el || more || quick || pickerOpen)) return;
    e.stopImmediatePropagation();
    closeCtx();
    closeMsgMenu();
    closeMore();
    closeQuick();
    closePicker();
    closeAttach();
  });
})();

/* ---------------------------------------------------------------------------
   Окно чата
   --------------------------------------------------------------------------- */
const open = { id: null, otherId: null };
let known = new Set();
const tickMemo = new Map();      // id сообщения → 'sent' | 'read'
const reactMemo = new Map();     // id сообщения → реакции при прошлой отрисовке
const panel = $('#panel-chat');
const scroller = $('#chat-scroll');
const messagesBox = $('#messages');

export const openChatId = () => (panelOpen() === 'chat' ? open.id : null);
const isDm = () => open.id && open.id !== KOSMO && !isRoom(chats.get(open.id));
const curChat = () => (open.id && open.id !== KOSMO ? chats.get(open.id) : null);

/* ---------- Прокрутка: чат всегда открывается внизу и «прилипает» к низу ---------- */
let stick = true;
scroller.addEventListener('scroll', () => {
  stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
}, { passive: true });
// фото и видео догружаются позже и меняют высоту — держим низ на месте
new ResizeObserver(() => { if (stick) scroller.scrollTop = scroller.scrollHeight; }).observe(messagesBox);
function toBottom(smooth = false) {
  stick = true;
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

export function openChat(id) {
  if (id === KOSMO) {
    open.id = KOSMO;
    open.otherId = null;
  } else {
    const c = chats.get(id);
    open.id = id;
    open.otherId = c && !isRoom(c) ? c.members.find((x) => x !== state.acc.user.id) ?? null : null;
  }
  showChat();
}

// Личный чат с человеком (даже если сообщений ещё нет)
export function openDm(userId) {
  open.id = chats.idFor(state.acc.user.id, userId);
  open.otherId = userId;
  showChat();
}

document.addEventListener('kosmo:open-dm', (e) => {
  const id = chats.idFor(state.acc.user.id, e.detail);
  if (openChatId() === id) return;
  openDm(e.detail);
});

function chatMessages() {
  if (open.id === KOSMO) return kosmoMessages();
  const c = curChat();
  return c ? mainMessages(c, state.acc.user.id) : [];
}

function markOpenRead() {
  if (open.id === KOSMO) {
    db.update(state.acc.user.id, (u) => {
      const s = u.sessions.find((x) => x.id === state.acc.session.id);
      if (s) s.readAt = Date.now();
    });
  } else if (curChat()) {
    chats.markRead(open.id, state.acc.user.id);
  }
  state.reload();
}

// Онлайн / был(а) недавно — с учётом приватности
function lastSeen(u) {
  if (!u) return '';
  if (u.privacy?.lastSeen === 'nobody') return 'last seen recently';
  const t = Math.max(...u.sessions.map((s) => s.lastActive ?? 0), 0);
  if (Date.now() - t < 120_000) return 'online';
  return t ? `last seen ${timeAgo(t)}` : 'last seen recently';
}

function paintHeader() {
  const c = curChat();
  let title;
  let sub;
  let avatar;
  if (open.id === KOSMO) {
    title = KOSMO_NAME; sub = 'official account'; avatar = kosmoAvatar('avatar-head');
  } else if (isRoom(c)) {
    title = roomName(c);
    sub = c.type === 'channel' ? `${c.members.length} subscriber${c.members.length === 1 ? '' : 's'}` : `${c.members.length} member${c.members.length === 1 ? '' : 's'}`;
    avatar = roomAvatar(c, 'avatar-head');
  } else {
    const other = publicUser(db.get(open.otherId));
    title = isSecret(c) ? `<span class="name-with-badge is-secret"><span class="room-icon">${ICON.lock}</span>${escapeHtml(other?.name ?? 'Deleted account')}</span>`
      : displayName(other ?? { name: 'Deleted account' });
    sub = other ? lastSeen(other) : '';
    if (isSecret(c)) sub = 'secret chat';
    avatar = userAvatarHtml(other ?? { name: '?' }, 'avatar-head');
  }
  if (c?.ttl) sub += ` · auto-delete ${ttlLabel(c.ttl)}`;
  $('#chat-more').hidden = open.id === KOSMO;
  $('#chat-title').innerHTML = title;
  $('#chat-sub').textContent = sub;
  $('#chat-head-avatar').innerHTML = avatar;
  hydrateMedia($('#chat-head-avatar'));
}

// Внизу: поле ввода, кнопка «Join» или строка «писать нельзя»
function paintComposer() {
  const me = state.acc.user.id;
  const c = curChat();
  let mode = 'compose';
  let text = '';
  if (open.id === KOSMO) { mode = 'ro'; text = 'Only Kosmo can send messages here'; } else if (isRoom(c)) {
    if (!roleOf(c, me)) mode = 'join';
    else if (!canPost(c, me)) { mode = 'ro'; text = 'Only admins can post in this channel'; }
  } else {
    const other = db.get(open.otherId);
    const hasHistory = (c?.messages.length ?? 0) > 0;
    const first = other?.name.split(/\s+/)[0];
    if (!other) { mode = 'ro'; text = 'This account was deleted'; } else if (state.acc.user.privacy?.blocked?.includes(other.id)) {
      mode = 'ro'; text = `You blocked ${first}`;
    } else if (other.privacy?.blocked?.includes(me)) {
      mode = 'ro'; text = `You can't message ${first}`;
    } else if (other.privacy?.messages === 'nobody' && !hasHistory) {
      mode = 'ro'; text = `${first} doesn't accept new messages`;
    }
  }
  // в группе можно запретить участникам отправлять медиа
  panel.classList.toggle('no-media', c?.type === 'group' && c.settings?.media === false && !isAdmin(c, me));
  panel.dataset.composer = mode;
  $$('[data-rooms-only]', attachMenu).forEach((b) => { b.hidden = !isRoom(c); });
  if (mode === 'ro') $('#composer-ro-text').textContent = text;
  if (mode === 'join') $('#join-btn').textContent = c.type === 'channel' ? 'Join channel' : 'Join group';
}

$('#join-btn').addEventListener('click', () => {
  const me = state.acc.user.id;
  chats.update(open.id, (c) => { if (!c.members.includes(me)) c.members.push(me); });
  state.reload();
  toast('You joined');
  paintHeader();
  paintComposer();
  renderChatList();
});

function showChat() {
  const c = curChat();
  const isKosmo = open.id === KOSMO;
  panel.classList.toggle('is-kosmo', isKosmo);
  panel.classList.toggle('is-channel', c?.type === 'channel');
  panel.classList.toggle('is-group', c?.type === 'group');
  paintHeader();
  paintComposer();
  const msgs = chatMessages();
  const me = state.acc.user.id;
  // непрочитанные появятся с анимацией
  const unread = isKosmo ? kosmoUnread() : msgs.filter((m) => m.from !== me && m.at > (c?.read[me] ?? 0)).length;
  known = new Set(msgs.slice(0, msgs.length - unread).map((m) => m.id));
  tickMemo.clear();
  reactMemo.clear();
  markOpenRead();
  resetComposer();
  renderMessages();
  renderChatList();
  openPanel('chat');
  toBottom();
  requestAnimationFrame(() => toBottom());
  if (panel.dataset.composer === 'compose') setTimeout(() => input.focus({ preventScroll: true }), 380);
}

onPanelClose('chat', () => {
  stopRecording(false);
  closeAttach();
  closePicker();
  closeMsgMenu();
  player.pause();
});

// Тап по имени или аватару в шапке — профиль человека или информация о группе/канале
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-open-user]') || !open.id || open.id === KOSMO) return;
  if (isRoom(curChat())) emit('kosmo:open-room', open.id);
  else if (open.otherId) showUser(open.otherId);
});

function quoteHtml(m, all) {
  const target = all.find((x) => x.id === m.replyTo);
  if (!target) return '<div class="b-reply is-gone"><b>Deleted message</b></div>';
  const who = target.from === state.acc.user.id ? 'You' : escapeHtml(db.get(target.from)?.name ?? 'Deleted account');
  return `<button class="b-reply" type="button" data-jump="${target.id}"><b>${who}</b><span>${escapeHtml(previewText(target))}</span></button>`;
}

export function reactionsHtml(m, scope = 'msg', anim = false) {
  const me = state.acc.user.id;
  const entries = Object.entries(m.reactions ?? {}).filter(([, users]) => users.length);
  if (!entries.length) return '';
  const prev = reactMemo.get(m.id) ?? {};
  return `<div class="reactions">${entries.map(([id, users]) => {
    const changed = anim && (prev[id]?.length ?? 0) < users.length;
    return `<button class="reaction${users.includes(me) ? ' is-mine' : ''}${changed ? ' is-new' : ''}" type="button" data-react-toggle="${id}" data-${scope}="${m.id}" aria-label="${EMOJI[id]?.label} ${users.length}">
      ${emojiSvg(id)}<span>${users.length}</span>
    </button>`;
  }).join('')}</div>`;
}

function waveBars(m) {
  const n = m.wave?.length ? m.wave.length : 32;
  return Array.from({ length: n }, (_, i) => {
    // настоящая волна из записи; у старых сообщений — псевдо-волна из id
    const h = m.wave?.length ? Math.round(m.wave[i] * 100) : 25 + ((m.id.charCodeAt(i % m.id.length) * (i + 7)) % 75);
    return `<span style="height:${Math.max(10, h)}%"></span>`;
  }).join('');
}

function albumHtml(m) {
  const n = m.items.length;
  return `<div class="b-album" data-count="${Math.min(n, 6)}">${m.items.slice(0, 6).map((it, i) => `
    <button class="b-album-item" type="button" data-view-media="${m.id}:${i}" aria-label="Open ${it.type}">
      ${it.type === 'video' ? `<video data-media="${it.media}" muted playsinline preload="metadata"></video><span class="b-play-ov">${ICON.play}</span>`
        : `<img data-media="${it.media}" alt="">`}
      ${i === 5 && n > 6 ? `<span class="post-more">+${n - 6}</span>` : ''}
    </button>`).join('')}</div>`;
}

function inviteHtml(m) {
  const me = state.acc.user.id;
  const room = chats.get(m.room);
  const what = room?.type === 'channel' ? 'channel' : 'group';
  const from = m.from === me ? 'You' : escapeHtml(db.get(m.from)?.name ?? 'Someone');
  const to = m.from === me ? escapeHtml(db.get(m.to)?.name.split(/\s+/)[0] ?? 'them') : 'you';
  if (!room) return `<div class="b-invite is-gone">${ICON.invite}<span>This ${what} no longer exists</span></div>`;
  return `
    <div class="b-invite">
      <div class="b-invite-head">${roomAvatar(room, 'avatar-sm')}<span><b>${escapeHtml(room.name)}</b><small>${room.type === 'channel' ? 'Channel' : 'Group'} · ${room.members.length} ${room.type === 'channel' ? 'subscribers' : 'members'}</small></span></div>
      <p class="b-invite-text">${from} added ${to} to the ${what}</p>
      <button class="b-invite-btn" type="button" data-goto="${room.id}">${room.type === 'channel' ? 'Open channel' : 'Open group'}</button>
    </div>`;
}

function callHtml(m) {
  const mine = m.from === state.acc.user.id;
  const missed = m.status !== 'ended';
  const title = m.status === 'declined' ? 'Declined call' : m.status === 'busy' ? 'Line busy' : missed ? (mine ? 'Cancelled call' : 'Missed call') : mine ? 'Outgoing call' : 'Incoming call';
  return `
    <div class="b-call${missed ? ' is-missed' : ''}">
      <span class="b-call-icon">${mine ? ICON.callOut : ICON.callIn}</span>
      <span class="b-call-text"><b>${m.video ? title.replace('call', 'video call') : title}</b><small>${m.duration ? fmtDur(m.duration) : formatTime(m.at)}</small></span>
      <button class="b-call-back" type="button" data-call-back="${m.video ? 'video' : 'voice'}" aria-label="Call back">${m.video ? ICON.video : ICON.call}</button>
    </div>`;
}

export function mediaBody(m, chatId = null) {
  switch (m.kind) {
    case 'album': return albumHtml(m);
    case 'round': return roundHtml(m);
    case 'sticker': return stickerHtml(m.sticker, 'sticker-big');
    case 'poll': return pollHtml(m, chatId);
    case 'invite': return inviteHtml(m);
    case 'call': return callHtml(m);
    case 'photo':
      return `<button class="b-photo-btn" type="button" data-view-media="${m.id}" aria-label="Open photo"><img class="b-photo" data-media="${m.media}" alt="Photo" style="aspect-ratio:${m.w || 4}/${m.h || 3}"></button>`;
    case 'video':
      return `<button class="b-video-btn" type="button" data-view-media="${m.id}" aria-label="Play video">
        <video class="b-video" data-media="${m.media}" muted playsinline preload="metadata"></video>
        <span class="b-play-ov">${ICON.play}</span>
        ${m.duration ? `<span class="b-dur-ov">${fmtDur(m.duration)}</span>` : ''}
      </button>`;
    case 'voice':
    case 'audio':
      return `
        <div class="b-player" data-player="${m.media}" data-dur="${m.duration ?? 0}">
          <button class="b-play" type="button" aria-label="Play">${ICON.play}</button>
          <div class="b-track">
            ${m.kind === 'voice' ? `<div class="b-wave-wrap"><div class="b-wave">${waveBars(m)}</div><div class="b-wave b-wave-fill">${waveBars(m)}</div></div>` : `<div class="b-name">${escapeHtml(m.name ?? 'Audio')}</div><div class="b-progress"><span></span></div>`}
            <span class="b-dur">${fmtDur(m.duration ?? 0)}</span>
          </div>
        </div>`;
    case 'code':
      return `
        <div class="b-code">
          <div class="b-code-head"><span>${escapeHtml(m.lang)}</span><button type="button" data-copy-code aria-label="Copy code">${ICON.copy}</button></div>
          <pre><code>${escapeHtml(m.text)}</code></pre>
        </div>`;
    case 'emoji':
      return emojiSvg(m.emoji, 'emoji-big');
    case 'post': {
      const p = posts.get(m.post);
      if (!p) return '<div class="b-post is-gone">This post was deleted</div>';
      const author = publicUser(db.get(p.author));
      const first = p.media?.[0];
      return `<button class="b-post" type="button" data-open-post="${p.id}">
        <span class="b-post-head">${userAvatarHtml(author ?? { name: '?' }, 'avatar-xs')}<b>${escapeHtml(author?.name ?? 'Deleted account')}</b></span>
        ${first ? `<span class="b-post-thumb">${first.type === 'video' ? `<video data-media="${first.media}" muted playsinline preload="metadata"></video>` : `<img data-media="${first.media}" alt="">`}</span>` : ''}
        ${p.text ? `<span class="b-post-text">${escapeHtml(p.text)}</span>` : ''}
        <span class="b-post-foot">${ICON.forward}Shared from Feed</span>
      </button>`;
    }
    default:
      return `<p class="b-text">${linkify(m.text)}</p>`;
  }
}

// @username — ссылка на профиль; адреса сайтов — ссылки
export function linkify(text) {
  return escapeHtml(text ?? '')
    .replace(/(^|[\s(])@([a-z0-9]{3,32})\b/gi, (all, pre, name) => `${pre}<button class="mention" type="button" data-mention="${name.toLowerCase()}">@${name}</button>`)
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,!?)]/g, (url) => `<a class="b-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    .replace(/\n/g, '<br>');
}

function bubble(m, all, c, anim = false) {
  const me = state.acc.user.id;
  const mine = m.from === me;
  const room = isRoom(c);
  const channel = c?.type === 'channel';
  const read = mine && !channel && c && isRead(c, m);
  // анимация галочек: первая рисуется при отправке, вторая — когда прочитали
  let tickCls = '';
  if (anim) {
    const was = tickMemo.get(m.id);
    tickCls = !mine ? '' : !was && !known.has(m.id) ? 'tick-in' : was === 'sent' && read ? 'tick-read' : '';
    tickMemo.set(m.id, read ? 'read' : 'sent');
  }
  const sender = room && !channel && !mine ? publicUser(db.get(m.from)) : null;
  const signature = channel && c.settings?.signatures ? db.get(m.from)?.name : null;
  const side = channel ? 'theirs channel-post' : mine ? 'mine' : 'theirs';
  const caption = m.caption && ['photo', 'video', 'code', 'album'].includes(m.kind) ? `<p class="b-text b-caption">${linkify(m.caption)}</p>` : '';
  const views = channel ? Object.values(c.read).filter((t) => t >= m.at).length : 0;
  const comments = channel && c.linked ? (chats.get(c.linked)?.messages ?? []).filter((x) => x.threadOf?.post === m.id).length : null;
  const fwdUser = m.fwd && db.get(m.fwd.from);
  const fwd = m.fwd ? `<span class="b-fwd">${ICON.forward}Forwarded from&nbsp;${fwdUser ? `<button type="button" data-user-open="${m.fwd.from}">${escapeHtml(fwdUser.name)}</button>` : `<b>${escapeHtml(m.fwd.name ?? 'Hidden user')}</b>`}</span>` : '';
  const reactions = reactionsHtml(m, 'msg', anim);
  const meta = `<span class="b-meta">${m.expiresAt ? `<span class="b-ttl" title="Disappears ${formatDate(m.expiresAt)}">${ICON.timer}</span>` : ''}${m.silent ? `<span class="b-ttl">${ICON.silent}</span>` : ''}${signature ? `<em class="b-sign">${escapeHtml(signature)}</em>` : ''}${m.edited ? '<em>edited</em>' : ''}${channel ? `${ICON.eye}${views}&nbsp;` : ''}${formatTime(m.at)}${mine && !channel ? ticks(read, tickCls) : ''}</span>`;
  const html = `
    <div class="bubble-row ${side}" data-id="${m.id}">
      ${sender ? `<button class="b-avatar" type="button" data-user-open="${m.from}" aria-label="${escapeHtml(sender.name)}">${userAvatarHtml(sender, 'avatar-xs')}</button>` : ''}
      <span class="swipe-ic swipe-reply" aria-hidden="true">${ICON.reply}</span>
      <span class="swipe-ic swipe-fwd" aria-hidden="true">${ICON.forward}</span>
      <div class="bubble kind-${m.kind ?? 'text'}${caption ? ' has-caption' : ''}${reactions ? ' has-reactions' : ''}">
        ${channel ? `<button class="b-sender b-channel" type="button" data-open-user>${roomAvatar(c, 'avatar-xs')}${escapeHtml(c.name)}</button>` : ''}
        ${sender ? `<button class="b-sender" type="button" data-user-open="${m.from}">${escapeHtml(sender.name)}</button>` : ''}
        ${fwd}
        ${m.replyTo ? quoteHtml(m, all) : ''}
        ${mediaBody(m, c?.id)}
        ${caption}
        ${reactions ? `<div class="b-foot">${reactions}${meta}</div>` : meta}
        ${comments != null ? `<button class="b-comments" type="button" data-thread="${m.id}">${ICON.comment}<span>${comments ? `${comments} comment${comments === 1 ? '' : 's'}` : 'Leave a comment'}</span>${ICON.chevron}</button>` : ''}
      </div>
    </div>`;
  if (anim) reactMemo.set(m.id, structuredClone(m.reactions ?? {}));
  return html;
}

function emptyState() {
  const c = curChat();
  if (isRoom(c)) {
    return `
      <div class="chat-empty">
        <div class="empty-orbit" aria-hidden="true">${roomAvatar(c, 'avatar-empty')}<span class="orbit-ring"></span><span class="orbit-ring r2"></span><span class="orbit-moon"></span></div>
        <h3>${c.type === 'channel' ? 'Channel created' : 'Group created'}</h3>
        <p>${c.type === 'channel' ? 'Post news, photos and videos. Link a group in channel info to get comments.' : 'Invite people and start talking.'}</p>
      </div>`;
  }
  const other = publicUser(db.get(open.otherId));
  const first = escapeHtml((other?.name ?? 'them').split(/\s+/)[0]);
  return `
    <div class="chat-empty">
      <div class="empty-orbit" aria-hidden="true">
        ${other ? userAvatarHtml(other, 'avatar-empty') : ''}
        <span class="orbit-ring"></span><span class="orbit-ring r2"></span>
        <span class="orbit-moon"></span>
      </div>
      <h3>No messages yet</h3>
      <p>Send ${first} a message, a photo or a voice note.</p>
      ${panel.dataset.composer === 'compose' ? `<button class="btn btn-secondary glass" type="button" data-say-hello>${emojiSvg('heart', 'emoji-inline')}Say hello</button>` : ''}
    </div>`;
}

function paintPinned() {
  const bar = $('#pinned-bar');
  const c = curChat();
  const msgs = chatMessages();
  const m = c?.pinned && msgs.find((x) => x.id === c.pinned);
  bar.hidden = !m;
  panel.classList.toggle('has-pinned', Boolean(m));
  $('#pinned-close').hidden = !(m && (!isRoom(c) || isAdmin(c, state.acc.user.id)));
  if (m) $('#pinned-preview').textContent = previewText(m);
}

export function renderMessages({ scroll = false } = {}) {
  if (!open.id) return;
  const msgs = chatMessages();
  const c = curChat();
  paintPinned();
  paintScheduled();
  if (!msgs.length && open.id !== KOSMO) {
    messagesBox.innerHTML = emptyState();
    hydrateMedia(messagesBox);
    return;
  }
  // по ключам: перерисовываются только изменившиеся сообщения —
  // остальные не мигают и не проигрывают анимацию заново
  const rows = [];
  let lastDay = '';
  for (const m of msgs) {
    const day = new Date(m.at).toDateString();
    if (day !== lastDay) {
      const chip = `<div class="day-chip">${formatDate(m.at).split(',')[0]}</div>`;
      rows.push({ key: `day:${day}`, sig: chip, html: chip });
      lastDay = day;
    }
    if (open.id === KOSMO) {
      const html = kosmoCard(m, false);
      rows.push({ key: m.id, sig: html, html });
    } else {
      rows.push({ key: m.id, sig: bubble(m, msgs, c), get html() { return bubble(m, msgs, c, true); } });
    }
  }
  patchList(messagesBox, rows, (el, key) => { if (!key.startsWith('day:') && !known.has(key)) el.classList.add('is-new'); });
  msgs.forEach((m) => known.add(m.id));
  if (searchQ) markSearch();
  hydrateMedia(messagesBox);
  if (scroll) toBottom(true);
}

document.addEventListener('kosmo:chat-updated', (e) => { if (openChatId() && e.detail === open.id) renderMessages({ scroll: stick }); renderChatList(); });

// Новое сообщение пришло (или что-то изменилось), пока чат открыт
export function refreshOpenChat() {
  if (!openChatId()) return;
  if (open.id !== KOSMO && !curChat() && !open.otherId) { $('#panel-chat [data-close-panel]').click(); return; }
  const before = known.size;
  markOpenRead();
  paintHeader();
  paintComposer();
  renderMessages({ scroll: chatMessages().length > before && stick });
}

function jumpTo(id) {
  const row = messagesBox.querySelector(`.bubble-row[data-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('is-flash');
  void row.offsetWidth;
  row.classList.add('is-flash');
}

$('#pinned-jump').addEventListener('click', () => { const c = curChat(); if (c?.pinned) jumpTo(c.pinned); });
$('#pinned-close').addEventListener('click', () => {
  chats.update(open.id, (c) => { delete c.pinned; });
  renderMessages();
  toast('Message unpinned');
});

/* ---------------------------------------------------------------------------
   Отправка, ответ, изменение
   --------------------------------------------------------------------------- */
let compose = null;   // { mode: 'reply' | 'edit', id }

function send(msg, { at = null, silent = false } = {}) {
  const me = state.acc.user.id;
  const extra = compose?.mode === 'reply' ? { replyTo: compose.id } : {};
  const c = curChat();
  const members = c?.members ?? [me, open.otherId];
  // отложенная отправка
  if (at) {
    schedule(open.id, members, { ...extra, ...msg, ...(silent ? { silent: true } : {}) }, at);
    setCompose(null);
    renderMessages();
    return;
  }
  const m = chats.send(open.id, members, { from: me, kind: 'text', ...extra, ...msg, ...(silent ? { silent: true } : {}) });
  // исчезающие сообщения: таймер чата
  if (c?.ttl) chats.update(open.id, (x) => { const y = x.messages.find((z) => z.id === m.id); if (y) y.expiresAt = y.at + x.ttl * 1000; });
  // удалённый или архивный чат возвращается в список
  const p = prefs(open.id);
  if (p.archived) setPref(open.id, { archived: false });
  setCompose(null);
  state.reload();
  renderMessages({ scroll: true });
  renderChatList();
}

// Отправить в любой чат (пересылка постов из ленты и сообщений)
export function sendToChat(chatId, msg) {
  const me = state.acc.user.id;
  const c = chats.get(chatId);
  if (c?.ttl) msg = { ...msg, expiresAt: Date.now() + c.ttl * 1000 };
  if (chatId.startsWith('dm:')) {
    const other = chatId.slice(3);
    chats.send(chats.idFor(me, other), [me, other], { from: me, ...msg });
  } else if (c) {
    chats.send(chatId, c.members, { from: me, ...msg });
  }
  renderChatList();
}

// Куда можно переслать: личные чаты, группы, свои каналы
export function forwardTargets() {
  const me = state.acc.user.id;
  const rows = [];
  for (const c of chats.forUser(me)) {
    if (isSecret(c)) continue;
    if (isRoom(c)) {
      if (!canPost(c, me)) continue;
      rows.push({ id: c.id, html: `${roomAvatar(c)}<div class="chat-top"><span class="chat-name">${roomName(c)}</span></div><div class="chat-meta"></div><div class="chat-bottom"><span class="chat-text">${c.type}</span></div>` });
    } else {
      const other = publicUser(db.get(c.members.find((x) => x !== me) ?? me));
      if (!other) continue;
      rows.push({ id: c.id, html: `${userAvatarHtml(other)}<div class="chat-top"><span class="chat-name">${displayName(other)}</span></div><div class="chat-meta"></div><div class="chat-bottom"><span class="chat-text">${other.username ? `@${escapeHtml(other.username)}` : `ID ${escapeHtml(other.publicId)}`}</span></div>` });
    }
  }
  return rows.map((r) => `<li class="chat ripple-host" data-forward="${r.id}" tabindex="0" role="button">${r.html}</li>`).join('')
    || '<li class="list-empty"><span>No chats to share to yet</span></li>';
}

function setCompose(next) {
  compose = next;
  const bar = $('#compose-bar');
  bar.hidden = !next;
  panel.classList.toggle('is-composing', Boolean(next));
  if (!next) return;
  const m = chatMessages().find((x) => x.id === next.id);
  if (!m) { setCompose(null); return; }
  $('#cb-icon').innerHTML = next.mode === 'edit' ? ICON.edit : ICON.reply;
  $('#cb-title').textContent = next.mode === 'edit' ? 'Edit message'
    : `Reply to ${m.from === state.acc.user.id ? 'yourself' : db.get(m.from)?.name ?? 'message'}`;
  $('#cb-preview').textContent = previewText(m);
  if (next.mode === 'edit') {
    input.value = m.caption ?? m.text ?? '';
    autosize();
    setMode('send');
  }
  input.focus({ preventScroll: true });
  refreshRefraction();
}

$('#cb-close').addEventListener('click', () => {
  if (compose?.mode === 'edit') { input.value = ''; autosize(); setMode('voice'); }
  setCompose(null);
});

// Все фото и видео чата (и из альбомов) — для листания в просмотрщике
export function mediaOf(msgs, c) {
  const out = [];
  for (const m of msgs) {
    const title = c?.type === 'channel' ? c.name : m.from === state.acc.user.id ? 'You' : db.get(m.from)?.name ?? '';
    const base = { caption: m.caption, title, sub: formatDate(m.at) };
    if (m.kind === 'photo' || m.kind === 'video') out.push({ ...base, id: m.id, type: m.kind, media: m.media });
    if (m.kind === 'album') m.items.forEach((it, i) => out.push({ ...base, id: `${m.id}:${i}`, type: it.type, media: it.media }));
  }
  return out;
}
const chatMedia = () => mediaOf(chatMessages(), curChat());

/* ---------- Пересылка сообщений ---------- */
const FWD_FIELDS = ['kind', 'text', 'media', 'w', 'h', 'duration', 'wave', 'lang', 'caption', 'emoji', 'items', 'name', 'post', 'sticker'];
export function forwardMessage(m) {
  if (isSecret(curChat())) { toast('Messages from secret chats can’t be forwarded'); return; }
  if (m.kind === 'poll' || m.kind === 'invite' || m.kind === 'call') { toast('This message can’t be forwarded'); return; }
  const author = m.fwd ?? { from: m.from, name: db.get(m.from)?.name };
  openSheet('forward', {
    title: 'Forward to',
    items: forwardTargets(),
    onPick: (chatId) => {
      const copy = Object.fromEntries(FWD_FIELDS.filter((k) => m[k] !== undefined).map((k) => [k, structuredClone(m[k])]));
      sendToChat(chatId, { ...copy, fwd: author });
      toast('Message forwarded');
      if (chatId === open.id) renderMessages({ scroll: true });
    },
  });
}

// Профиль по @username: человек, группа или канал
function openMention(name) {
  const u = Object.values(db.all()).find((x) => x.username === name);
  if (u) { if (u.id !== state.acc.user.id) showUser(u.id); else toast('This is you'); return; }
  const room = Object.values(chats.all()).find((x) => isRoom(x) && x.username === name);
  if (room) { emit('kosmo:open-room', room.id); return; }
  toast(`@${name} not found`);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-say-hello]')) send({ kind: 'emoji', emoji: 'heart' });
  const copyBtn = e.target.closest('[data-copy-code]');
  if (copyBtn) {
    navigator.clipboard?.writeText(copyBtn.closest('.b-code').querySelector('code').textContent)
      .then(() => toast('Code copied'), () => toast('Could not copy'));
  }
  const view = e.target.closest('#messages [data-view-media]');
  if (view) {
    const items = chatMedia();
    openViewer(items, Math.max(0, items.findIndex((x) => x.id === view.dataset.viewMedia)));
  }
  const jump = e.target.closest('[data-jump]');
  if (jump) jumpTo(jump.dataset.jump);
  const r = e.target.closest('[data-react-toggle][data-msg]');
  if (r) toggleReaction(r.dataset.msg, r.dataset.reactToggle);
  const who = e.target.closest('#messages [data-user-open]');
  if (who) { if (who.dataset.userOpen !== state.acc.user.id && db.get(who.dataset.userOpen)) showUser(who.dataset.userOpen); return; }
  const men = e.target.closest('[data-mention]');
  if (men) { openMention(men.dataset.mention); return; }
  const go = e.target.closest('[data-goto]');
  if (go) {
    if (!chats.get(go.dataset.goto)) { toast('This chat no longer exists'); return; }
    openChat(go.dataset.goto);
    if (go.dataset.gotoMsg) setTimeout(() => jumpTo(go.dataset.gotoMsg), 450);
    return;
  }
  const cb = e.target.closest('#messages [data-call-back]');
  if (cb && open.otherId) startCall(open.otherId, cb.dataset.callBack === 'video');
  const th = e.target.closest('[data-thread]');
  if (th) emit('kosmo:open-thread', { channel: open.id, post: th.dataset.thread });
  const post = e.target.closest('[data-open-post]');
  if (post) emit('kosmo:open-post', post.dataset.openPost);
});

/* ---------------------------------------------------------------------------
   Реакции (одна на человека, как в Telegram)
   --------------------------------------------------------------------------- */
function toggleReaction(msgId, emoji) {
  const me = state.acc.user.id;
  let added = false;
  chats.update(open.id, (c) => {
    const m = c.messages.find((x) => x.id === msgId);
    if (!m) return;
    m.reactions ??= {};
    const had = m.reactions[emoji]?.includes(me);
    for (const [k, users] of Object.entries(m.reactions)) {
      m.reactions[k] = users.filter((u) => u !== me);
      if (!m.reactions[k].length) delete m.reactions[k];
    }
    if (!had) {
      (m.reactions[emoji] ??= []).push(me);
      added = true;
    }
  });
  const from = messagesBox.querySelector(`.bubble-row[data-id="${msgId}"] .bubble`)?.getBoundingClientRect();
  renderMessages();
  if (added) {
    navigator.vibrate?.(10);
    const chip = messagesBox.querySelector(`.bubble-row[data-id="${msgId}"] [data-react-toggle="${emoji}"]`);
    if (chip) flyReaction(emoji, from, chip);
  }
}

// Большая эмодзи вылетает из сообщения и «садится» в реакцию, вокруг — искры
export function flyReaction(emoji, fromRect, chip) {
  const to = chip.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'react-fly';
  fly.innerHTML = emojiSvg(emoji);
  const size = 84;
  const sx = (fromRect?.left ?? to.left) + (fromRect?.width ?? 0) / 2 - size / 2;
  const sy = (fromRect?.top ?? to.top) + (fromRect?.height ?? 0) / 2 - size / 2;
  const tx = to.left + 4 - sx;
  const ty = to.top + to.height / 2 - 10 - sy;
  Object.assign(fly.style, { left: `${sx}px`, top: `${sy}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(fly);
  chip.classList.add('is-landing');
  fly.animate([
    { transform: 'scale(0.4)', opacity: 0 },
    { transform: 'scale(1.15)', opacity: 1, offset: 0.35 },
    { transform: 'scale(1)', opacity: 1, offset: 0.6 },
    { transform: `translate(${tx}px, ${ty}px) scale(0.24)`, opacity: 1 },
  ], { duration: 820, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }).finished.then(() => {
    fly.remove();
    chip.classList.remove('is-landing');
    chip.classList.add('is-landed');
    burst(chip);
  });
}

function burst(el) {
  const r = el.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'burst';
  box.style.left = `${r.left + 14}px`;
  box.style.top = `${r.top + r.height / 2}px`;
  box.innerHTML = Array.from({ length: 10 }, (_, i) => `<span style="--a:${i * 36}deg"></span>`).join('');
  document.body.append(box);
  setTimeout(() => box.remove(), 700);
}

/* ---------------------------------------------------------------------------
   Долгое нажатие на сообщение: реакции и действия
   --------------------------------------------------------------------------- */
const mm = { el: null, scrim: null, clone: null, id: null };

function openMsgMenu(row) {
  closeMsgMenu();
  const id = row.dataset.id;
  const m = chatMessages().find((x) => x.id === id);
  if (!m) return;
  navigator.vibrate?.(12);
  mm.id = id;
  const me = state.acc.user.id;
  const mine = m.from === me;
  const c = curChat();
  const admin = isRoom(c) && isAdmin(c, me);
  const bubbleEl = row.querySelector('.bubble');
  const rect = bubbleEl.getBoundingClientRect();

  const scrim = document.createElement('div');
  scrim.className = 'ctx-scrim';
  // копия сообщения поверх затемнения, как в iOS
  const clone = bubbleEl.cloneNode(true);
  clone.classList.add('msg-clone');
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;

  const wrap = document.createElement('div');
  wrap.className = `msg-menu ${mine && c?.type !== 'channel' ? 'is-mine' : ''}`;
  const myReaction = Object.entries(m.reactions ?? {}).find(([, u]) => u.includes(me))?.[0];
  const reactable = !(c?.type === 'channel' && c.settings?.reactions === false);
  const secret = isSecret(c);
  const textual = !secret && (['text', 'code'].includes(m.kind ?? 'text') || m.caption);
  const editable = mine && !m.fwd && ((m.kind ?? 'text') === 'text' || ['photo', 'video', 'code', 'album'].includes(m.kind));
  const canPin = !isRoom(c) || admin;
  const forwardable = !secret && !['poll', 'invite', 'call'].includes(m.kind);
  const voted = m.poll && Object.values(m.poll.votes).some((u) => u.includes(me));
  const actions = [
    canPost(c, me) && `<button class="menu-item" type="button" data-mm="reply">${ICON.reply}Reply</button>`,
    forwardable && `<button class="menu-item" type="button" data-mm="forward">${ICON.forward}Forward</button>`,
    textual && `<button class="menu-item" type="button" data-mm="copy">${ICON.copy}Copy</button>`,
    editable && `<button class="menu-item" type="button" data-mm="edit">${ICON.edit}Edit</button>`,
    canPin && `<button class="menu-item" type="button" data-mm="pin">${c?.pinned === id ? ICON.unpin : ICON.pin}${c?.pinned === id ? 'Unpin' : 'Pin'}</button>`,
    `<button class="menu-item" type="button" data-mm="remind">${ICON.bell}Remind me</button>`,
    m.poll && voted && !m.poll.quiz && !m.poll.closed && `<button class="menu-item" type="button" data-mm="retract">${ICON.poll}Retract vote</button>`,
    m.poll && !m.poll.closed && (mine || admin) && `<button class="menu-item" type="button" data-mm="stop-poll">${ICON.stop}Stop poll</button>`,
    `<button class="menu-item danger" type="button" data-mm="delete">${ICON.trash}Delete</button>`,
  ].filter(Boolean);
  wrap.innerHTML = `
    ${reactable ? `<div class="react-bar glass glass-text" role="group" aria-label="Reactions">
      ${REACTIONS.map((e, i) => `<button class="react-opt${e === myReaction ? ' is-mine' : ''}" type="button" style="--i:${i}" data-react-pick="${e}" aria-label="${EMOJI[e].label}">${emojiSvg(e)}</button>`).join('')}
    </div>` : ''}
    <div class="menu msg-actions glass glass-text" role="menu">${actions.join('')}</div>`;
  $('#app').append(scrim, clone, wrap);
  mm.el = wrap;
  mm.scrim = scrim;
  mm.clone = clone;

  // раскладка: реакции над сообщением, действия под ним; всё влезает в экран
  const barH = reactable ? 56 : -8;
  const actH = actions.length * 46 + 12;
  const total = barH + 8 + rect.height + 8 + actH;
  let top = rect.top - barH - 8;
  top = Math.max(12, Math.min(top, innerHeight - total - 12));
  const cloneTop = top + barH + 8;
  clone.animate([{ transform: 'none' }, { transform: `translateY(${cloneTop - rect.top}px) scale(1.03)` }],
    { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'forwards' });
  const side = wrap.classList.contains('is-mine') ? `right:${Math.max(10, innerWidth - rect.right)}px` : `left:${Math.max(10, rect.left)}px`;
  wrap.style.cssText = `top:${top}px;${side};--gap:${rect.height + 16}px`;
  scrim.addEventListener('click', closeMsgMenu);
  refreshRefraction();
}

function closeMsgMenu() {
  if (!mm.el) return;
  const { el, scrim, clone } = mm;
  el.classList.add('is-closing');
  scrim.classList.add('is-closing');
  clone.classList.add('is-closing');
  setTimeout(() => { el.remove(); scrim.remove(); clone.remove(); }, 170);
  mm.el = null;
}

document.addEventListener('click', (e) => {
  if (!mm.el) return;
  const pick = e.target.closest('[data-react-pick]');
  if (pick) {
    const id = mm.id;
    closeMsgMenu();
    toggleReaction(id, pick.dataset.reactPick);
    return;
  }
  const act = e.target.closest('[data-mm]');
  if (!act) return;
  const id = mm.id;
  const m = chatMessages().find((x) => x.id === id);
  const me = state.acc.user.id;
  const c = curChat();
  switch (act.dataset.mm) {
    case 'reply': setCompose({ mode: 'reply', id }); break;
    case 'forward': closeMsgMenu(); forwardMessage(m); return;
    case 'remind':
      closeMsgMenu();
      pickTime('Remind me', (at) => addReminder(open.id, id, previewText(m) || 'Message', at));
      return;
    case 'retract': retractVote(open.id, id); break;
    case 'stop-poll': closePoll(open.id, id); break;
    case 'copy':
      navigator.clipboard?.writeText(m.caption || m.text).then(() => toast('Copied'), () => toast('Could not copy'));
      break;
    case 'edit': setCompose({ mode: 'edit', id }); break;
    case 'pin': {
      let pinned = false;
      chats.update(open.id, (x) => {
        pinned = x.pinned !== id;
        if (pinned) x.pinned = id;
        else delete x.pinned;
      });
      toast(pinned ? 'Message pinned' : 'Message unpinned');
      renderMessages();
      break;
    }
    case 'delete': {
      const forAll = m.from === me || (isRoom(c) && isAdmin(c, me));
      const label = isRoom(c) ? 'Delete for everyone' : `Delete for me and ${escapeHtml((db.get(open.otherId)?.name ?? 'them').split(/\s+/)[0])}`;
      mm.el.querySelector('.msg-actions').innerHTML = `
        <p class="ctx-confirm">Delete this message?</p>
        <button class="menu-item danger" type="button" data-mm="del-me">${ICON.user}Delete for me</button>
        ${forAll || !isRoom(c) ? `<button class="menu-item danger" type="button" data-mm="del-all">${ICON.users}${label}</button>` : ''}
        <button class="menu-item" type="button" data-mm="cancel">Cancel</button>`;
      return;
    }
    case 'del-me':
      chats.update(open.id, (x) => {
        const y = x.messages.find((z) => z.id === id);
        if (y) (y.hiddenFor ??= []).push(me);
      });
      deleteAnimated(id);
      break;
    case 'del-all':
      chats.update(open.id, (x) => {
        x.messages = x.messages.filter((z) => z.id !== id);
        if (x.pinned === id) delete x.pinned;
      });
      deleteAnimated(id);
      break;
    default:
  }
  closeMsgMenu();
});

function deleteAnimated(id) {
  const row = messagesBox.querySelector(`.bubble-row[data-id="${id}"]`);
  if (compose?.id === id) setCompose(null);
  if (!row) { renderMessages(); renderChatList(); return; }
  row.classList.add('is-deleting');
  setTimeout(() => { renderMessages(); renderChatList(); }, 260);
}

(() => {
  let timer = null;
  let start = null;
  // свайп: влево — ответить, вправо — переслать
  let swipe = null;
  let swallowClick = 0;
  messagesBox.addEventListener('click', (ev) => {
    if (Date.now() < swallowClick) { ev.stopPropagation(); ev.preventDefault(); swallowClick = 0; }
  }, true);
  const SWIPE = 64;
  messagesBox.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.bubble-row');
    if (!row || open.id === KOSMO || e.button > 0) return;
    start = { x: e.clientX, y: e.clientY, row };
    swipe = null;
    if (e.target.closest('button, video, a, .poll')) return;
    row.classList.add('is-pressing');
    timer = setTimeout(() => {
      row.classList.remove('is-pressing');
      start = null;
      openMsgMenu(row);
    }, 420);
  });
  const cancel = () => { clearTimeout(timer); $$('.bubble-row.is-pressing', messagesBox).forEach((r) => r.classList.remove('is-pressing')); };
  messagesBox.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) cancel();
    if (!swipe && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipe = { row: start.row, bubble: start.row.querySelector('.bubble') };
      swipe.row.classList.add('is-swiping');
      try { messagesBox.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    if (!swipe) return;
    // сопротивление после порога, как резинка
    const lim = Math.sign(dx) * Math.min(Math.abs(dx), SWIPE + Math.sqrt(Math.max(0, Math.abs(dx) - SWIPE)) * 4);
    swipe.dx = dx;
    swipe.bubble.style.transform = `translateX(${lim}px)`;
    swipe.row.style.setProperty('--swipe', Math.min(1, Math.abs(dx) / SWIPE));
    swipe.row.dataset.swipe = dx < 0 ? 'reply' : 'fwd';
    const armed = Math.abs(dx) >= SWIPE;
    if (armed !== swipe.armed) { swipe.armed = armed; if (armed) navigator.vibrate?.(8); swipe.row.classList.toggle('is-armed', armed); }
  });
  const end = () => {
    cancel();
    start = null;
    if (!swipe) return;
    const { row, bubble, dx = 0, armed } = swipe;
    swipe = null;
    // после свайпа клик не должен открыть фото или ссылку
    swallowClick = Date.now() + 400;
    bubble.style.transition = 'transform 320ms cubic-bezier(0.34, 1.3, 0.64, 1)';
    bubble.style.transform = '';
    row.classList.remove('is-swiping', 'is-armed');
    row.style.removeProperty('--swipe');
    setTimeout(() => { bubble.style.transition = ''; }, 340);
    if (!armed) return;
    const m = chatMessages().find((x) => x.id === row.dataset.id);
    if (!m) return;
    if (dx < 0) { if (panel.dataset.composer === 'compose') setCompose({ mode: 'reply', id: m.id }); } else forwardMessage(m);
  };
  messagesBox.addEventListener('pointerup', end);
  messagesBox.addEventListener('pointercancel', end);
  messagesBox.addEventListener('pointerleave', (e) => { if (!swipe) cancel(); });
  messagesBox.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.bubble-row');
    if (!row || open.id === KOSMO) return;
    e.preventDefault();
    cancel();
    openMsgMenu(row);
  });
  // двойной тап — быстрое «сердечко»
  messagesBox.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.bubble-row');
    const c = curChat();
    if (c?.type === 'channel' && c.settings?.reactions === false) return;
    if (row && open.id !== KOSMO && !e.target.closest('button, video')) toggleReaction(row.dataset.id, 'heart');
  });
})();

/* ---------------------------------------------------------------------------
   Поле ввода: «+» слева, эмодзи, голосовое / отправить справа
   --------------------------------------------------------------------------- */
const composer = $('#composer');
const input = $('#composer-input');
const sendBtn = $('#send-btn');
const attachMenu = $('#attach-menu');
const picker = $('#emoji-picker');

// voice ↔ round переключается долгим нажатием, как в Telegram
let recordKind = 'voice';
function setMode(mode) {
  if (mode === 'voice' && recordKind === 'round') mode = 'round';
  sendBtn.dataset.mode = mode;
  sendBtn.setAttribute('aria-label', mode === 'voice' ? 'Record voice message' : mode === 'round' ? 'Record video message' : 'Send');
}
const idleMode = () => (input.value.trim() || tray.length ? 'send' : 'voice');

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function resetComposer() {
  input.value = '';
  autosize();
  clearTray();
  setMode('voice');
  setCompose(null);
}

input.addEventListener('input', () => {
  autosize();
  if (!recorder) setMode(idleMode());
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches && state.acc.user.settings?.sendEnter !== false) {
    e.preventDefault();
    composer.requestSubmit();
  }
  if (e.key === 'Escape' && compose) { e.stopPropagation(); $('#cb-close').click(); }
});

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  if (recorder) { stopRecording(true); return; }
  const text = input.value.trim();
  if (compose?.mode === 'edit') {
    const id = compose.id;
    chats.update(open.id, (c) => {
      const m = c.messages.find((x) => x.id === id);
      if (!m) return;
      const field = ['photo', 'video', 'code'].includes(m.kind) ? 'caption' : 'text';
      if (field === 'text' && !text) return;
      if ((m[field] ?? '') !== text) { m[field] = text; m.edited = true; }
    });
    input.value = '';
    autosize();
    setMode('voice');
    setCompose(null);
    renderMessages();
    renderChatList();
    return;
  }
  sendComposed();
});

// Отправить то, что в поле и в ленте вложений (сразу, отложенно или без звука)
async function sendComposed(opts = {}) {
  const text = input.value.trim();
  if (!text && !tray.length) {
    if (sendBtn.dataset.mode === 'round') openRoundRecorder((msg) => send(msg));
    else startRecording();
    return;
  }
  const items = tray.splice(0);
  input.value = '';
  autosize();
  paintTray();
  setMode('voice');
  input.focus({ preventScroll: true });
  if (!items.length) { send({ text }, opts); return; }
  const visual = items.filter((x) => x.type !== 'code');
  const codes = items.filter((x) => x.type === 'code');
  let caption = text;
  try {
    if (visual.length) {
      const stored = await Promise.all(visual.map(storeTrayItem));
      if (stored.length === 1) send({ ...stored[0], caption }, opts);
      else send({ kind: 'album', items: stored.map(({ kind, ...rest }) => ({ type: kind, ...rest })), caption }, opts);
      caption = '';
    }
  } catch {
    toast('Could not send this file');
  }
  codes.forEach((cd, i) => send({ kind: 'code', text: cd.text, lang: cd.lang, caption: i === codes.length - 1 ? caption : '' }, opts));
}

/* ---------- Эмодзи ---------- */
function closePicker() {
  if (picker.hidden || picker.classList.contains('is-closing')) return;
  picker.classList.add('is-closing');
  picker.addEventListener('animationend', () => { picker.hidden = true; picker.classList.remove('is-closing'); }, { once: true });
}

$('#emoji-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!picker.hidden) { closePicker(); return; }
  closeAttach();
  paintPicker();
  picker.hidden = false;
  refreshRefraction();
});
let pickerTab = 'emoji';
function paintPicker() {
  picker.innerHTML = `
    <div class="picker-tabs" role="tablist">
      <button type="button" role="tab" data-picker-tab="emoji" aria-selected="${pickerTab === 'emoji'}">Emoji</button>
      <button type="button" role="tab" data-picker-tab="stickers" aria-selected="${pickerTab === 'stickers'}">Stickers</button>
    </div>
    <div class="picker-body">${pickerTab === 'emoji'
    ? `<div class="emoji-grid">${EMOJI_IDS.map((id, i) => `
        <button class="emoji-opt" type="button" style="--i:${i}" data-send-emoji="${id}" aria-label="${EMOJI[id].label}">${emojiSvg(id)}</button>`).join('')}</div>`
    : stickerPickerHtml()}</div>`;
}
picker.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-picker-tab]');
  // перерисовка отрывает цель клика от DOM — не даём «клику снаружи» закрыть выбор
  if (tab) { e.stopPropagation(); pickerTab = tab.dataset.pickerTab; paintPicker(); return; }
  const st = e.target.closest('[data-send-sticker]');
  if (st) { closePicker(); send({ kind: 'sticker', sticker: stickerByRef(st.dataset.sendSticker) }); return; }
  const b = e.target.closest('[data-send-emoji]');
  if (!b) return;
  // эмодзи вставляется в текст как знак, если уже что-то пишут; иначе отправляется большой
  closePicker();
  send({ kind: 'emoji', emoji: b.dataset.sendEmoji });
});

/* ---------- Вложения (с подписью) ---------- */
function closeAttach() {
  if (attachMenu.hidden || attachMenu.classList.contains('is-closing')) return;
  attachMenu.classList.add('is-closing');
  $('#attach-btn').classList.remove('is-open');
  attachMenu.addEventListener('animationend', () => { attachMenu.hidden = true; attachMenu.classList.remove('is-closing'); }, { once: true });
}

$('#attach-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!attachMenu.hidden) { closeAttach(); return; }
  closePicker();
  attachMenu.hidden = false;
  $('#attach-btn').classList.add('is-open');
  refreshRefraction();
});
document.addEventListener('click', (e) => {
  if (!attachMenu.hidden && !e.target.closest('#attach-menu, #attach-btn')) closeAttach();
  if (!picker.hidden && !e.target.closest('#emoji-picker, #emoji-btn')) closePicker();
});

const MAX_FILE = 50 * 1024 * 1024;

attachMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-attach]');
  if (!item) return;
  closeAttach();
  const kind = item.dataset.attach;
  if (kind === 'code') {
    openSheet('code', {
      title: 'Attach code',
      onSend: (text, lang, caption) => {
        addToTray([{ type: 'code', text, lang }]);
        if (caption && !input.value.trim()) { input.value = caption; autosize(); }
        setMode(idleMode());
      },
    });
    return;
  }
  if (kind === 'round') { openRoundRecorder((msg) => send(msg)); return; }
  if (kind === 'poll') { openPollCreator((msg) => send(msg)); return; }
  $(`#pick-${kind}`).click();
});

// Фото и видео: сначала лист с превью и подписью, потом отправка
export async function storeMedia(file) {
  if (file.type.startsWith('video/')) {
    if (file.size > MAX_FILE) throw new Error('too large');
    return { kind: 'video', media: await putBlob(file), duration: await mediaDuration(file, 'video') };
  }
  const { blob, w, h } = await compressImage(file);
  return { kind: 'photo', media: await putBlob(blob), w, h };
}

/* ---------- Лента вложений над полем ввода ---------- */
const tray = [];   // { id, type: 'photo'|'video'|'code', file?, url?, text?, lang? }
const trayEl = $('#attach-tray');
const MAX_TRAY = 10;

function addToTray(items) {
  const room = MAX_TRAY - tray.length;
  if (items.length > room) toast(`Up to ${MAX_TRAY} attachments at once`);
  items.slice(0, room).forEach((it) => tray.push({ id: uid(), ...it }));
  paintTray();
  setMode(idleMode());
  input.focus({ preventScroll: true });
}

function clearTray() {
  tray.forEach((t) => t.url && URL.revokeObjectURL(t.url));
  tray.length = 0;
  paintTray();
}

function paintTray() {
  const had = !trayEl.hidden;
  trayEl.hidden = !tray.length;
  panel.classList.toggle('has-tray', tray.length > 0);
  if (!tray.length) return;
  trayEl.innerHTML = `${tray.map((t) => `
    <div class="tray-item${t.type === 'code' ? ' is-code' : ''}" data-tray="${t.id}">
      ${t.type === 'photo' ? `<img src="${t.url}" alt="">` : t.type === 'video' ? `<video src="${t.url}" muted playsinline preload="metadata"></video><span class="tray-badge">${ICON.video}</span>`
        : `<span class="tray-code">${ICON.code}<b>${escapeHtml(t.lang)}</b><small>${escapeHtml(t.text.split('\n')[0].slice(0, 24))}</small></span>`}
      <button class="tray-remove" type="button" data-tray-remove="${t.id}" aria-label="Remove">${svg('<path d="M7 7l10 10M17 7L7 17"/>')}</button>
    </div>`).join('')}
    ${tray.length < MAX_TRAY ? `<button class="tray-add" type="button" data-tray-add aria-label="Add more">${svg('<path d="M12 5v14M5 12h14"/>')}</button>` : ''}
    <span class="tray-count">${tray.length === 1 ? (input.value.trim() ? 'with caption' : 'Add a caption…') : `${tray.length} attachments`}</span>`;
  if (!had) toBottom(true);
}

trayEl.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-tray-remove]');
  if (rm) {
    const i = tray.findIndex((t) => t.id === rm.dataset.trayRemove);
    const [gone] = tray.splice(i, 1);
    if (gone?.url) URL.revokeObjectURL(gone.url);
    const el = rm.closest('.tray-item');
    el.classList.add('is-removing');
    setTimeout(() => { paintTray(); setMode(idleMode()); }, 180);
    return;
  }
  if (e.target.closest('[data-tray-add]')) {
    e.stopPropagation();
    attachMenu.hidden = false;
    $('#attach-btn').classList.add('is-open');
  }
});

async function storeTrayItem(t) {
  return storeMedia(t.file);
}

function pickVisual(e) {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  if (files.some((f) => f.size > MAX_FILE)) toast('Files over 50 MB were skipped');
  addToTray(files.filter((f) => f.size <= MAX_FILE).map((f) => ({
    type: f.type.startsWith('video/') ? 'video' : 'photo', file: f, url: URL.createObjectURL(f),
  })));
}
$('#pick-photo').addEventListener('change', pickVisual);
$('#pick-video').addEventListener('change', pickVisual);

$('#pick-audio').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > MAX_FILE) { toast('File is too large (max 50 MB)'); return; }
  try {
    const duration = await mediaDuration(f, 'audio');
    send({ kind: 'audio', media: await putBlob(f), name: f.name.replace(/\.[^.]+$/, ''), duration });
  } catch {
    toast('Could not send this file');
  }
});

/* ---------- Голосовые ---------- */
let recorder = null;
let recChunks = [];
let recStart = 0;
let recTimer = null;
let recStream = null;
let recSend = false;

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Voice messages are not supported in this browser');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('Allow microphone access to record');
    return;
  }
  recChunks = [];
  recorder = new MediaRecorder(recStream);
  recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = async () => {
    recStream.getTracks().forEach((t) => t.stop());
    const elapsed = (Date.now() - recStart) / 1000;
    const blob = new Blob(recChunks, { type: recorder?.mimeType || 'audio/webm' });
    const shouldSend = recSend;
    recorder = null;
    composer.classList.remove('is-recording');
    clearInterval(recTimer);
    setMode(input.value.trim() ? 'send' : 'voice');
    if (!shouldSend || elapsed < 0.5) return;
    // настоящая волна и точная длина — из самой записи
    const info = await analyzeAudio(blob);
    send({ kind: 'voice', media: await putBlob(blob), duration: info?.duration || elapsed, wave: info?.wave });
  };
  recorder.start();
  recStart = Date.now();
  composer.classList.add('is-recording');
  setMode('send');
  $('#rec-time').textContent = '0:00';
  recTimer = setInterval(() => { $('#rec-time').textContent = fmtDur((Date.now() - recStart) / 1000); }, 250);
}

function stopRecording(sendIt) {
  if (!recorder) return;
  recSend = sendIt;
  recorder.stop();
}
$('#rec-cancel').addEventListener('click', () => stopRecording(false));

/* ---------- Плеер для голосовых и музыки ---------- */
const player = new Audio();
let playing = null;
// у записей webm браузер часто не знает длительность — берём сохранённую
const playerDuration = () => (Number.isFinite(player.duration) && player.duration > 0 ? player.duration : Number(playing?.dataset.dur) || 0);

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.b-play');
  if (!btn) return;
  const box = btn.closest('.b-player');
  if (playing === box && !player.paused) { player.pause(); return; }
  const url = await mediaUrl(box.dataset.player);
  if (!url) { toast('File not found'); return; }
  if (playing !== box) {
    playing?.classList.remove('is-playing');
    playing = box;
    player.src = url;
  }
  player.play();
});
player.addEventListener('play', () => { playing?.classList.add('is-playing'); if (playing) $('.b-play', playing).innerHTML = ICON.pause; });
player.addEventListener('pause', () => { if (playing) $('.b-play', playing).innerHTML = ICON.play; });
player.addEventListener('ended', () => {
  if (!playing) return;
  playing.classList.remove('is-playing');
  playing.style.setProperty('--p', 0);
  $('.b-dur', playing).textContent = fmtDur(Number(playing.dataset.dur) || 0);
});
player.addEventListener('timeupdate', () => {
  const d = playerDuration();
  if (!playing || !d) return;
  playing.style.setProperty('--p', Math.min(1, player.currentTime / d));
  $('.b-dur', playing).textContent = fmtDur(player.currentTime);
});

// для home.js: закрыто ли что-то поверх чата
export const chatOverlayOpen = () => Boolean(mm.el || ctx.el || overlayOpen());

/* ---------------------------------------------------------------------------
   Долгое нажатие на кнопку справа: голосовое ↔ кружок; при тексте —
   «Отправить позже» и «Без звука»
   --------------------------------------------------------------------------- */
let quick = null;
function closeQuick() {
  if (!quick) return;
  const el = quick;
  quick = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 160);
}

function openSendMenu() {
  closeQuick();
  const r = sendBtn.getBoundingClientRect();
  quick = document.createElement('div');
  quick.className = 'menu send-menu glass glass-text';
  quick.innerHTML = `
    <button class="menu-item" type="button" data-sm="schedule">${ICON.clock}Schedule message</button>
    <button class="menu-item" type="button" data-sm="silent">${ICON.silent}Send without sound</button>`;
  document.body.append(quick);
  quick.style.right = `${Math.max(10, innerWidth - r.right)}px`;
  quick.style.bottom = `${innerHeight - r.top + 10}px`;
  refreshRefraction();
}

(() => {
  let timer = null;
  let fired = false;
  sendBtn.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || recorder) return;
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      navigator.vibrate?.(12);
      if (sendBtn.dataset.mode === 'send') { openSendMenu(); return; }
      recordKind = recordKind === 'voice' ? 'round' : 'voice';
      setMode('voice');
      toast(recordKind === 'round' ? 'Tap to record a video message' : 'Tap to record a voice message');
    }, 450);
  });
  const cancel = () => clearTimeout(timer);
  sendBtn.addEventListener('pointerup', cancel);
  sendBtn.addEventListener('pointerleave', cancel);
  sendBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (sendBtn.dataset.mode === 'send' && !recorder) { fired = true; openSendMenu(); }
  });
  // клик после долгого нажатия не отправляет
  sendBtn.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
})();

document.addEventListener('click', (e) => {
  if (quick && !e.target.closest('.send-menu')) closeQuick();
  const sm = e.target.closest('[data-sm]');
  if (!sm) return;
  closeQuick();
  if (sm.dataset.sm === 'silent') sendComposed({ silent: true });
  else pickTime('Schedule message', (at) => sendComposed({ at }));
});

/* ---------- Отложенные: полоска над сообщениями ---------- */
function paintScheduled() {
  const n = open.id && open.id !== KOSMO ? myScheduled(curChat()).length : 0;
  $('#sched-bar').hidden = !n;
  if (n) $('#sched-text').textContent = n === 1 ? '1 scheduled message' : `${n} scheduled messages`;
}
$('#sched-bar').addEventListener('click', () => openScheduledList(open.id, previewText));

/* ---------------------------------------------------------------------------
   Меню чата «⋯»: поиск, звонки, секретный чат, автоудаление
   --------------------------------------------------------------------------- */
let more = null;
function closeMore() {
  if (!more) return;
  const el = more;
  more = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 160);
}

$('#chat-more').addEventListener('click', (e) => {
  e.stopPropagation();
  if (more) { closeMore(); return; }
  const c = curChat();
  const me = state.acc.user.id;
  const dm = !isRoom(c);
  const canTimer = !isRoom(c) || isAdmin(c, me);
  const ttl = c?.ttl ?? 0;
  more = document.createElement('div');
  more.className = 'menu chat-menu glass glass-text';
  more.innerHTML = `
    <button class="menu-item" type="button" data-cm="search">${ICON.search}Search</button>
    ${dm && open.otherId ? `
      <button class="menu-item" type="button" data-cm="call">${ICON.call}Voice call</button>
      <button class="menu-item" type="button" data-cm="video">${ICON.video}Video call</button>
      ${isSecret(c) ? '' : `<button class="menu-item" type="button" data-cm="secret">${ICON.lock}Start secret chat</button>`}` : ''}
    ${isRoom(c) ? `<button class="menu-item" type="button" data-cm="info">${ICON.users}${c.type === 'channel' ? 'Channel info' : 'Group info'}</button>` : ''}
    ${canTimer ? `
      <div class="menu-sub"><span>${ICON.timer}Auto-delete</span>
        <div class="segs segs-wrap">${TTL_OPTIONS.map(([v, l]) => `<button type="button" class="seg-btn" role="radio" data-ttl="${v}" aria-checked="${ttl === v}">${l}</button>`).join('')}</div>
      </div>` : ''}`;
  $('#app').append(more);
  const r = $('#chat-more').getBoundingClientRect();
  more.style.top = `${r.bottom + 8}px`;
  more.style.right = `${Math.max(10, innerWidth - r.right)}px`;
  more.style.transformOrigin = '100% 0';
  refreshRefraction();
});

document.addEventListener('click', (e) => {
  if (!more) return;
  const ttl = e.target.closest('[data-ttl]');
  if (ttl) {
    const v = Number(ttl.dataset.ttl);
    if (!curChat()) chats.save({ id: open.id, members: [state.acc.user.id, open.otherId], messages: [], read: {} });
    chats.update(open.id, (c) => { c.ttl = v; });
    $$('[data-ttl]', more).forEach((b) => b.setAttribute('aria-checked', String(b === ttl)));
    toast(v ? `New messages will disappear after ${ttlLabel(v)}` : 'Auto-delete is off');
    paintHeader();
    return;
  }
  const act = e.target.closest('[data-cm]');
  if (!act && !e.target.closest('.chat-menu')) { closeMore(); return; }
  if (!act) return;
  closeMore();
  switch (act.dataset.cm) {
    case 'search': openChatSearch(); break;
    case 'call': startCall(open.otherId, false); break;
    case 'video': startCall(open.otherId, true); break;
    case 'secret': startSecret(open.otherId); break;
    case 'info': emit('kosmo:open-room', open.id); break;
    default:
  }
});

// Секретный чат: отдельная переписка с замком, без пересылки и копирования
export function startSecret(userId) {
  const me = state.acc.user.id;
  const id = secretIdFor(me, userId);
  if (!chats.get(id)) {
    chats.save({ id, secret: true, members: [me, userId], messages: [], read: { [me]: Date.now() }, ttl: 86400, createdAt: Date.now() });
    toast('Secret chat created');
  }
  openChat(id);
}
document.addEventListener('kosmo:start-secret', (e) => startSecret(e.detail));
document.addEventListener('kosmo:start-call', (e) => startCall(e.detail.user, e.detail.video));

/* ---------------------------------------------------------------------------
   Поиск по сообщениям внутри чата
   --------------------------------------------------------------------------- */
let searchQ = '';
let searchHits = [];
let searchAt = 0;

function openChatSearch() {
  $('#chat-search').hidden = false;
  panel.classList.add('is-searching');
  $('#chat-search-input').value = '';
  setTimeout(() => $('#chat-search-input').focus(), 50);
  refreshRefraction();
}
function closeChatSearch() {
  $('#chat-search').hidden = true;
  panel.classList.remove('is-searching');
  searchQ = '';
  searchHits = [];
  $$('.bubble-row.is-match', messagesBox).forEach((r) => r.classList.remove('is-match'));
}
const msgText = (m) => [m.text, m.caption, m.poll?.question, m.name, m.sticker?.text].filter(Boolean).join(' ').toLowerCase();

function markSearch() {
  $$('.bubble-row', messagesBox).forEach((r) => r.classList.toggle('is-match', searchHits.includes(r.dataset.id)));
}
function runSearch() {
  searchQ = $('#chat-search-input').value.trim().toLowerCase();
  searchHits = searchQ ? chatMessages().filter((m) => msgText(m).includes(searchQ)).map((m) => m.id) : [];
  searchAt = searchHits.length - 1;
  markSearch();
  showHit();
}
function showHit() {
  $('#cs-count').textContent = searchQ ? (searchHits.length ? `${searchAt + 1} of ${searchHits.length}` : 'No results') : '';
  if (searchHits.length) jumpTo(searchHits[searchAt]);
}
$('#chat-search-input').addEventListener('input', runSearch);
$('#chat-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $(e.shiftKey ? '#cs-down' : '#cs-up').click(); }
  if (e.key === 'Escape') { e.stopPropagation(); closeChatSearch(); }
});
$('#cs-up').addEventListener('click', () => { if (searchHits.length) { searchAt = (searchAt - 1 + searchHits.length) % searchHits.length; showHit(); } });
$('#cs-down').addEventListener('click', () => { if (searchHits.length) { searchAt = (searchAt + 1) % searchHits.length; showHit(); } });
$('#cs-close').addEventListener('click', closeChatSearch);
onPanelClose('chat', () => { closeChatSearch(); closeMore(); closeQuick(); clearTray(); });

// Открыть чат и показать сообщение (из глобального поиска)
export function openChatAt(chatId, msgId) {
  openChat(chatId);
  setTimeout(() => jumpTo(msgId), 450);
}

// Глобальный поиск по сообщениям и медиа всех моих чатов
export function searchMessages(q) {
  const me = state.acc.user.id;
  const out = [];
  for (const c of chats.forUser(me)) {
    for (const m of mainMessages(c, me)) if (msgText(m).includes(q)) out.push({ c, m });
  }
  return out.sort((a, b) => b.m.at - a.m.at).slice(0, 50);
}
export function allMedia() {
  const me = state.acc.user.id;
  return chats.forUser(me).flatMap((c) => mediaOf(mainMessages(c, me), c).map((x) => ({ ...x, chat: c.id, at: c.messages.find((m) => x.id.startsWith(m.id))?.at ?? 0 })))
    .sort((a, b) => b.at - a.at);
}
export function chatTitle(c) {
  const me = state.acc.user.id;
  if (isRoom(c)) return c.name;
  return db.get(c.members.find((x) => x !== me) ?? me)?.name ?? 'Deleted account';
}
export function chatAvatar(c, cls = '') {
  const me = state.acc.user.id;
  if (isRoom(c)) return roomAvatar(c, cls);
  return userAvatarHtml(publicUser(db.get(c.members.find((x) => x !== me) ?? me)) ?? { name: '?' }, cls);
}
