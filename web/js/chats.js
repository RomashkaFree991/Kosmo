// Чаты: список (закрепить / архив / удалить по долгому нажатию), архив отдельным
// экраном, чат Kosmo с уведомлениями о входах, личные чаты: вложения, голосовые,
// свои анимированные эмодзи, а по долгому нажатию на сообщение — реакции,
// ответ, копирование, изменение, закрепление и удаление (у себя или у всех).
// Демо: переписка хранится в localStorage этого браузера, файлы — в IndexedDB.

import {
  $, $$, db, store, uid, toast, escapeHtml, userAvatarHtml, kosmoAvatar, cosmicBadge,
  formatDate, formatTime, refreshRefraction,
} from './core.js';
import { formatPhone, openSheet } from './phone.js';
import { state, openPanel, panelOpen, onPanelClose, overlayOpen } from './panels.js';
import { putBlob, mediaUrl, hydrateMedia, compressImage, mediaDuration } from './media.js';
import { EMOJI, EMOJI_IDS, REACTIONS, emojiSvg } from './emoji.js';
import { showUser } from './people.js';

export const KOSMO = 'kosmo';

/* ---------------------------------------------------------------------------
   Данные
   --------------------------------------------------------------------------- */
export const chats = {
  all() { return store.getJSON('chats', {}); },
  get(id) { return this.all()[id] ?? null; },
  idFor: (a, b) => [a, b].sort().join('_'),
  forUser(userId) { return Object.values(this.all()).filter((c) => c.members.includes(userId)); },
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
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function displayName(u) {
  return `<span class="name-with-badge">${escapeHtml(u.name)}${u.role === 'owner' ? cosmicBadge('owner') : ''}</span>`;
}

/* ---------------------------------------------------------------------------
   Сообщения Kosmo: приветствие, новые входы, смена номера
   --------------------------------------------------------------------------- */
function kosmoCopy(m) {
  const first = escapeHtml(state.acc.user.name.split(/\s+/)[0]);
  if (m.kind === 'welcome') return { title: `Welcome to Kosmo, ${first}!`, text: 'Your account has been created. This device was added as a trusted device.' };
  if (m.kind === 'login') return { title: 'New login to your account', text: 'A device signed in to your account. If it wasn\'t you, terminate this session.' };
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
  return state.acc.user.messages.filter((m) => m.at > cleared);
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
  switch (m.kind) {
    case 'photo': return 'Photo';
    case 'video': return 'Video';
    case 'voice': return `Voice message · ${fmtDur(m.duration ?? 0)}`;
    case 'audio': return m.name ?? 'Music';
    case 'code': return `Code · ${m.lang}`;
    case 'emoji': return `${EMOJI[m.emoji]?.label ?? 'Emoji'} emoji`;
    default: return m.text;
  }
}

// Сообщения чата, которые видит этот пользователь
function visible(c, me) {
  const cleared = prefs(c.id).clearedAt ?? 0;
  return c.messages.filter((m) => m.at > cleared && !m.hiddenFor?.includes(me));
}

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
    const msgs = visible(c, me);
    if (!msgs.length) continue;
    const otherId = c.members.find((x) => x !== me) ?? me;
    const other = db.get(otherId) ?? { id: otherId, name: 'Deleted account', username: '', avatar: {} };
    const last = msgs[msgs.length - 1];
    items.push({
      id: c.id, other, lastAt: last.at, pinned: p.pinned ?? 0, archived: p.archived,
      unread: msgs.filter((m) => m.from !== me && m.at > (c.read[me] ?? 0)).length,
      preview: `${last.from === me ? '<b>You:</b> ' : ''}${escapeHtml(previewText(last))}`,
      mineRead: last.from === me && (c.read[otherId] ?? 0) >= last.at,
      mine: last.from === me,
    });
  }
  return items.sort((a, b) => (b.pinned || 0) - (a.pinned || 0) || b.lastAt - a.lastAt);
}

