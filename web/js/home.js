// Каркас приложения: вкладки, лента, поиск людей, меню «+»,
// синхронизация между вкладками (новые сообщения, входы, завершённые сессии).

import {
  $, $$, root, db, tab, current, wait, toast, escapeHtml, userAvatarHtml, kosmoAvatar, cosmicBadge, refreshRefraction,
} from './core.js';
import { state, openPanel, closePanel, panelOpen, onPanelClose, resetPanels } from './panels.js';
import {
  KOSMO, KOSMO_NAME, chats, renderChatList, refreshOpenChat, openChat, openDm, openChatId, previewText,
  chatOverlayOpen, leaveArchive,
} from './chats.js';
import { overlayOpen, closeOverlay } from './panels.js';
import { renderProfile, renderSessions, resetProfileCache } from './profile.js';
import { applyDesign } from './design.js';
import { hydrateMedia } from './media.js';
import { renderFeed, refreshFeed } from './feed.js';
import { openCreate, searchRooms, roomPreview, refreshRoom } from './rooms.js';
import { maybeLock, notify, refreshSettings } from './settings.js';
import { isRoom, roomAvatar, searchMessages, allMedia, chatTitle, chatAvatar, openChatAt } from './chats.js';
import { openViewer } from './viewer.js';
import { renderStories } from './stories.js';
import { rememberAccount, forgetAccount, linkedAccounts, paintAuthCancel } from './accounts.js';
import { api, boot, shutdown } from './api.js';

const app = $('#app');
const tabbar = $('#tabbar');
let onLogout = () => {};

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>'),
  comment: svg('<path d="M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z"/>'),
  share: svg('<path d="M4 12.5L20 5l-5 15-3.5-6.5z"/><path d="M11.5 13.5L20 5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  empty: svg('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20M8.5 11h5"/>'),
};

/* ---------------------------------------------------------------------------
   Поиск: официальный Kosmo, группы и каналы, люди (имя, @username, ID, номер)
   --------------------------------------------------------------------------- */
const searchInput = $('#search-input');

