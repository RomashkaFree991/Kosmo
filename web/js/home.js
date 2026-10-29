// Приложение после входа: чаты, лента, поиск, профиль и нижняя панель.

import {
  $, $$, store, wait, toast, refreshRefraction, paintAvatar, avatarStyle, initials, escapeHtml,
} from './core.js';

const app = $('#app');
const tabbar = $('#tabbar');
let user = null;
let onLogout = () => {};

/* ---------------------------------------------------------------------------
   Демо-данные
   --------------------------------------------------------------------------- */
const CHATS = [
  { id: 'kosmo', name: 'Kosmo', verified: true, pinned: true, text: 'Welcome to Kosmo! Your account is ready.', time: 'now', unread: 1 },
  { id: 'alex', name: 'Alex Morgan', online: true, text: 'Are we still on for tomorrow?', time: '21:42', unread: 2 },
  { id: 'design', name: 'Design Team', group: true, author: 'Mia', text: 'The new glass tab bar is live', time: '20:15', unread: 12, muted: true },
  { id: 'emma', name: 'Emma Wilson', online: true, text: 'Photo', time: '19:03' },
  { id: 'daniel', name: 'Daniel Kim', text: 'Haha, that is perfect', time: '18:47', mine: true, read: true },
  { id: 'space', name: 'Space News', channel: true, text: 'Artemis crew completes the lunar flyby', time: '17:20', unread: 3, muted: true },
  { id: 'sofia', name: 'Sofia Rossi', text: 'Voice message', time: 'Tue' },
  { id: 'ivan', name: 'Ivan Petrov', text: 'Sent you the files', time: 'Tue', mine: true, read: true },
  { id: 'frontend', name: 'Frontend Guild', group: true, author: 'Liam', text: 'View Transitions are so smooth', time: 'Mon' },
  { id: 'olivia', name: 'Olivia Brown', text: 'See you there!', time: 'Mon' },
  { id: 'noah', name: 'Noah Davis', text: 'Thanks a lot!', time: 'Sun', mine: true, read: true },
  { id: 'travel', name: 'Travel Buddies', group: true, author: 'Ava', text: 'Tickets booked for March', time: 'Sat' },
];

const PEOPLE = [
  { name: 'Alex Morgan', username: 'alex_morgan' },
  { name: 'Emma Wilson', username: 'emmawilson' },
  { name: 'Daniel Kim', username: 'dkim' },
  { name: 'Sofia Rossi', username: 'sofia_r' },
  { name: 'Ivan Petrov', username: 'ivanpetrov' },
  { name: 'Olivia Brown', username: 'olivia_b' },
  { name: 'Noah Davis', username: 'noahd' },
  { name: 'Mia Chen', username: 'miachen' },
  { name: 'Liam Novak', username: 'liam_n' },
  { name: 'Ava Martin', username: 'avamartin' },
];

const POSTS = [
  { author: 'Space News', verified: true, time: '2h', text: 'The Artemis crew has completed its lunar flyby and is heading home. Splashdown is planned for Saturday.', art: 'radial-gradient(circle at 70% 30%, #ffd6a5 0 6%, transparent 7%), radial-gradient(circle at 30% 120%, #3a1c71, transparent 60%), linear-gradient(160deg, #0b1d3a, #000 70%)', likes: 1240, comments: 86, views: '24K' },
  { author: 'Kosmo', verified: true, time: '5h', text: 'Two looks, one app: switch between Liquid Glass and Material You in Profile. Material You picks its colors from any photo.', art: 'linear-gradient(135deg, #64d2ff, #bf5af2 55%, #ff375f)', likes: 892, comments: 41, views: '12K' },
  { author: 'Design Daily', time: 'Yesterday', text: 'Glass belongs on the controls, not on the content. Keep your cards solid and let the bars float.', likes: 431, comments: 19, views: '6.1K' },
  { author: 'Frontend Guild', time: 'Mon', text: 'Spring animations feel natural because they keep momentum. Try a stiffness of 260 and damping of 30 for interface movement.', art: 'conic-gradient(from 200deg at 60% 50%, #00c6ff, #0072ff, #7f00ff, #00c6ff)', likes: 318, comments: 27, views: '4.8K' },
];

/* ---------------------------------------------------------------------------
   Иконки
   --------------------------------------------------------------------------- */
