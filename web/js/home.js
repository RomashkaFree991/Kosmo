// Каркас приложения: вкладки, лента, поиск людей, меню «+»,
// синхронизация между вкладками (новые сообщения, входы, завершённые сессии).

import {
  $, $$, db, tab, current, wait, toast, escapeHtml, userAvatarHtml, kosmoAvatar, cosmicBadge, refreshRefraction,
} from './core.js';
import { state, openPanel, closePanel, panelOpen, onPanelClose, resetPanels } from './panels.js';
import {
  KOSMO, KOSMO_NAME, chats, renderChatList, refreshOpenChat, openChat, openDm, openChatId, previewText,
} from './chats.js';
import { renderProfile, renderSessions, resetProfileCache } from './profile.js';
import { applyDesign } from './design.js';
import { hydrateMedia } from './media.js';

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
   Лента: только официальные посты Kosmo
   --------------------------------------------------------------------------- */
const POSTS = [
  { time: 'Pinned', text: 'Welcome to Kosmo — one messenger, two looks. Open Profile → Designs to switch between Liquid Glass and Material You, pick a color, a background and avatar shapes.', art: 'linear-gradient(135deg, #64d2ff, #7d5cff 50%, #bf5af2)', likes: 892, comments: 41, views: '12K' },
  { time: 'Security', text: 'Every new sign-in to your account appears in the Kosmo chat with its device, IP address and location. Only trusted devices can terminate other sessions.', art: 'radial-gradient(circle at 72% 30%, #ffd6a5 0 5%, transparent 6%), radial-gradient(circle at 25% 110%, #3a1c71, transparent 60%), linear-gradient(160deg, #0b1d3a, #000 70%)', likes: 431, comments: 19, views: '6.1K' },
];
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));

function renderFeed() {
  $('#feed').innerHTML = POSTS.map((p, i) => `
    <article class="post" style="--i:${i}">
      <header class="post-head">
        ${kosmoAvatar('avatar-sm')}
        <div>
          <div class="post-author">${KOSMO_NAME}</div>
          <div class="post-time">${p.time}</div>
        </div>
      </header>
      <p class="post-text">${p.text}</p>
      <div class="post-art" style="--art:${p.art}" role="img" aria-label="Illustration"></div>
      <div class="post-actions">
        <button class="post-action" type="button" data-like="${i}" aria-pressed="false">${ICON.heart}<span>${fmt(p.likes)}</span></button>
        <button class="post-action" type="button">${ICON.comment}<span>${p.comments}</span></button>
        <button class="post-action" type="button" aria-label="Share">${ICON.share}</button>
        <span class="post-views">${ICON.eye}${p.views}</span>
      </div>
    </article>`).join('');
}

$('#feed').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-like]');
  if (!btn) return;
  const post = POSTS[btn.dataset.like];
  const liked = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', String(liked));
  btn.classList.toggle('is-liked', liked);
  btn.querySelector('span').textContent = fmt(post.likes + (liked ? 1 : 0));
  if (liked) navigator.vibrate?.(8);
});

/* ---------------------------------------------------------------------------
   Поиск: официальный Kosmo и люди (по имени, @username или ID)
   --------------------------------------------------------------------------- */
const searchInput = $('#search-input');

function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = query.trim().replace(/^@/, '');
  if (!q) return safe;
  const re = new RegExp(`(${escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function renderSearch(query) {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  const me = state.acc.user;
  const out = $('#search-results');
  const kosmo = !q || 'kosmo official'.includes(q);
  const people = Object.values(db.all())
    .filter((u) => u.id !== me.id && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q) || u.publicId === q));
  if (!kosmo && !people.length) {
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
    people.length && `<p class="section-label">People</p><ul class="chat-list">${people.map((u) => `
      <li class="chat ripple-host" data-person="${u.id}" tabindex="0" role="button">
        ${userAvatarHtml(u)}
        <div class="chat-top"><span class="chat-name name-with-badge">${highlight(u.name, query)}${u.role === 'owner' ? cosmicBadge('owner') : ''}</span></div>
        <div class="chat-meta"></div>
        <div class="chat-bottom"><span class="chat-text">@${highlight(u.username, query)}</span></div>
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
$('#search-results').addEventListener('click', (e) => {
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
  else toast(`${item.textContent.trim()} — coming soon`);
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#new-menu')) closeMenu();
});
document.addEventListener('kosmo:panel-open', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || app.hidden) return;
  if (!menu.hidden) closeMenu();
  else if (!$('.ctx-menu')) closePanel();
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
    leave('This session was terminated from another device');
    return;
  }
  const kosmoBefore = new Set(state.acc.user.messages.map((m) => m.id));
  state.acc = next;
  // уведомления: вход с другого устройства, новые сообщения
  const login = next.user.messages.filter((m) => !kosmoBefore.has(m.id) && m.kind === 'login' && m.sid !== next.session.id);
  if (login.length) toast(`New login: ${login[login.length - 1].device}`);
  const incoming = incomingSince(seenMessages).filter((m) => m.chatId !== openChatId());
  if (incoming.length) {
    const last = incoming[incoming.length - 1];
    const from = db.get(last.from);
    toast(`${from?.name ?? 'New message'}: ${previewText(last)}`);
  }
  seenMessages = snapshot();
  refreshOpenChat();
  renderChatList();
  renderProfile();
  if (panelOpen() === 'sessions') renderSessions();
}

document.addEventListener('kosmo:changed', sync);
document.addEventListener('kosmo:profile', () => { renderChatList(); });

// Отметка «был в сети» раз в минуту и при возвращении на вкладку
function heartbeat() {
  if (app.hidden || !state.acc || document.visibilityState !== 'visible') return;
  db.update(state.acc.user.id, (u) => {
    const s = u.sessions.find((x) => x.id === state.acc.session.id);
    if (s) s.lastActive = Date.now();
  });
}
setInterval(heartbeat, 60_000);
document.addEventListener('visibilitychange', heartbeat);

async function leave(message) {
  tab.clear();
  resetPanels();
  app.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  await wait(300);
  app.hidden = true;
  app.getAnimations().forEach((a) => a.cancel());
  state.acc = null;
  resetProfileCache();
  if (message) toast(message);
  onLogout();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#logout-btn') || !state.acc) return;
  db.update(state.acc.user.id, (u) => { u.sessions = u.sessions.filter((s) => s.id !== state.acc.session.id); });
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
  renderFeed();
  renderProfile(true);
  applyDesign();
  // всегда начинаем с чатов
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-chats'; v.classList.toggle('is-active', v.id === 'view-chats'); });
  currentView = 'chats';
  moveThumb('chats');
  app.hidden = false;
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
    if (e.key === 'kosmo:accounts' || e.key === 'kosmo:chats') sync();
  });
}