function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = query.trim().replace(/^@/, '');
  if (!q) return safe;
  const re = new RegExp(`(${escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

let searchTab = 'all';
let mediaHits = [];

function renderSearch(query) {
  if (searchTab === 'messages') { renderMessageSearch(query); return; }
  if (searchTab === 'media') { renderMediaSearch(query); return; }
  const q = query.trim().toLowerCase().replace(/^@/, '');
  const me = state.acc.user;
  const out = $('#search-results');
  const kosmo = !q || 'kosmo official'.includes(q);
  // по номеру находят, только если человек его не скрыл
  const digits = q.replace(/[\s()+-]/g, '');
  const byPhone = (u) => /^\d{4,}$/.test(digits) && !u.privacy?.hidePhone && u.privacy?.findByPhone !== false
    && u.phone.replace(/\D/g, '').includes(digits);
  const people = Object.values(db.all())
    .filter((u) => u.id !== me.id && (!q || u.name.toLowerCase().includes(q) || (u.username && u.username.includes(q)) || u.publicId === q || byPhone(u)));
  const rooms = searchRooms(q);
  if (!kosmo && !people.length && !rooms.length) {
    out.innerHTML = `<div class="search-empty">${ICON.empty}<span>No results</span></div>`;
    return;
  }
  out.innerHTML = [
    kosmo && `<p class="section-label">Chats</p><ul class="chat-list">
      <li class="chat ripple-host" data-search-chat="${KOSMO}" tabindex="0" role="button">
        ${kosmoAvatar()}
        <div class="chat-top"><span class="chat-name">${KOSMO_NAME}</span></div>
        <div class="chat-meta"></div>
        <div class="chat-bottom"><span class="chat-text">official account</span></div>
      </li></ul>`,
    rooms.length && `<p class="section-label">Groups and channels</p><ul class="chat-list">${rooms.map((c) => `
      <li class="chat ripple-host" data-search-chat="${c.id}" tabindex="0" role="button">
        ${roomAvatar(c)}
        <div class="chat-top"><span class="chat-name">${highlight(c.name, query)}</span></div>
        <div class="chat-meta"></div>
        <div class="chat-bottom"><span class="chat-text">${c.type === 'channel' ? 'Channel' : 'Group'} · ${escapeHtml(roomPreview(c))}</span></div>
      </li>`).join('')}</ul>`,
    people.length && `<p class="section-label">People</p><ul class="chat-list">${people.map((u) => `
      <li class="chat ripple-host" data-person="${u.id}" tabindex="0" role="button">
        ${userAvatarHtml(u)}
        <div class="chat-top"><span class="chat-name name-with-badge">${highlight(u.name, query)}${u.role === 'owner' ? cosmicBadge('owner') : ''}</span></div>
        <div class="chat-meta"></div>
        <div class="chat-bottom"><span class="chat-text">${u.username ? `@${highlight(u.username, query)}` : `ID ${escapeHtml(u.publicId)}`}</span></div>
      </li>`).join('')}</ul>`,
  ].filter(Boolean).join('');
  hydrateMedia(out);
}

function openSearch() {
  renderSearch('');
  openPanel('search');
  setTimeout(() => searchInput.focus({ preventScroll: true }), 320);
}

searchInput.addEventListener('input', () => renderSearch(searchInput.value));
onPanelClose('search', () => {
  searchInput.blur();
  setTimeout(() => { searchInput.value = ''; }, 400);
});
$('#search-btn').addEventListener('click', openSearch);
function renderMessageSearch(query) {
  const q = query.trim().toLowerCase();
  const out = $('#search-results');
  if (q.length < 2) { out.innerHTML = `<div class="search-empty">${ICON.empty}<span>Type at least 2 letters to search messages</span></div>`; return; }
  const hits = searchMessages(q);
  if (!hits.length) { out.innerHTML = `<div class="search-empty">${ICON.empty}<span>No messages found</span></div>`; return; }
  out.innerHTML = `<ul class="chat-list">${hits.map(({ c, m }) => `
    <li class="chat ripple-host" data-search-msg="${m.id}" data-search-in="${c.id}" tabindex="0" role="button">
      ${chatAvatar(c)}
      <div class="chat-top"><span class="chat-name">${escapeHtml(chatTitle(c))}</span></div>
      <div class="chat-meta"><span class="chat-time">${new Date(m.at).toLocaleDateString()}</span></div>
      <div class="chat-bottom"><span class="chat-text">${highlight(m.text ?? m.caption ?? m.poll?.question ?? '', query)}</span></div>
    </li>`).join('')}</ul>`;
  hydrateMedia(out);
}

function renderMediaSearch(query) {
  const q = query.trim().toLowerCase();
  const out = $('#search-results');
  mediaHits = allMedia().filter((x) => !q || (x.caption ?? '').toLowerCase().includes(q) || (x.title ?? '').toLowerCase().includes(q));
  if (!mediaHits.length) { out.innerHTML = `<div class="search-empty">${ICON.empty}<span>No photos or videos yet</span></div>`; return; }
  out.innerHTML = `<div class="media-grid">${mediaHits.map((x, i) => `
    <button class="media-cell" type="button" data-media-hit="${i}" aria-label="Open ${x.type}">
      ${x.type === 'video' ? `<video data-media="${x.media}" muted playsinline preload="metadata"></video><span class="tray-badge"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>` : `<img data-media="${x.media}" alt="">`}
    </button>`).join('')}</div>`;
  hydrateMedia(out);
}

$('#search-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-stab]');
  if (!t) return;
  searchTab = t.dataset.stab;
  [...$('#search-tabs').children].forEach((b) => b.setAttribute('aria-selected', String(b === t)));
  renderSearch(searchInput.value);
});

$('#search-results').addEventListener('click', (e) => {
  const mh = e.target.closest('[data-media-hit]');
  if (mh) { openViewer(mediaHits, Number(mh.dataset.mediaHit)); return; }
  const sm = e.target.closest('[data-search-msg]');
  if (sm) { closePanel({ instant: true }); openChatAt(sm.dataset.searchIn, sm.dataset.searchMsg); return; }
  const person = e.target.closest('[data-person]');
  const chat = e.target.closest('[data-search-chat]');
  if (!person && !chat) return;
  closePanel({ instant: true });
  if (person) openDm(person.dataset.person);
  else openChat(chat.dataset.searchChat);
});

/* ---------------------------------------------------------------------------
   Вкладки
   --------------------------------------------------------------------------- */
const TABS = ['chats', 'feed', 'search', 'profile'];
let currentView = 'chats';

function moveThumb(name) {
  tabbar.style.setProperty('--tab-i', TABS.indexOf(name));
  $$('.tab', tabbar).forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  // «Жидкий» бегунок: в пути немного растягивается
  tabbar.classList.add('is-moving');
  setTimeout(() => tabbar.classList.remove('is-moving'), 220);
}

function showView(name) {
  if (name === currentView) {
    // Повторное нажатие — прокрутка наверх
    $(`#view-${name}`).scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const prev = $(`#view-${currentView}`);
  const next = $(`#view-${name}`);
  currentView = name;
  moveThumb(name);
  prev.classList.add('is-leaving');
  setTimeout(() => {
    prev.hidden = true;
    prev.classList.remove('is-leaving', 'is-active');
    next.hidden = false;
    next.classList.add('is-active', 'is-entering');
    next.addEventListener('animationend', () => next.classList.remove('is-entering'), { once: true });
    refreshRefraction();
  }, 150);
}

