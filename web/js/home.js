// Приложение после входа: чат Kosmo, лента, поиск, профиль, сессии,
// смена номера и нижняя панель.

import {
  $, $$, root, db, tab, current, wait, toast, shake, refreshRefraction, paintAvatar, avatarStyle, initials,
  escapeHtml, kosmoAvatar, cosmicBadge, formatDate, formatTime, timeAgo,
} from './core.js';
import { paintSwatches } from './color.js';
import { createPhoneField, formatPhone } from './phone.js';
import { createOtp } from './otp.js';

const app = $('#app');
const tabbar = $('#tabbar');
let acc = null;            // { user, session } этой вкладки
let onLogout = () => {};
let knownMessages = new Set();

/* ---------------------------------------------------------------------------
   Иконки
   --------------------------------------------------------------------------- */
const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  desktop: svg('<rect x="3" y="4.5" width="18" height="12" rx="2.2"/><path d="M8.5 20h7M12 16.5V20"/>'),
  phone: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>'),
  tablet: svg('<rect x="4.5" y="2.5" width="15" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5z"/>'),
  pin: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  shield: svg('<path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
  at: svg('<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/>'),
  call: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  quote: svg('<path d="M5 6.5h14M5 11h14M5 15.5h9"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  devices: svg('<rect x="2.5" y="5" width="14" height="10" rx="2"/><path d="M6 19h7"/><rect x="17" y="9" width="4.5" height="10" rx="1.2"/>'),
  chevron: svg('<path d="M9.5 6l6 6-6 6"/>', 'i chev-right'),
  logout: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>'),
  comment: svg('<path d="M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z"/>'),
  share: svg('<path d="M4 12.5L20 5l-5 15-3.5-6.5z"/><path d="M11.5 13.5L20 5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  empty: svg('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20M8.5 11h5"/>'),
};
const deviceIcon = (type) => ICON[type] ?? ICON.desktop;

const avatarHtml = (name, cls = '') =>
  `<span class="avatar ${cls}" style="${avatarStyle(name)}" aria-hidden="true"><span>${escapeHtml(initials(name))}</span></span>`;

const KOSMO_NAME = `<span class="name-with-badge">Kosmo ${cosmicBadge('official')}</span>`;

/* ---------------------------------------------------------------------------
   Права в сессиях: управлять могут только доверенные устройства.
   Устройство, создавшее аккаунт, нельзя выгнать или лишить доверия.
   --------------------------------------------------------------------------- */
const canManage = () => acc.session.trusted;
const canControl = (s) => canManage() && s.id !== acc.session.id && !s.first;

/* ---------------------------------------------------------------------------
   Чат Kosmo: приветствие, новые входы, смена номера
   --------------------------------------------------------------------------- */
const firstName = () => acc.user.name.split(/\s+/)[0];

function messageCopy(m) {
  if (m.kind === 'welcome') {
    return { title: `Welcome to Kosmo, ${escapeHtml(firstName())}!`, text: 'Your account has been created. This device was added as a trusted device.' };
  }
  if (m.kind === 'login') {
    return { title: 'New login to your account', text: 'A device signed in to your account. If it wasn\'t you, terminate this session.' };
  }
  return {
    title: 'Phone number changed',
    text: `Your number was changed from <b>${escapeHtml(formatPhone(m.from))}</b> to <b>${escapeHtml(formatPhone(m.to))}</b>.`,
  };
}

function unreadCount() {
  const readAt = acc.session.readAt ?? acc.session.createdAt - 1;
  return acc.user.messages.filter((m) => m.at > readAt).length;
}

function lastMessage() {
  return acc.user.messages[acc.user.messages.length - 1];
}

const shortTime = (t) => (new Date(t).toDateString() === new Date().toDateString() ? formatTime(t) : formatDate(t).split(',')[0]);

function renderChats() {
  const last = lastMessage();
  const unread = unreadCount();
  $('#chat-list').innerHTML = `
    <li class="chat ripple-host" data-open-chat tabindex="0" role="button" aria-label="Kosmo, official account">
      ${kosmoAvatar()}
      <div class="chat-top"><span class="chat-name">${KOSMO_NAME}</span></div>
      <div class="chat-meta">
        <span class="chat-time">${last ? shortTime(last.at) : ''}</span>
        ${unread ? `<span class="badge">${unread}</span>` : '<svg class="i pin" viewBox="0 0 24 24" aria-label="Pinned"><path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/></svg>'}
      </div>
      <div class="chat-bottom"><span class="chat-text">${last ? messageCopy(last).title : 'Official account'}</span></div>
    </li>`;
  const badge = $('#chats-badge');
  badge.hidden = !unread;
  badge.textContent = unread;
}

function detailRow(icon, label, value) {
  return `<div class="msg-row">${icon}<span class="msg-label">${label}</span><span class="msg-value">${escapeHtml(value)}</span></div>`;
}

function messageAction(m) {
  if (m.kind !== 'login') return '';
  const s = acc.user.sessions.find((x) => x.id === m.sid);
  if (m.sid === acc.session.id) return `<span class="msg-chip">${ICON.shield}This device</span>`;
  if (!s) return '<span class="msg-chip is-muted">Session terminated</span>';
  if (canControl(s)) return `<button class="btn btn-danger msg-btn" type="button" data-terminate="${s.id}">Terminate session</button>`;
  return '<span class="msg-chip is-muted">Only a trusted device can terminate it</span>';
}

function renderMessages({ scroll = false } = {}) {
  const box = $('#messages');
  let lastDay = '';
  box.innerHTML = acc.user.messages.map((m) => {
    const day = new Date(m.at).toDateString();
    const sep = day !== lastDay ? `<div class="day-chip">${formatDate(m.at).split(',')[0]}</div>` : '';
    lastDay = day;
    const copy = messageCopy(m);
    const isNew = !knownMessages.has(m.id);
    return `${sep}
      <article class="msg${isNew ? ' is-new' : ''}" data-id="${m.id}">
        <h3 class="msg-title">${copy.title}</h3>
        <p class="msg-text">${copy.text}</p>
        <div class="msg-rows">
          ${detailRow(deviceIcon(m.type), 'Device', m.device)}
          ${detailRow(ICON.globe, 'IP address', m.ip)}
          ${detailRow(ICON.pin, 'Location', m.location)}
          ${detailRow(ICON.clock, 'Time', formatDate(m.at))}
        </div>
        ${messageAction(m)}
        <span class="msg-time">${formatTime(m.at)}</span>
      </article>`;
  }).join('');
  acc.user.messages.forEach((m) => knownMessages.add(m.id));
  if (scroll) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function openChat() {
  $('#chat-title').innerHTML = KOSMO_NAME;
  $('#chat-head-avatar').innerHTML = kosmoAvatar('avatar-head');
  // непрочитанные сообщения появятся с анимацией
  knownMessages = new Set(acc.user.messages.slice(0, -unreadCount() || undefined).map((m) => m.id));
  markRead();
  renderChats();
  renderMessages({ scroll: true });
  openPanel('chat');
}

function markRead() {
  db.update(acc.user.id, (u) => {
    const s = u.sessions.find((x) => x.id === acc.session.id);
    if (s) s.readAt = Date.now();
  });
  acc = current() ?? acc;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-chat]')) {
    if (openPanelId === 'search') closePanel({ instant: true });
    openChat();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-open-chat]')) openChat();
});