const ICON = {
  verified: '<svg class="chat-name-icon verified" viewBox="0 0 24 24" aria-label="Verified"><path fill="currentColor" d="M12 2.5l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.8-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.8-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.8 3 .2z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  muted: '<svg class="i chat-name-icon muted-icon" viewBox="0 0 24 24" aria-label="Muted"><path d="M11 5L6.5 9H4v6h2.5l4.5 4zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
  group: '<svg class="i chat-name-icon muted-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 6.2a3 3 0 0 1 0 5.6M17 14.2a5 5 0 0 1 3.5 4.8"/></svg>',
  channel: '<svg class="i chat-name-icon muted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6"/></svg>',
  read: '<svg class="i" viewBox="0 0 24 24" aria-label="Read"><path d="M2.5 12.5l4 4L15 8M10.5 15.5l1 1L20 8"/></svg>',
  pin: '<svg class="i pin" viewBox="0 0 24 24" aria-label="Pinned"><path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/></svg>',
  heart: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  comment: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z"/></svg>',
  share: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5L20 5l-5 15-3.5-6.5z"/><path d="M11.5 13.5L20 5"/></svg>',
  eye: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  empty: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20M8.5 11h5"/></svg>',
};

const avatarHtml = (name, cls = '', online = false) =>
  `<span class="avatar ${cls}${online ? ' is-online' : ''}" style="${avatarStyle(name)}" aria-hidden="true"><span>${initials(name)}</span></span>`;

/* ---------------------------------------------------------------------------
   Чаты
   --------------------------------------------------------------------------- */
function chatsFor(u) {
  const first = u.name.split(/\s+/)[0];
  return CHATS.map((c) => (c.id === 'kosmo' ? { ...c, text: `Welcome to Kosmo, ${first}! Your account is ready.` } : c));
}

function chatRow(c, i, query = '') {
  const icons = (c.group ? ICON.group : c.channel ? ICON.channel : '') + (c.verified ? ICON.verified : '') + (c.muted ? ICON.muted : '');
  const text = c.author ? `<b>${escapeHtml(c.author)}:</b> ${highlight(c.text, query)}` : highlight(c.text, query);
  const status = c.unread
    ? `<span class="badge${c.muted ? ' is-muted' : ''}">${c.unread}</span>`
    : c.pinned ? ICON.pin : '';
  return `
    <li class="chat ripple-host" style="--i:${i}" data-chat="${c.id}" tabindex="0">
      ${avatarHtml(c.name, '', c.online)}
      <div class="chat-top"><span class="chat-name">${highlight(c.name, query)}</span>${icons}</div>
      <div class="chat-meta"><span class="chat-time">${c.mine && c.read ? ICON.read : ''}${c.time}</span>${status}</div>
      <div class="chat-bottom"><span class="chat-text">${text}</span></div>
    </li>`;
}

function renderChats() {
  const list = chatsFor(user);
  $('#chat-list').innerHTML = list.map((c, i) => chatRow(c, i)).join('');
  const unread = list.filter((c) => c.unread && !c.muted).reduce((n, c) => n + c.unread, 0);
  const badge = $('#chats-badge');
  badge.hidden = !unread;
  badge.textContent = unread;
}

/* ---------------------------------------------------------------------------
   Лента
   --------------------------------------------------------------------------- */
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));