tabbar.addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (!t) return;
  if (t.dataset.tab === 'search') openSearch();
  else showView(t.dataset.tab);
});

/* ---------------------------------------------------------------------------
   Меню «+»
   --------------------------------------------------------------------------- */
const menu = $('#new-menu');

function openMenu() {
  menu.hidden = false;
  menu.classList.remove('is-closing');
  refreshRefraction();
  menu.querySelector('.menu-item').focus({ preventScroll: true });
}

function closeMenu() {
  if (menu.hidden || menu.classList.contains('is-closing')) return;
  menu.classList.add('is-closing');
  menu.addEventListener('animationend', () => { menu.hidden = true; menu.classList.remove('is-closing'); }, { once: true });
}

$('#new-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (menu.hidden) openMenu();
  else closeMenu();
});
menu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-new]');
  if (!item) return;
  closeMenu();
  if (item.dataset.new === 'chat') openSearch();
  else openCreate(item.dataset.new);
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#new-menu')) closeMenu();
});
document.addEventListener('kosmo:panel-open', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || app.hidden) return;
  if (!menu.hidden) closeMenu();
  else if (chatOverlayOpen() && !overlayOpen()) return;   // меню сообщения/чата закрывает chats.js
  else if (overlayOpen()) closeOverlay();
  else closePanel();
});

/* ---------------------------------------------------------------------------
   Синхронизация: другие вкладки могут выгнать эту сессию, написать
   сообщение или поменять данные — перечитываем и перерисовываем
   --------------------------------------------------------------------------- */
function incomingSince(before) {
  // новые сообщения от других людей во всех моих чатах
  const me = state.acc.user.id;
  return chats.forUser(me).flatMap((c) => c.messages
    .filter((m) => m.from !== me && !before.has(m.id))
    .map((m) => ({ ...m, chatId: c.id })));
}

let seenMessages = new Set();
const snapshot = () => new Set(chats.forUser(state.acc.user.id).flatMap((c) => c.messages.map((m) => m.id)));

export function sync() {
  if (app.hidden) return;
  const next = current();
  if (!next) {
    forgetAccount(state.acc?.user.id);
    leave('This session was terminated from another device');
    return;
  }
  const kosmoBefore = new Set(state.acc.user.messages.map((m) => m.id));
  state.acc = next;
  // уведомления: вход с другого устройства, новые сообщения
  const login = next.user.messages.filter((m) => !kosmoBefore.has(m.id) && m.kind === 'login' && m.sid !== next.session.id);
  if (login.length && next.user.security?.loginAlerts !== false) toast(`New login: ${login[login.length - 1].device}`);
  const incoming = incomingSince(seenMessages).filter((m) => m.chatId !== openChatId());
  if (incoming.length) {
    const last = incoming[incoming.length - 1];
    const from = db.get(last.from);
    const c = chats.get(last.chatId);
    const blocked = next.user.privacy?.blocked?.includes(last.from);
    if (!blocked && !last.threadOf) {
      notify({
        kind: isRoom(c) ? (c.type === 'channel' ? 'channels' : 'groups') : 'private',
        title: isRoom(c) ? c.name : from?.name ?? 'New message',
        text: previewText(last),
      });
    }
  }
  seenMessages = snapshot();
  refreshOpenChat();
  renderChatList();
  renderProfile();
  refreshFeed();
  renderStories();
  refreshRoom();
  refreshSettings();
  if (panelOpen() === 'sessions') renderSessions();
}