/* ---------------------------------------------------------------------------
   Сессии: выгнать устройство, добавить в доверенные
   --------------------------------------------------------------------------- */
async function terminate(sid, el) {
  const s = acc.user.sessions.find((x) => x.id === sid);
  if (!s || !canControl(s)) return;
  el?.closest('.sess-card')?.classList.add('is-removing');
  await wait(260);
  db.update(acc.user.id, (u) => { u.sessions = u.sessions.filter((x) => x.id !== sid); });
  toast(`${s.name} — session terminated`);
  sync();
}

function toggleTrust(sid) {
  const s = acc.user.sessions.find((x) => x.id === sid);
  if (!s || !canControl(s)) return;
  db.update(acc.user.id, (u) => {
    const t = u.sessions.find((x) => x.id === sid);
    if (t) t.trusted = !t.trusted;
  });
  toast(s.trusted ? `${s.name} is no longer trusted` : `${s.name} is now trusted`);
  sync();
}

function terminateOthers() {
  const ids = acc.user.sessions.filter(canControl).map((s) => s.id);
  if (!ids.length) return;
  $$('.sess-card[data-sid]').forEach((c) => { if (ids.includes(c.dataset.sid)) c.classList.add('is-removing'); });
  setTimeout(() => {
    db.update(acc.user.id, (u) => { u.sessions = u.sessions.filter((x) => !ids.includes(x.id)); });
    toast(ids.length === 1 ? 'Session terminated' : `${ids.length} sessions terminated`);
    sync();
  }, 260);
}