function renderFeed() {
  $('#feed').innerHTML = POSTS.map((p, i) => `
    <article class="post" style="--i:${i}">
      <header class="post-head">
        ${avatarHtml(p.author, 'avatar-sm')}
        <div>
          <div class="post-author">${p.author}${p.verified ? ICON.verified : ''}</div>
          <div class="post-time">${p.time}</div>
        </div>
      </header>
      <p class="post-text">${p.text}</p>
      ${p.art ? `<div class="post-art" style="--art:${p.art}" role="img" aria-label="Illustration"></div>` : ''}
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
   Профиль
   --------------------------------------------------------------------------- */
function renderProfile() {
  paintAvatar($('#profile-avatar'), user.name, user.name);
  paintAvatar($('#tab-avatar'), user.name, user.name);
  $('#profile-name').textContent = user.name;
  $('#profile-username').textContent = `@${user.username}`;
  $('#profile-phone').textContent = user.phone;
  $('#profile-bio').textContent = user.bio;
}

$('#logout-btn').addEventListener('click', async () => {
  store.remove('session');
  closeSearch();
  app.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  await wait(300);
  app.hidden = true;
  app.getAnimations().forEach((a) => a.cancel());
  onLogout();
});

/* ---------------------------------------------------------------------------
   Вкладки
   --------------------------------------------------------------------------- */
const TABS = ['chats', 'feed', 'search', 'profile'];
let currentView = 'chats';

function moveThumb(tab) {
  tabbar.style.setProperty('--tab-i', TABS.indexOf(tab));
  $$('.tab', tabbar).forEach((t) => {
    const on = t.dataset.tab === tab;
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
  const tab = e.target.closest('.tab');
  if (!tab) return;
  if (tab.dataset.tab === 'search') openSearch();
  else showView(tab.dataset.tab);
});

/* ---------------------------------------------------------------------------
   Поиск: выезжает справа налево, чаты и нижняя панель уходят
   --------------------------------------------------------------------------- */
const panel = $('#search-panel');
const searchInput = $('#search-input');

function openSearch() {
  if (app.classList.contains('is-searching')) return;
  closeMenu();
  renderSearch('');
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  app.classList.add('is-searching');
  $('#views').inert = true;
  tabbar.inert = true;
  refreshRefraction();
  setTimeout(() => searchInput.focus({ preventScroll: true }), 320);
}

function closeSearch() {
  if (!app.classList.contains('is-searching')) return;
  app.classList.remove('is-searching');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  $('#views').inert = false;
  tabbar.inert = false;
  searchInput.blur();
  setTimeout(() => { searchInput.value = ''; }, 400);
  $('#search-btn').focus({ preventScroll: true });
}

$('#search-btn').addEventListener('click', openSearch);
$('#search-close').addEventListener('click', closeSearch);
searchInput.addEventListener('input', () => renderSearch(searchInput.value));

function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = query.trim();
  if (!q) return safe;
  const re = new RegExp(`(${escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function renderSearch(query) {
  const out = $('#search-results');
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (!q) {
    const recent = chatsFor(user).filter((c) => !c.group && !c.channel).slice(0, 8);
    out.innerHTML = `
      <p class="search-section">Recent</p>
      <div class="recent">${recent.map((c, i) => `
        <button class="recent-item" type="button" style="--i:${i}" data-chat="${c.id}">
          ${avatarHtml(c.name, '', c.online)}<span>${escapeHtml(c.name.split(' ')[0])}</span>
        </button>`).join('')}
      </div>
      <p class="search-section">Chats</p>
      <ul class="chat-list">${chatsFor(user).slice(0, 6).map((c, i) => chatRow(c, i)).join('')}</ul>`;
    return;
  }
  const chats = chatsFor(user).filter((c) => c.name.toLowerCase().includes(q));
  const messages = chatsFor(user).filter((c) => !chats.includes(c) && c.text.toLowerCase().includes(q));
  const people = PEOPLE.filter((p) => !chats.some((c) => c.name === p.name)
    && (p.name.toLowerCase().includes(q) || p.username.includes(q)));
  if (!chats.length && !messages.length && !people.length) {
    out.innerHTML = `<div class="search-empty">${ICON.empty}<span>No results</span></div>`;
    return;
  }
  let i = 0;
  out.innerHTML = [
    chats.length && `<p class="search-section">Chats</p><ul class="chat-list">${chats.map((c) => chatRow(c, i++, query)).join('')}</ul>`,
    people.length && `<p class="search-section">People</p><ul class="chat-list">${people.map((p) => chatRow({ id: p.username, name: p.name, text: `@${p.username}`, time: '' }, i++, query)).join('')}</ul>`,
    messages.length && `<p class="search-section">Messages</p><ul class="chat-list">${messages.map((c) => chatRow(c, i++, query)).join('')}</ul>`,
  ].filter(Boolean).join('');
}

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
  toast(`${item.textContent.trim()} — coming soon`);
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#new-menu')) closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || app.hidden) return;
  if (!menu.hidden) closeMenu();
  else closeSearch();
});

/* ---------------------------------------------------------------------------
   Показ приложения
   --------------------------------------------------------------------------- */
export function showApp(u, { animate = true } = {}) {
  user = u;
  renderChats();
  renderFeed();
  renderProfile();
  // всегда начинаем с чатов
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-chats'; v.classList.toggle('is-active', v.id === 'view-chats'); });
  currentView = 'chats';
  moveThumb('chats');
  panel.inert = true;
  app.hidden = false;
  if (animate) {
    app.classList.add('is-entering');
    setTimeout(() => app.classList.remove('is-entering'), 1000);
  }
  refreshRefraction();
}

export function initHome({ logout }) {
  onLogout = logout;
}
