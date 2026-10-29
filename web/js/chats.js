// Чаты: список (закрепить / архив / удалить по долгому нажатию), чат Kosmo
// с уведомлениями о входах, личные чаты с людьми, поле ввода с вложениями
// (фото, видео, код, музыка) и голосовыми.
// Демо: переписка хранится в localStorage этого браузера, файлы — в IndexedDB.

import {
  $, $$, db, store, uid, toast, escapeHtml, userAvatarHtml, kosmoAvatar, cosmicBadge,
  formatDate, formatTime, refreshRefraction,
} from './core.js';
import { formatPhone, openSheet } from './phone.js';
import { state, openPanel, panelOpen, onPanelClose } from './panels.js';
import { putBlob, mediaUrl, hydrateMedia, compressImage, mediaDuration } from './media.js';

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
  markRead(id, userId) {
    const all = this.all();
    if (!all[id]) return;
    all[id].read[userId] = Date.now();
    store.setJSON('chats', all);
  },
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
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  checks: svg('<path d="M2.5 12.5l4 4L15 8M10.5 15.5l1 1L20 8"/>'),
};
export const deviceIcon = (type) => ICON[type] ?? ICON.desktop;
export const KOSMO_NAME = `<span class="name-with-badge">Kosmo ${cosmicBadge('official')}</span>`;

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
    default: return m.text;
  }
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
    const msgs = c.messages.filter((m) => m.at > (p.clearedAt ?? 0));
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
  const tick = it.mine ? (it.mineRead ? ICON.checks : ICON.check) : '';
  return `
    <li class="chat ripple-host" style="--i:${i}" data-chat="${it.id}" tabindex="0" role="button">
      ${avatar}
      <div class="chat-top"><span class="chat-name">${name}</span></div>
      <div class="chat-meta"><span class="chat-time">${tick}${shortTime(it.lastAt)}</span>${status}</div>
      <div class="chat-bottom"><span class="chat-text">${it.preview}</span></div>
    </li>`;
}

let archiveOpen = false;
let listSig = '';

export function renderChatList() {
  const items = listItems();
  const main = items.filter((it) => !it.archived);
  const archived = items.filter((it) => it.archived);
  const sig = JSON.stringify([items, archiveOpen, state.acc.user.avatar, document.documentElement.dataset.theme]);
  const total = items.reduce((n, it) => n + (it.unread || 0), 0);
  const badge = $('#chats-badge');
  badge.hidden = !total;
  badge.textContent = total;
  if (sig === listSig) return;
  listSig = sig;

  const archiveRow = archived.length ? `
    <li class="chat archive-row ripple-host" data-archive-toggle tabindex="0" role="button" aria-expanded="${archiveOpen}">
      <span class="avatar archive-avatar">${ICON.archive}</span>
      <div class="chat-top"><span class="chat-name">Archived chats</span></div>
      <div class="chat-meta">${archived.some((a) => a.unread) ? `<span class="badge is-muted">${archived.reduce((n, a) => n + a.unread, 0)}</span>` : ''}</div>
      <div class="chat-bottom"><span class="chat-text">${archived.map((a) => (a.kosmo ? 'Kosmo' : escapeHtml(a.other.name))).join(', ')}</span></div>
    </li>
    ${archiveOpen ? `<li class="archive-list"><ul class="chat-list">${archived.map(chatRow).join('')}</ul></li>` : ''}` : '';

  $('#chat-list').innerHTML = archiveRow + main.map(chatRow).join('')
    + (items.length ? '' : `<li class="list-empty">${ICON.archive}<span>No chats yet. Find people in Search.</span></li>`);
  hydrateMedia($('#chat-list'));
}

/* ---------------------------------------------------------------------------
   Долгое нажатие / правый клик: закрепить, архив, удалить
   --------------------------------------------------------------------------- */
const ctx = { el: null, row: null, id: null, suppressClick: false };

function openCtx(row, x, y) {
  closeCtx();
  const id = row.dataset.chat;
  const item = listItems().find((it) => it.id === id);
  if (!item) return;
  navigator.vibrate?.(12);
  ctx.row = row;
  ctx.id = id;
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
  // меню под строкой, а если не влезает — над ней
  const r = row.getBoundingClientRect();
  const mh = 160;
  const top = r.bottom + 8 + mh < innerHeight ? r.bottom + 8 : r.top - mh - 8;
  menu.style.top = `${Math.max(12, top)}px`;
  menu.style.left = `${Math.min(Math.max(16, (x ?? r.left + 24) - 40), innerWidth - 246)}px`;
  menu.style.transformOrigin = top > r.top ? '40px 0' : '40px 100%';
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
  if (!btn) return;
  const id = ctx.id;
  const item = listItems().find((it) => it.id === id);
  if (!item) { closeCtx(); return; }
  const action = btn.dataset.ctx;
  if (action === 'pin') {
    setPref(id, { pinned: item.pinned ? 0 : Date.now() });
    toast(item.pinned ? 'Unpinned' : 'Pinned');
  } else if (action === 'archive') {
    setPref(id, { archived: !item.archived, pinned: 0 });
    toast(item.archived ? 'Moved back to chats' : 'Moved to archive');
  } else if (action === 'delete') {
    // подтверждение прямо в меню
    ctx.el.innerHTML = `
      <p class="ctx-confirm">Delete this chat? It will disappear from your list. New messages will bring it back.</p>
      <button class="menu-item danger" type="button" data-ctx="delete-yes">${ICON.trash}Delete chat</button>
      <button class="menu-item" type="button" data-ctx="cancel">Cancel</button>`;
    return;
  } else if (action === 'delete-yes') {
    setPref(id, { clearedAt: Date.now(), pinned: 0, archived: false });
    toast('Chat deleted');
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
      openCtx(row, start.x, start.y);
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
    openCtx(row, e.clientX, e.clientY);
  });
  list.addEventListener('click', (e) => {
    if (ctx.suppressClick) { ctx.suppressClick = false; e.stopPropagation(); return; }
    if (e.target.closest('[data-archive-toggle]')) {
      archiveOpen = !archiveOpen;
      renderChatList();
      return;
    }
    const row = e.target.closest('.chat[data-chat]');
    if (row) openChat(row.dataset.chat);
  }, true);
  list.addEventListener('keydown', (e) => {
    const row = e.target.closest('.chat[data-chat]');
    if (row && e.key === 'Enter') openChat(row.dataset.chat);
    if (row && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); openCtx(row); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });
})();