function sessionCard(s) {
  const mine = s.id === acc.session.id;
  const chips = [
    s.trusted && `<span class="chip chip-trusted">${ICON.shield}Trusted</span>`,
    s.first && '<span class="chip">Created the account</span>',
  ].filter(Boolean).join('');
  const actions = canControl(s) ? `
    <div class="sess-actions">
      <button class="chip-btn" type="button" data-trust="${s.id}">${ICON.shield}${s.trusted ? 'Remove trust' : 'Trust'}</button>
      <button class="chip-btn danger" type="button" data-terminate="${s.id}">Terminate</button>
    </div>` : '';
  return `
    <article class="sess-card" data-sid="${s.id}">
      <span class="sess-icon">${deviceIcon(s.type)}</span>
      <div class="sess-info">
        <h3 class="sess-name">${escapeHtml(s.name)}</h3>
        <p class="sess-meta">${escapeHtml(s.ip)} · ${escapeHtml(s.location)}</p>
        <p class="sess-meta">${mine ? '<span class="online-dot"></span>This device · online' : `Last active ${timeAgo(s.lastActive)}`}</p>
        ${chips ? `<div class="chips">${chips}</div>` : ''}
        ${actions}
      </div>
    </article>`;
}

function renderSessions() {
  const others = acc.user.sessions.filter((s) => s.id !== acc.session.id).sort((a, b) => b.lastActive - a.lastActive);
  const removable = others.filter(canControl).length;
  $('#sessions').innerHTML = `
    <p class="section-label">This device</p>
    ${sessionCard(acc.session)}
    ${canManage() ? '' : `<div class="note">${ICON.info}<span>This device isn't trusted yet. A trusted device can trust it or terminate it.</span></div>`}
    <p class="section-label">Other sessions${others.length ? ` · ${others.length}` : ''}</p>
    ${others.length ? others.map(sessionCard).join('') : `<div class="note">${ICON.devices}<span>No other active sessions. Each new sign-in will appear here and in the Kosmo chat.</span></div>`}
    ${removable ? `<button class="btn btn-danger" type="button" id="terminate-all">Terminate all other sessions</button>` : ''}`;
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-terminate]');
  if (t) terminate(t.dataset.terminate, t);
  const tr = e.target.closest('[data-trust]');
  if (tr) toggleTrust(tr.dataset.trust);
  if (e.target.closest('#terminate-all')) terminateOthers();
});

/* ---------------------------------------------------------------------------
   Смена номера: код на старый номер → новый номер → код на новый
   --------------------------------------------------------------------------- */
const steps = $('#phone-steps');
const cpField = createPhoneField($('#cp-phone-field'));
const cpSubmit = $('#cp-new-submit');
let cpNewPhone = null;

function setStep(name, animate = true) {
  $$('.step', steps).forEach((s) => {
    const on = s.dataset.step === name;
    s.hidden = !on;
    s.classList.toggle('step-in', on && animate);
  });
  refreshRefraction();
}

function openPhoneChange() {
  $('#cp-current').textContent = formatPhone(acc.user.phone);
  setStep('intro', false);
  openPanel('phone');
}

const oldOtp = createOtp($('#cp-old-otp'), {
  onComplete: () => {
    setStep('new-phone');
    cpField.clear();
    setTimeout(cpField.focus, 350);
  },
});

const newOtp = createOtp($('#cp-new-otp'), {
  onComplete: () => {
    const from = acc.user.phone;
    db.update(acc.user.id, (u) => {
      u.messages.push({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        kind: 'phone', at: Date.now(), sid: acc.session.id,
        device: acc.session.name, type: acc.session.type, ip: acc.session.ip, location: acc.session.location,
        from, to: cpNewPhone,
      });
      u.phone = cpNewPhone;
    });
    $('#cp-done').textContent = formatPhone(cpNewPhone);
    setStep('done');
    sync();
  },
});

$('#cp-start').addEventListener('click', () => {
  $('#cp-old').textContent = formatPhone(acc.user.phone);
  oldOtp.reset();
  setStep('old-code');
  setTimeout(oldOtp.focus, 350);
});

$('#cp-new-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (cpSubmit.classList.contains('is-loading')) return;
  if (!cpField.isComplete()) { cpField.shake(); return; }
  const phone = cpField.e164;
  if (phone === acc.user.phone) { cpField.shake(); toast('This is already your number'); return; }
  if (db.byPhone(phone)) { cpField.shake(); toast('This number is used by another account'); return; }
  cpNewPhone = phone;
  cpSubmit.style.width = `${cpSubmit.offsetWidth}px`;
  requestAnimationFrame(() => cpSubmit.classList.add('is-loading'));
  setTimeout(() => {
    cpSubmit.classList.remove('is-loading');
    cpSubmit.style.removeProperty('width');
    $('#cp-new').textContent = formatPhone(phone);
    newOtp.reset();
    setStep('new-code');
    setTimeout(newOtp.focus, 350);
  }, 900);
});

/* ---------------------------------------------------------------------------
   Лента: только официальные посты Kosmo
   --------------------------------------------------------------------------- */
const POSTS = [
  { time: 'Pinned', text: 'Welcome to Kosmo — one messenger, two looks. Switch between Liquid Glass and Material You in Profile; Material You can take its colors from any photo.', art: 'linear-gradient(135deg, #64d2ff, #7d5cff 50%, #bf5af2)', likes: 892, comments: 41, views: '12K' },
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
   Профиль: имя и аватар отдельно, всё остальное — плашками
   --------------------------------------------------------------------------- */
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

function tile(icon, label, value, attrs = '', wide = false) {
  const tag = attrs ? 'button' : 'div';
  return `<${tag} class="tile${wide ? ' tile-wide' : ''}${attrs ? ' ripple-host' : ''}" ${attrs}${attrs ? ' type="button"' : ''}>
    <span class="tile-icon">${icon}</span>
    <span class="tile-label">${label}</span>
    <span class="tile-value">${value}</span>
  </${tag}>`;
}

function themeSeg() {
  const t = root.dataset.theme;
  const item = (id, label) => `
    <button class="seg-item" type="button" role="radio" data-set-theme="${id}" aria-checked="${t === id}">
      <svg class="i seg-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${label}
    </button>`;
  return `<div class="seg glass" data-refract="0.8" role="radiogroup" aria-label="Design style">
    <span class="seg-thumb" aria-hidden="true"></span>${item('glass', 'Liquid Glass')}${item('material', 'Material You')}</div>`;
}

let profileSig = '';
function renderProfile() {
  const u = acc.user;
  const sessions = u.sessions.length;
  const sig = JSON.stringify([u.name, u.username, u.phone, u.bio, u.role, sessions, acc.session.trusted]);
  if (sig === profileSig) return;
  profileSig = sig;
  $('#profile').innerHTML = `
    <section class="profile-hero">
      <div class="hero-avatar">
        <span class="hero-orbit" aria-hidden="true"></span>
        ${avatarHtml(u.name, 'avatar-hero')}
      </div>
      <h2 class="profile-name"><span>${escapeHtml(u.name)}</span>${u.role === 'owner' ? cosmicBadge('owner') : ''}</h2>
    </section>

    <section class="tiles" aria-label="Account">
      ${tile(ICON.at, 'Username', `@${escapeHtml(u.username)}`, 'data-copy-username aria-label="Copy username"')}
      ${tile(ICON.call, 'Phone', escapeHtml(formatPhone(u.phone)), 'data-open-phone aria-label="Change number"')}
      ${u.bio ? tile(ICON.quote, 'Bio', escapeHtml(u.bio), '', true) : ''}
      ${tile(ICON.calendar, 'Joined', monthYear.format(u.createdAt))}
      ${tile(ICON.devices, 'Sessions', `${sessions} active`, 'data-open-sessions aria-label="Sessions"')}
    </section>

    <section class="group" aria-label="Appearance">
      <div class="group-row group-row-col">
        <span class="group-label">Design</span>
        ${themeSeg()}
        <div class="palette palette-inline" role="radiogroup" aria-label="Dynamic color">
          <div class="palette-row"></div>
          <label class="photo-btn" for="photo-input" aria-label="Color from photo" title="Color from photo">
            <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l4.8-4.3 3.4 3 3.3-3.4 4.5 4.2"/></svg>
          </label>
        </div>
      </div>
    </section>

    <section class="group" aria-label="Settings">
      <button class="group-row group-row-btn ripple-host" type="button" data-open-sessions>
        <span class="row-icon">${ICON.devices}</span><span class="row-text">Sessions</span>
        <span class="row-value">${sessions}</span>${ICON.chevron}
      </button>
      <button class="group-row group-row-btn ripple-host" type="button" data-open-phone>
        <span class="row-icon">${ICON.call}</span><span class="row-text">Change number</span>${ICON.chevron}
      </button>
      <button class="group-row group-row-btn ripple-host danger" type="button" id="logout-btn">
        <span class="row-icon">${ICON.logout}</span><span class="row-text">Log out</span>
      </button>
    </section>`;
  paintSwatches();
  paintAvatar($('#tab-avatar'), u.name, u.name);
  refreshRefraction();
}

document.addEventListener('click', async (e) => {
  if (app.hidden) return;
  if (e.target.closest('[data-open-sessions]')) { renderSessions(); openPanel('sessions'); }
  if (e.target.closest('[data-open-phone]')) openPhoneChange();
  if (e.target.closest('[data-copy-username]')) {
    try {
      await navigator.clipboard.writeText(`@${acc.user.username}`);
      toast('Username copied');
    } catch {
      toast(`@${acc.user.username}`);
    }
  }
  if (e.target.closest('#logout-btn')) logout();
});

/* ---------------------------------------------------------------------------
   Поиск: официальный Kosmo и зарегистрированные пользователи
   --------------------------------------------------------------------------- */
const searchInput = $('#search-input');

function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = query.trim().replace(/^@/, '');
  if (!q) return safe;
  const re = new RegExp(`(${escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function personRow(u, q) {
  return `
    <li class="chat ripple-host" data-person tabindex="0">
      ${avatarHtml(u.name)}
      <div class="chat-top"><span class="chat-name name-with-badge">${highlight(u.name, q)}${u.role === 'owner' ? cosmicBadge('owner') : ''}</span></div>
      <div class="chat-meta"></div>
      <div class="chat-bottom"><span class="chat-text">@${highlight(u.username, q)}</span></div>
    </li>`;
}

function renderSearch(query) {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  const out = $('#search-results');
  const kosmo = !q || 'kosmo official'.includes(q);
  const people = q ? Object.values(db.all())
    .filter((u) => u.id !== acc.user.id && (u.name.toLowerCase().includes(q) || u.username.includes(q))) : [];
  if (!kosmo && !people.length) {
    out.innerHTML = `<div class="search-empty">${ICON.empty}<span>No results</span></div>`;
    return;
  }
  out.innerHTML = [
    kosmo && `<p class="section-label">Chats</p><ul class="chat-list">
      <li class="chat ripple-host" data-open-chat tabindex="0" role="button">
        ${kosmoAvatar()}
        <div class="chat-top"><span class="chat-name">${KOSMO_NAME}</span></div>
        <div class="chat-meta"></div>
        <div class="chat-bottom"><span class="chat-text">official account</span></div>
      </li></ul>`,
    people.length && `<p class="section-label">People</p><ul class="chat-list">${people.map((u) => personRow(u, query)).join('')}</ul>`,
  ].filter(Boolean).join('');
}

searchInput.addEventListener('input', () => renderSearch(searchInput.value));
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-person]')) toast('Messaging people is coming soon');
});