function chatRow(it, i) {
  const avatar = it.kosmo ? kosmoAvatar() : userAvatarHtml(it.other);
  const name = it.kosmo ? KOSMO_NAME : displayName(it.other);
  const status = it.unread ? `<span class="badge">${it.unread}</span>` : it.pinned ? svg('<path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/>', 'i pin') : '';
  return `
    <li class="chat ripple-host" style="--i:${i}" data-chat="${it.id}" tabindex="0" role="button">
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

export function renderChatList() {
  const items = listItems();
  const main = items.filter((it) => !it.archived);
  const archived = items.filter((it) => it.archived);
  const total = items.reduce((n, it) => n + (it.unread || 0), 0);
  const badge = $('#chats-badge');
  badge.hidden = !total;
  badge.textContent = total;
  if (archiveMode && !archived.length) { setArchiveMode(false); return; }
  const sig = JSON.stringify([items, archiveMode, state.acc.user.avatar]);
  if (sig === listSig) return;
  listSig = sig;

  let html;
  if (archiveMode) {
    html = archived.map(chatRow).join('');
  } else {
    const archiveRow = archived.length ? `
      <li class="chat archive-row ripple-host" data-archive-open tabindex="0" role="button">
        <span class="avatar archive-avatar">${ICON.archive}</span>
        <div class="chat-top"><span class="chat-name">Archived chats</span></div>
        <div class="chat-meta">${archived.some((a) => a.unread) ? `<span class="badge is-muted">${archived.reduce((n, a) => n + a.unread, 0)}</span>` : ''}</div>
        <div class="chat-bottom"><span class="chat-text">${archived.map((a) => (a.kosmo ? 'Kosmo' : escapeHtml(a.other.name))).join(', ')}</span></div>
      </li>` : '';
    html = archiveRow + main.map(chatRow).join('')
      + (main.length ? '' : `<li class="list-empty">${ICON.users}<span>No chats yet. Find people in Search.</span></li>`);
  }
  $('#chat-list').innerHTML = html;
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
  menu.innerHTML = `
    <button class="menu-item" type="button" role="menuitem" data-ctx="pin">${item.pinned ? ICON.unpin : ICON.pin}${item.pinned ? 'Unpin' : 'Pin'}</button>
    <button class="menu-item" type="button" role="menuitem" data-ctx="archive">${item.archived ? ICON.unarchive : ICON.archive}${item.archived ? 'Unarchive' : 'Archive'}</button>
    <button class="menu-item danger" type="button" role="menuitem" data-ctx="delete">${ICON.trash}Delete</button>`;
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
    // подтверждение прямо в меню: у себя или у обоих
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
    if (e.key !== 'Escape' || !(ctx.el || mm.el)) return;
    e.stopImmediatePropagation();
    closeCtx();
    closeMsgMenu();
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
const messagesBox = $('#messages');

export const openChatId = () => (panelOpen() === 'chat' ? open.id : null);
const isDm = () => open.id && open.id !== KOSMO;

export function openChat(id) {
  if (id === KOSMO) {
    open.id = KOSMO;
    open.otherId = null;
  } else {
    const c = chats.get(id);
    open.id = id;
    open.otherId = c?.members.find((x) => x !== state.acc.user.id) ?? null;
  }
  showChat();
}

// Личный чат с человеком (даже если сообщений ещё нет)
export function openDm(userId) {
  open.id = chats.idFor(state.acc.user.id, userId);
  open.otherId = userId;
  showChat();
}

function chatMessages() {
  if (open.id === KOSMO) return kosmoMessages();
  const c = chats.get(open.id);
  return c ? visible(c, state.acc.user.id) : [];
}

function markOpenRead() {
  if (open.id === KOSMO) {
    db.update(state.acc.user.id, (u) => {
      const s = u.sessions.find((x) => x.id === state.acc.session.id);
      if (s) s.readAt = Date.now();
    });
  } else {
    chats.markRead(open.id, state.acc.user.id);
  }
  state.reload();
}

function paintHeader() {
  const isKosmo = open.id === KOSMO;
  const other = isKosmo ? null : db.get(open.otherId);
  $('#chat-title').innerHTML = isKosmo ? KOSMO_NAME : displayName(other ?? { name: 'Deleted account' });
  $('#chat-sub').textContent = isKosmo ? 'official account' : other ? (other.username ? `@${other.username}` : `ID ${other.publicId}`) : '';
  $('#chat-head-avatar').innerHTML = isKosmo ? kosmoAvatar('avatar-head') : userAvatarHtml(other ?? { name: '?' }, 'avatar-head');
  hydrateMedia($('#chat-head-avatar'));
}

function showChat() {
  const isKosmo = open.id === KOSMO;
  paintHeader();
  panel.classList.toggle('is-kosmo', isKosmo);
  const msgs = chatMessages();
  // непрочитанные появятся с анимацией
  const unread = isKosmo ? kosmoUnread() : msgs.filter((m) => m.from !== state.acc.user.id && m.at > (chats.get(open.id)?.read[state.acc.user.id] ?? 0)).length;
  known = new Set(msgs.slice(0, msgs.length - unread).map((m) => m.id));
  tickMemo.clear();
  reactMemo.clear();
  markOpenRead();
  resetComposer();
  renderMessages({ scroll: true });
  renderChatList();
  openPanel('chat');
  if (!isKosmo) setTimeout(() => input.focus({ preventScroll: true }), 380);
}

onPanelClose('chat', () => {
  stopRecording(false);
  closeAttach();
  closePicker();
  closeMsgMenu();
  player.pause();
});

// Тап по имени или аватару в шапке — профиль собеседника
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-user]') && isDm() && open.otherId) showUser(open.otherId);
});

function quoteHtml(m, all) {
  const target = all.find((x) => x.id === m.replyTo);
  if (!target) return '<div class="b-reply is-gone"><b>Deleted message</b></div>';
  const who = target.from === state.acc.user.id ? 'You' : escapeHtml(db.get(target.from)?.name ?? 'Deleted account');
  return `<button class="b-reply" type="button" data-jump="${target.id}"><b>${who}</b><span>${escapeHtml(previewText(target))}</span></button>`;
}

function reactionsHtml(m) {
  const me = state.acc.user.id;
  const entries = Object.entries(m.reactions ?? {}).filter(([, users]) => users.length);
  if (!entries.length) return '';
  const prev = reactMemo.get(m.id) ?? {};
  return `<div class="reactions">${entries.map(([id, users]) => {
    const changed = (prev[id]?.length ?? 0) < users.length;
    return `<button class="reaction${users.includes(me) ? ' is-mine' : ''}${changed ? ' is-new' : ''}" type="button" data-react-toggle="${id}" data-msg="${m.id}" aria-label="${EMOJI[id]?.label} ${users.length}">
      ${emojiSvg(id)}${users.length > 1 ? `<span>${users.length}</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

function bubble(m, isNew, all) {
  const me = state.acc.user.id;
  const mine = m.from === me;
  const chat = chats.get(open.id);
  const read = mine && (chat?.read[open.otherId] ?? 0) >= m.at;
  // анимация галочек: первая рисуется при отправке, вторая — когда прочитали
  const tickState = read ? 'read' : 'sent';
  const was = tickMemo.get(m.id);
  const tickCls = !mine ? '' : !was && isNew ? 'tick-in' : was === 'sent' && read ? 'tick-read' : '';
  tickMemo.set(m.id, tickState);

  let body = '';
  switch (m.kind) {
    case 'photo':
      body = `<button class="b-photo-btn" type="button" data-view-photo="${m.media}" aria-label="Open photo"><img class="b-photo" data-media="${m.media}" alt="Photo" style="aspect-ratio:${m.w || 4}/${m.h || 3}"></button>`;
      break;
    case 'video':
      body = `<video class="b-video" data-media="${m.media}" controls playsinline preload="metadata"></video>`;
      break;
    case 'voice':
    case 'audio': {
      const bars = Array.from({ length: 28 }, (_, i) => {
        // форма волны — из id сообщения, чтобы у каждого голосового своя
        const h = 25 + ((m.id.charCodeAt(i % m.id.length) * (i + 7)) % 75);
        return `<span style="height:${h}%"></span>`;
      }).join('');
      body = `
        <div class="b-player" data-player="${m.media}">
          <button class="b-play" type="button" aria-label="Play">${ICON.play}</button>
          <div class="b-track">
            ${m.kind === 'voice' ? `<div class="b-wave-wrap"><div class="b-wave">${bars}</div><div class="b-wave b-wave-fill">${bars}</div></div>` : `<div class="b-name">${escapeHtml(m.name ?? 'Audio')}</div><div class="b-progress"><span></span></div>`}
            <span class="b-dur">${fmtDur(m.duration ?? 0)}</span>
          </div>
        </div>`;
      break;
    }
    case 'code':
      body = `
        <div class="b-code">
          <div class="b-code-head"><span>${escapeHtml(m.lang)}</span><button type="button" data-copy-code aria-label="Copy code">${ICON.copy}</button></div>
          <pre><code>${escapeHtml(m.text)}</code></pre>
        </div>`;
      break;
    case 'emoji':
      body = emojiSvg(m.emoji, 'emoji-big');
      break;
    default:
      body = `<p class="b-text">${escapeHtml(m.text).replace(/\n/g, '<br>')}</p>`;
  }
  const html = `
    <div class="bubble-row ${mine ? 'mine' : 'theirs'}${isNew ? ' is-new' : ''}" data-id="${m.id}">
      <div class="bubble kind-${m.kind ?? 'text'}">
        ${m.replyTo ? quoteHtml(m, all) : ''}
        ${body}
        ${reactionsHtml(m)}
        <span class="b-meta">${m.edited ? '<em>edited</em>' : ''}${formatTime(m.at)}${mine ? ticks(read, tickCls) : ''}</span>
      </div>
    </div>`;
  reactMemo.set(m.id, structuredClone(m.reactions ?? {}));
  return html;
}

function emptyState() {
  const other = db.get(open.otherId);
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
      <button class="btn btn-secondary glass" type="button" data-say-hello>${emojiSvg('heart', 'emoji-inline')}Say hello</button>
    </div>`;
}

function paintPinned() {
  const bar = $('#pinned-bar');
  const c = isDm() ? chats.get(open.id) : null;
  const msgs = chatMessages();
  const m = c?.pinned && msgs.find((x) => x.id === c.pinned);
  bar.hidden = !m;
  panel.classList.toggle('has-pinned', Boolean(m));
  if (m) $('#pinned-preview').textContent = previewText(m);
}

export function renderMessages({ scroll = false } = {}) {
  if (!open.id) return;
  const msgs = chatMessages();
  paintPinned();
  if (!msgs.length && open.id !== KOSMO) {
    messagesBox.innerHTML = emptyState();
    hydrateMedia(messagesBox);
    return;
  }
  let lastDay = '';
  messagesBox.innerHTML = msgs.map((m) => {
    const day = new Date(m.at).toDateString();
    const sep = day !== lastDay ? `<div class="day-chip">${formatDate(m.at).split(',')[0]}</div>` : '';
    lastDay = day;
    const isNew = !known.has(m.id);
    return sep + (open.id === KOSMO ? kosmoCard(m, isNew) : bubble(m, isNew, msgs));
  }).join('');
  msgs.forEach((m) => known.add(m.id));
  hydrateMedia(messagesBox);
  if (scroll) requestAnimationFrame(() => { panel.scrollTop = panel.scrollHeight; });
}

// Новое сообщение пришло (или что-то изменилось), пока чат открыт
export function refreshOpenChat() {
  if (!openChatId()) return;
  const before = known.size;
  markOpenRead();
  paintHeader();
  renderMessages({ scroll: chatMessages().length > before });
}

function jumpTo(id) {
  const row = messagesBox.querySelector(`.bubble-row[data-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('is-flash');
  void row.offsetWidth;
  row.classList.add('is-flash');
}

$('#pinned-jump').addEventListener('click', () => { const c = chats.get(open.id); if (c?.pinned) jumpTo(c.pinned); });
$('#pinned-close').addEventListener('click', () => {
  chats.update(open.id, (c) => { delete c.pinned; });
  renderMessages();
  toast('Message unpinned');
});

/* ---------------------------------------------------------------------------
   Отправка, ответ, изменение
   --------------------------------------------------------------------------- */
let compose = null;   // { mode: 'reply' | 'edit', id }

function send(msg) {
  const me = state.acc.user.id;
  const extra = compose?.mode === 'reply' ? { replyTo: compose.id } : {};
  chats.send(open.id, [me, open.otherId], { from: me, kind: 'text', ...extra, ...msg });
  // удалённый или архивный чат возвращается в список
  const p = prefs(open.id);
  if (p.archived) setPref(open.id, { archived: false });
  setCompose(null);
  state.reload();
  renderMessages({ scroll: true });
  renderChatList();
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
    input.value = m.text;
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

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-say-hello]')) send({ kind: 'emoji', emoji: 'heart' });
  const copyBtn = e.target.closest('[data-copy-code]');
  if (copyBtn) {
    navigator.clipboard?.writeText(copyBtn.closest('.b-code').querySelector('code').textContent)
      .then(() => toast('Code copied'), () => toast('Could not copy'));
  }
  const photo = e.target.closest('[data-view-photo]');
  if (photo) openViewer(photo.querySelector('img').src);
  const jump = e.target.closest('[data-jump]');
  if (jump) jumpTo(jump.dataset.jump);
  const r = e.target.closest('[data-react-toggle]');
  if (r) toggleReaction(r.dataset.msg, r.dataset.reactToggle);
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
  renderMessages();
  if (added) {
    navigator.vibrate?.(10);
    const chip = messagesBox.querySelector(`.bubble-row[data-id="${msgId}"] [data-react-toggle="${emoji}"]`);
    if (chip) burst(chip);
  }
}

// Вспышка из искр вокруг реакции
function burst(el) {
  const r = el.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'burst';
  box.style.left = `${r.left + 14}px`;
  box.style.top = `${r.top + r.height / 2}px`;
  box.innerHTML = Array.from({ length: 8 }, (_, i) => `<span style="--a:${i * 45}deg"></span>`).join('');
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
  const mine = m.from === state.acc.user.id;
  const c = chats.get(open.id);
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
  wrap.className = `msg-menu ${mine ? 'is-mine' : ''}`;
  const myReaction = Object.entries(m.reactions ?? {}).find(([, u]) => u.includes(state.acc.user.id))?.[0];
  const actions = [
    `<button class="menu-item" type="button" data-mm="reply">${ICON.reply}Reply</button>`,
    ['text', 'code'].includes(m.kind ?? 'text') && `<button class="menu-item" type="button" data-mm="copy">${ICON.copy}Copy</button>`,
    mine && (m.kind ?? 'text') === 'text' && `<button class="menu-item" type="button" data-mm="edit">${ICON.edit}Edit</button>`,
    `<button class="menu-item" type="button" data-mm="pin">${c?.pinned === id ? ICON.unpin : ICON.pin}${c?.pinned === id ? 'Unpin' : 'Pin'}</button>`,
    `<button class="menu-item danger" type="button" data-mm="delete">${ICON.trash}Delete</button>`,
  ].filter(Boolean);
  wrap.innerHTML = `
    <div class="react-bar glass glass-text" role="group" aria-label="Reactions">
      ${REACTIONS.map((e, i) => `<button class="react-opt${e === myReaction ? ' is-mine' : ''}" type="button" style="--i:${i}" data-react-pick="${e}" aria-label="${EMOJI[e].label}">${emojiSvg(e)}</button>`).join('')}
    </div>
    <div class="menu msg-actions glass glass-text" role="menu">${actions.join('')}</div>`;
  $('#app').append(scrim, clone, wrap);
  mm.el = wrap;
  mm.scrim = scrim;
  mm.clone = clone;

  // раскладка: реакции над сообщением, действия под ним; всё влезает в экран
  const barH = 60;
  const actH = actions.length * 46 + 12;
  const total = barH + 8 + rect.height + 8 + actH;
  let top = rect.top - barH - 8;
  top = Math.max(12, Math.min(top, innerHeight - total - 12));
  const cloneTop = top + barH + 8;
  clone.animate([{ transform: 'none' }, { transform: `translateY(${cloneTop - rect.top}px) scale(1.03)` }],
    { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'forwards' });
  const side = mine ? `right:${Math.max(10, innerWidth - rect.right)}px` : `left:${Math.max(10, rect.left)}px`;
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
  switch (act.dataset.mm) {
    case 'reply': setCompose({ mode: 'reply', id }); break;
    case 'copy':
      navigator.clipboard?.writeText(m.text).then(() => toast('Copied'), () => toast('Could not copy'));
      break;
    case 'edit': setCompose({ mode: 'edit', id }); break;
    case 'pin': {
      let pinned = false;
      chats.update(open.id, (c) => {
        pinned = c.pinned !== id;
        if (pinned) c.pinned = id;
        else delete c.pinned;
      });
      toast(pinned ? 'Message pinned' : 'Message unpinned');
      renderMessages();
      break;
    }
    case 'delete': {
      const name = escapeHtml((db.get(open.otherId)?.name ?? 'them').split(/\s+/)[0]);
      mm.el.querySelector('.msg-actions').innerHTML = `
        <p class="ctx-confirm">Delete this message?</p>
        <button class="menu-item danger" type="button" data-mm="del-me">${ICON.user}Delete for me</button>
        <button class="menu-item danger" type="button" data-mm="del-all">${ICON.users}Delete for me and ${name}</button>
        <button class="menu-item" type="button" data-mm="cancel">Cancel</button>`;
      return;
    }
    case 'del-me':
      chats.update(open.id, (c) => {
        const x = c.messages.find((y) => y.id === id);
        if (x) (x.hiddenFor ??= []).push(me);
      });
      deleteAnimated(id);
      break;
    case 'del-all':
      chats.update(open.id, (c) => {
        c.messages = c.messages.filter((y) => y.id !== id);
        if (c.pinned === id) delete c.pinned;
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
  messagesBox.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.bubble-row');
    if (!row || !isDm() || e.button > 0 || e.target.closest('button, video, a')) return;
    start = { x: e.clientX, y: e.clientY };
    row.classList.add('is-pressing');
    timer = setTimeout(() => {
      row.classList.remove('is-pressing');
      openMsgMenu(row);
    }, 420);
  });
  const cancel = () => { clearTimeout(timer); $$('.bubble-row.is-pressing', messagesBox).forEach((r) => r.classList.remove('is-pressing')); };
  messagesBox.addEventListener('pointermove', (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel(); });
  messagesBox.addEventListener('pointerup', cancel);
  messagesBox.addEventListener('pointerleave', cancel);
  messagesBox.addEventListener('pointercancel', cancel);
  messagesBox.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.bubble-row');
    if (!row || !isDm()) return;
    e.preventDefault();
    cancel();
    openMsgMenu(row);
  });
  // двойной тап — быстрое «сердечко»
  messagesBox.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.bubble-row');
    if (row && isDm() && !e.target.closest('button, video')) toggleReaction(row.dataset.id, 'heart');
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

function setMode(mode) {
  sendBtn.dataset.mode = mode;
  sendBtn.setAttribute('aria-label', mode === 'voice' ? 'Record voice message' : 'Send');
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function resetComposer() {
  input.value = '';
  autosize();
  setMode('voice');
  setCompose(null);
}

input.addEventListener('input', () => {
  autosize();
  if (!recorder) setMode(input.value.trim() ? 'send' : 'voice');
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) {
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
    if (!text) return;
    const id = compose.id;
    chats.update(open.id, (c) => {
      const m = c.messages.find((x) => x.id === id);
      if (m && m.text !== text) { m.text = text; m.edited = true; }
    });
    input.value = '';
    autosize();
    setMode('voice');
    setCompose(null);
    renderMessages();
    renderChatList();
    return;
  }
  if (!text) { startRecording(); return; }
  send({ text });
  input.value = '';
  autosize();
  setMode('voice');
  input.focus({ preventScroll: true });
});

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
  picker.innerHTML = EMOJI_IDS.map((id, i) => `
    <button class="emoji-opt" type="button" style="--i:${i}" data-send-emoji="${id}" aria-label="${EMOJI[id].label}">${emojiSvg(id)}</button>`).join('');
  picker.hidden = false;
  refreshRefraction();
});
picker.addEventListener('click', (e) => {
  const b = e.target.closest('[data-send-emoji]');
  if (!b) return;
  closePicker();
  send({ kind: 'emoji', emoji: b.dataset.sendEmoji });
});

/* ---------- Вложения ---------- */
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
    openSheet('code', { onSend: (text, lang) => send({ kind: 'code', text, lang }) });
    return;
  }
  $(`#pick-${kind}`).click();
});