document.addEventListener('kosmo:changed', sync);
document.addEventListener('kosmo:profile', () => { renderChatList(); renderFeed(); });
document.addEventListener('kosmo:room-changed', () => { renderChatList(); refreshOpenChat(); });
document.addEventListener('kosmo:account-deleted', () => { forgetAccount(state.acc?.user.id); leave('Your account was deleted'); });

// Переключение между аккаунтами этой вкладки
document.addEventListener('kosmo:switch-account', async (e) => {
  shutdown();
  tab.set(e.detail);
  resetPanels();
  leaveArchive();
  try {
    await boot();
  } catch {
    forgetAccount(e.detail.uid);
    tab.clear();
    toast('This session was terminated');
    leave();
    return;
  }
  $('#auth').hidden = true;
  root.classList.add('has-session');
  if (!showApp({ animate: false })) { forgetAccount(e.detail.uid); toast('This session was terminated'); return; }
  app.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  toast(`Switched to ${state.acc.user.name}`);
});

// Ещё один аккаунт: вход, не выходя из текущих
document.addEventListener('kosmo:add-account', async () => {
  shutdown();
  tab.clear();
  resetPanels();
  app.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 250, easing: 'ease-in', fill: 'forwards' });
  await wait(250);
  app.hidden = true;
  app.getAnimations().forEach((a) => a.cancel());
  root.classList.remove('in-app');
  leaveArchive();
  state.acc = null;
  resetProfileCache();
  onLogout();
  paintAuthCancel();
});

// Отметка «был в сети» раз в минуту и при возвращении на вкладку
// «В сети» отмечает сервер по живому соединению (api.js шлёт ping)
const heartbeat = () => {};

// Изменения с сервера и завершённая сессия
document.addEventListener('kosmo:remote', () => sync());
document.addEventListener('kosmo:session-ended', () => {
  if (!state.acc) return;
  forgetAccount(state.acc.user.id);
  leave('This session was terminated from another device');
});

async function leave(message) {
  shutdown();
  tab.clear();
  resetPanels();
  $('#lock').hidden = true;
  app.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  await wait(300);
  app.hidden = true;
  root.classList.remove('in-app');
  leaveArchive();
  app.getAnimations().forEach((a) => a.cancel());
  state.acc = null;
  resetProfileCache();
  if (message) toast(message);
  onLogout();
  paintAuthCancel();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#logout-btn') || !state.acc) return;
  api('POST', '/api/logout').catch(() => {});
  forgetAccount(state.acc.user.id);
  const other = linkedAccounts()[0];
  if (other) { document.dispatchEvent(new CustomEvent('kosmo:switch-account', { detail: other })); return; }
  leave();
});

/* ---------------------------------------------------------------------------
   Показ приложения
   --------------------------------------------------------------------------- */
export function showApp({ animate = true } = {}) {
  if (!state.reload()) return false;
  resetProfileCache();
  seenMessages = snapshot();
  renderChatList();
  rememberAccount();
  renderFeed(true);
  renderStories();
  renderProfile(true);
  applyDesign();
  maybeLock();
  // всегда начинаем с чатов
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-chats'; v.classList.toggle('is-active', v.id === 'view-chats'); });
  currentView = 'chats';
  moveThumb('chats');
  app.hidden = false;
  root.classList.add('in-app');
  if (animate) {
    app.classList.add('is-entering');
    setTimeout(() => app.classList.remove('is-entering'), 1000);
  }
  refreshRefraction();
  heartbeat();
  return true;
}

export function initHome({ logout }) {
  onLogout = logout;
  window.addEventListener('storage', (e) => {
    if (['kosmo:accounts', 'kosmo:chats', 'kosmo:feed', 'kosmo:stories'].includes(e.key)) sync();
  });
}