/* ---------------------------------------------------------------------------
   Боковые панели: выезжают справа, основной экран и нижняя панель уходят
   --------------------------------------------------------------------------- */
let openPanelId = null;
let panelOpener = null;

function openPanel(id) {
  if (openPanelId === id) return;
  if (openPanelId) closePanel({ instant: true });
  closeMenu();
  const panel = $(`#panel-${id}`);
  panelOpener = document.activeElement;
  openPanelId = id;
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('is-open');
  app.classList.add('has-panel');
  $('#views').inert = true;
  tabbar.inert = true;
  refreshRefraction();
  if (id === 'search') {
    renderSearch('');
    setTimeout(() => searchInput.focus({ preventScroll: true }), 320);
  }
}

function closePanel({ instant = false } = {}) {
  if (!openPanelId) return;
  const panel = $(`#panel-${openPanelId}`);
  if (instant) {
    panel.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => panel.style.removeProperty('transition')));
  }
  panel.classList.remove('is-open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  if (openPanelId === 'search') {
    searchInput.blur();
    setTimeout(() => { searchInput.value = ''; }, 400);
  }
  openPanelId = null;
  if (!instant) {
    app.classList.remove('has-panel');
    $('#views').inert = false;
    tabbar.inert = false;
    panelOpener?.focus?.({ preventScroll: true });
  }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-panel]')) closePanel();
});
$('#search-btn').addEventListener('click', () => openPanel('search'));

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
  if (t.dataset.tab === 'search') openPanel('search');
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
  toast(`${item.textContent.trim()} — coming soon`);
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#new-menu')) closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || app.hidden) return;
  if (!menu.hidden) closeMenu();
  else closePanel();
});