/* ---------------------------------------------------------------------------
   Окно чата
   --------------------------------------------------------------------------- */
const open = { id: null, otherId: null };
let known = new Set();
const panel = $('#panel-chat');
const messagesBox = $('#messages');

export const openChatId = () => (panelOpen() === 'chat' ? open.id : null);

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
  const cleared = prefs(open.id).clearedAt ?? 0;
  return (chats.get(open.id)?.messages ?? []).filter((m) => m.at > cleared);
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

function showChat() {
  const isKosmo = open.id === KOSMO;
  const other = isKosmo ? null : db.get(open.otherId);
  $('#chat-title').innerHTML = isKosmo ? KOSMO_NAME : displayName(other ?? { name: 'Deleted account' });
  $('#chat-sub').textContent = isKosmo ? 'official account' : other ? `@${other.username}` : '';
  $('#chat-head-avatar').innerHTML = isKosmo ? kosmoAvatar('avatar-head') : userAvatarHtml(other ?? { name: '?' }, 'avatar-head');
  panel.classList.toggle('is-kosmo', isKosmo);
  const msgs = chatMessages();
  // непрочитанные появятся с анимацией
  const unread = isKosmo ? kosmoUnread() : msgs.filter((m) => m.from !== state.acc.user.id && m.at > (chats.get(open.id)?.read[state.acc.user.id] ?? 0)).length;
  known = new Set(msgs.slice(0, msgs.length - unread).map((m) => m.id));
  markOpenRead();
  resetComposer();
  renderMessages({ scroll: true });
  renderChatList();
  openPanel('chat');
  hydrateMedia(panel);
  if (!isKosmo) setTimeout(() => input.focus({ preventScroll: true }), 380);
}

onPanelClose('chat', () => {
  stopRecording(false);
  closeAttach();
  player.pause();
});

function bubble(m, isNew) {
  const mine = m.from === state.acc.user.id;
  const chat = chats.get(open.id);
  const read = mine && (chat?.read[open.otherId] ?? 0) >= m.at;
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
    default:
      body = `<p class="b-text">${escapeHtml(m.text).replace(/\n/g, '<br>')}</p>`;
  }
  return `
    <div class="bubble-row ${mine ? 'mine' : 'theirs'}${isNew ? ' is-new' : ''}" data-id="${m.id}">
      <div class="bubble kind-${m.kind ?? 'text'}">
        ${body}
        <span class="b-meta">${formatTime(m.at)}${mine ? (read ? ICON.checks : ICON.check) : ''}</span>
      </div>
    </div>`;
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
      <button class="btn btn-secondary glass" type="button" data-say-hello>Say hello</button>
    </div>`;
}

export function renderMessages({ scroll = false } = {}) {
  if (!open.id) return;
  const msgs = chatMessages();
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
    return sep + (open.id === KOSMO ? kosmoCard(m, isNew) : bubble(m, isNew));
  }).join('');
  msgs.forEach((m) => known.add(m.id));
  hydrateMedia(messagesBox);
  if (scroll) requestAnimationFrame(() => { panel.scrollTop = panel.scrollHeight; });
}

// Новое сообщение пришло, пока чат открыт
export function refreshOpenChat() {
  if (!openChatId()) return;
  const before = known.size;
  markOpenRead();
  renderMessages({ scroll: chatMessages().length > before });
}

/* ---------------------------------------------------------------------------
   Отправка
   --------------------------------------------------------------------------- */
function send(msg) {
  const me = state.acc.user.id;
  chats.send(open.id, [me, open.otherId], { from: me, kind: 'text', ...msg });
  // удалённый или архивный чат возвращается в список
  const p = prefs(open.id);
  if (p.archived) setPref(open.id, { archived: false });
  state.reload();
  renderMessages({ scroll: true });
  renderChatList();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-say-hello]')) send({ text: 'Hello! 👋' });
  const copyBtn = e.target.closest('[data-copy-code]');
  if (copyBtn) {
    navigator.clipboard?.writeText(copyBtn.closest('.b-code').querySelector('code').textContent)
      .then(() => toast('Code copied'), () => toast('Could not copy'));
  }
  const photo = e.target.closest('[data-view-photo]');
  if (photo) openViewer(photo.querySelector('img').src);
});

/* ---------------------------------------------------------------------------
   Поле ввода: «+» слева, голосовое / отправить справа
   --------------------------------------------------------------------------- */
const composer = $('#composer');
const input = $('#composer-input');
const sendBtn = $('#send-btn');
const attachMenu = $('#attach-menu');

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
});

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  if (recorder) { stopRecording(true); return; }
  const text = input.value.trim();
  if (!text) { startRecording(); return; }
  send({ text });
  resetComposer();
  input.focus({ preventScroll: true });
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
  attachMenu.hidden = false;
  $('#attach-btn').classList.add('is-open');
  refreshRefraction();
});
document.addEventListener('click', (e) => {
  if (!attachMenu.hidden && !e.target.closest('#attach-menu, #attach-btn')) closeAttach();
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