$('#pick-photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const file of files) {
    try {
      const { blob, w, h } = await compressImage(file);
      send({ kind: 'photo', media: await putBlob(blob), w, h });
    } catch {
      toast('Could not read this photo');
    }
  }
});

async function sendFile(file, kind) {
  if (file.size > MAX_FILE) { toast('File is too large (max 50 MB)'); return; }
  try {
    const duration = await mediaDuration(file, kind === 'video' ? 'video' : 'audio');
    send({ kind, media: await putBlob(file), name: file.name.replace(/\.[^.]+$/, ''), duration });
  } catch {
    toast('Could not send this file');
  }
}
$('#pick-video').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) sendFile(f, 'video'); });
$('#pick-audio').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) sendFile(f, 'audio'); });

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
    const duration = (Date.now() - recStart) / 1000;
    const blob = new Blob(recChunks, { type: recorder?.mimeType || 'audio/webm' });
    const shouldSend = recSend;
    recorder = null;
    composer.classList.remove('is-recording');
    clearInterval(recTimer);
    setMode(input.value.trim() ? 'send' : 'voice');
    if (shouldSend && duration >= 0.5) send({ kind: 'voice', media: await putBlob(blob), duration });
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
player.addEventListener('ended', () => { playing?.classList.remove('is-playing'); playing?.style.setProperty('--p', 0); });
player.addEventListener('timeupdate', () => {
  if (!playing || !player.duration) return;
  playing.style.setProperty('--p', player.currentTime / player.duration);
  $('.b-dur', playing).textContent = fmtDur(player.currentTime);
});

/* ---------- Просмотр фото ---------- */
function openViewer(src) {
  if (!src) return;
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${src}" alt="Photo">`;
  v.addEventListener('click', () => {
    v.classList.add('is-closing');
    setTimeout(() => v.remove(), 220);
  });
  document.body.append(v);
}

// для home.js: закрыто ли что-то поверх чата
export const chatOverlayOpen = () => Boolean(mm.el || ctx.el || overlayOpen());