/* ---------------------------------------------------------------------------
   Синхронизация: другие вкладки могут выгнать эту сессию, войти заново
   или поменять данные — перечитываем аккаунт и перерисовываем
   --------------------------------------------------------------------------- */
export function sync() {
  if (app.hidden) return;
  const next = current();
  if (!next) {
    leave('This session was terminated from another device');
    return;
  }
  const before = acc ? new Set(acc.user.messages.map((m) => m.id)) : null;
  acc = next;
  // уведомление о входе с другого устройства
  if (before) {
    const fresh = acc.user.messages.filter((m) => !before.has(m.id) && m.kind === 'login' && m.sid !== acc.session.id);
    if (fresh.length) toast(`New login: ${fresh[fresh.length - 1].device}`);
  }
  if (openPanelId === 'chat') {
    markRead();
    renderMessages({ scroll: true });
  }
  renderChats();
  renderProfile();
  if (openPanelId === 'sessions') renderSessions();
}

// Отметка «был в сети» раз в минуту и при возвращении на вкладку
function heartbeat() {
  if (app.hidden || !acc || document.visibilityState !== 'visible') return;
  db.update(acc.user.id, (u) => {
    const s = u.sessions.find((x) => x.id === acc.session.id);
    if (s) s.lastActive = Date.now();
  });
}
setInterval(heartbeat, 60_000);
document.addEventListener('visibilitychange', heartbeat);

async function leave(message) {
  tab.clear();
  closePanel({ instant: true });
  app.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  await wait(300);
  app.hidden = true;
  app.classList.remove('has-panel');
  $('#views').inert = false;
  tabbar.inert = false;
  app.getAnimations().forEach((a) => a.cancel());
  acc = null;
  profileSig = '';
  if (message) toast(message);
  onLogout();
}

function logout() {
  db.update(acc.user.id, (u) => { u.sessions = u.sessions.filter((s) => s.id !== acc.session.id); });
  leave();
}

/* ---------------------------------------------------------------------------
   Показ приложения
   --------------------------------------------------------------------------- */
export function showApp({ animate = true } = {}) {
  acc = current();
  if (!acc) return false;
  profileSig = '';
  renderChats();
  renderFeed();
  renderProfile();
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

export function initHome({ logout: onOut }) {
  onLogout = onOut;
  window.addEventListener('storage', (e) => { if (e.key === 'kosmo:accounts') sync(); });
}
