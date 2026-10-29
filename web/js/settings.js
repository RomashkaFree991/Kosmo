// Настройки профиля: Privacy, Security (код-пароль, блокировка, удаление
// аккаунта), Notifications, Data and storage, About. Экран блокировки.

import {
  $, $$, db, tab, toast, escapeHtml, userAvatarHtml, hashPasscode, kosmoAvatar, refreshRefraction, wait,
} from './core.js';
import { state, openPanel, openOverlay, closeOverlay, overlayOpen } from './panels.js';
import { hydrateMedia } from './media.js';
import { createPad } from './pad.js';
import { chats, isRoom, ICON } from './chats.js';
import { posts } from './feeddata.js';
import { formatPhone } from './phone.js';

const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const SICON = {
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  hand: svg('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
  bell: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  data: svg('<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'),
  call: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  devices: svg('<rect x="2.5" y="5" width="14" height="10" rx="2"/><path d="M6 19h7"/><rect x="17" y="9" width="4.5" height="10" rx="1.2"/>'),
  timer: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>'),
  chevron: svg('<path d="M9.5 6l6 6-6 6"/>', 'i chev-right'),
  sparkle: svg('<path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z"/>'),
};

const me = () => state.acc.user;
const priv = () => me().privacy ?? {};
const sets = () => me().settings ?? {};

function savePrivacy(patch) {
  db.update(me().id, (u) => { u.privacy = { ...(u.privacy ?? {}), ...patch }; });
  state.reload();
  document.dispatchEvent(new CustomEvent('kosmo:profile'));
}
function saveSettings(patch) {
  db.update(me().id, (u) => { u.settings = { ...(u.settings ?? {}), ...patch }; });
  state.reload();
}

const row = (attrs, icon, text, extra = '', cls = '') => `
  <button class="group-row group-row-btn ripple-host ${cls}" type="button" ${attrs}>
    <span class="row-icon">${icon}</span><span class="row-text">${text}</span>${extra}
  </button>`;
const sw = (id, text, on, sub = '') => `
  <label class="switch-row">
    <span class="sw-text">${text}${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-sw="${id}" role="switch" ${on ? 'checked' : ''}>
  </label>`;
// «Кто видит»: Everybody / Nobody
const choice = (key, text, value, sub = '') => `
  <div class="choice-row">
    <span class="sw-text">${text}${sub ? `<small>${sub}</small>` : ''}</span>
    <div class="segs" role="radiogroup" aria-label="${text}">
      ${['everybody', 'nobody'].map((v) => `<button type="button" class="seg-btn" role="radio" data-choice="${key}" data-v="${v}" aria-checked="${(value ?? 'everybody') === v}">${v === 'everybody' ? 'Everybody' : 'Nobody'}</button>`).join('')}
    </div>
  </div>`;

/* ---------------------------------------------------------------------------
   Privacy
   --------------------------------------------------------------------------- */
function renderPrivacy() {
  const p = priv();
  const blocked = (p.blocked ?? []).map((id) => db.get(id)).filter(Boolean);
  $('#privacy-body').innerHTML = `
    <div class="note">${SICON.lock}<span>Choose who can see your info and contact you. Changes apply instantly.</span></div>
    <p class="section-label">Who can see</p>
    <section class="group group-pad">
      ${choice('hidePhone', 'Phone number', p.hidePhone ? 'nobody' : 'everybody')}
      ${choice('lastSeen', 'Last seen & online', p.lastSeen, 'If hidden, people see “last seen recently”.')}
      ${choice('avatar', 'Profile photo', p.avatar)}
      ${choice('hideBio', 'Bio', p.hideBio ? 'nobody' : 'everybody')}
    </section>
    <p class="section-label">Who can contact me</p>
    <section class="group group-pad">
      ${choice('messages', 'New messages', p.messages, 'People who already chat with you can still write.')}
      ${choice('groups', 'Add me to groups & channels', p.groups)}
      ${sw('findByPhone', 'Find me by phone number', p.findByPhone !== false, 'People can find you in Search by your number.')}
    </section>
    <p class="section-label">Messages</p>
    <section class="group group-pad">
      ${sw('readReceipts', 'Read receipts', p.readReceipts !== false, 'If off, you won’t see read receipts from others either.')}
    </section>
    <p class="section-label">Blocked users${blocked.length ? ` · ${blocked.length}` : ''}</p>
    <section class="group">
      ${blocked.length ? blocked.map((u) => `
        <div class="group-row blocked-row">
          ${userAvatarHtml(u, 'avatar-xs')}<span class="row-text">${escapeHtml(u.name)}</span>
          <button class="chip-btn" type="button" data-unblock="${u.id}">Unblock</button>
        </div>`).join('') : `<div class="group-row"><span class="row-icon">${SICON.hand}</span><span class="row-text tile-muted">Nobody is blocked. Block people from their profile.</span></div>`}
    </section>`;
  hydrateMedia($('#privacy-body'));
}

$('#privacy-body').addEventListener('click', (e) => {
  const c = e.target.closest('[data-choice]');
  if (c) {
    const key = c.dataset.choice;
    const v = c.dataset.v;
    savePrivacy(key === 'hidePhone' || key === 'hideBio' ? { [key]: v === 'nobody' } : { [key]: v });
    $$(`[data-choice="${key}"]`).forEach((b) => b.setAttribute('aria-checked', String(b === c)));
  }
  const ub = e.target.closest('[data-unblock]');
  if (ub) {
    savePrivacy({ blocked: (priv().blocked ?? []).filter((x) => x !== ub.dataset.unblock) });
    renderPrivacy();
    toast('Unblocked');
  }
});

document.addEventListener('kosmo:toggle-block', (e) => {
  toggleBlock(e.detail);
  document.dispatchEvent(new CustomEvent('kosmo:room-changed'));
});

export function toggleBlock(userId) {
  const list = priv().blocked ?? [];
  const on = !list.includes(userId);
  savePrivacy({ blocked: on ? [...list, userId] : list.filter((x) => x !== userId) });
  toast(on ? 'Blocked' : 'Unblocked');
  return on;
}

/* ---------------------------------------------------------------------------
   Security
   --------------------------------------------------------------------------- */
const LOCK_AFTER = [[0, 'On every launch'], [1, 'After 1 min away'], [5, 'After 5 min away'], [60, 'After 1 hour away']];
const DESTRUCT = [[1, '1 month'], [3, '3 months'], [6, '6 months'], [12, '1 year']];

function renderSecurity() {
  const s = me().security ?? {};
  const u = me();
  $('#security-body').innerHTML = `
    <section class="sec-hero">
      <span class="sec-shield">${ICON.shield}</span>
      <h3>Your account is protected</h3>
      <p>Passcode, trusted devices and login alerts keep Kosmo safe.</p>
    </section>
    <p class="section-label">Passcode</p>
    <section class="group">
      ${row('data-sec="passcode"', SICON.key, 'Change passcode', SICON.chevron)}
    </section>
    <section class="group group-pad">
      ${sw('lock', 'Passcode lock', s.lock, 'Ask for the 4-digit passcode when Kosmo opens.')}
      ${s.lock ? `
        <div class="choice-row choice-col">
          <span class="sw-text">Auto-lock</span>
          <div class="segs segs-wrap" role="radiogroup" aria-label="Auto-lock">
            ${LOCK_AFTER.map(([v, l]) => `<button type="button" class="seg-btn" role="radio" data-autolock="${v}" aria-checked="${(s.autoLock ?? 0) === v}">${l}</button>`).join('')}
          </div>
        </div>
        <button class="btn btn-secondary glass" type="button" data-sec="lock-now">${SICON.lock}Lock now</button>` : ''}
    </section>
    <p class="section-label">Account</p>
    <section class="group">
      ${row('data-open-phone', SICON.call, 'Change number', `<span class="row-value">${escapeHtml(formatPhone(u.phone))}</span>${SICON.chevron}`)}
      ${row('data-open-sessions', SICON.devices, 'Active sessions', `<span class="row-value">${u.sessions.length}</span>${SICON.chevron}`)}
    </section>
    <section class="group group-pad">
      ${sw('loginAlerts', 'Login alerts in Kosmo chat', s.loginAlerts !== false, 'Get a message about every new sign-in.')}
      <div class="choice-row choice-col">
        <span class="sw-text">Delete my account if away for<small>Your data will be removed after this period of inactivity.</small></span>
        <div class="segs segs-wrap" role="radiogroup" aria-label="Self-destruct">
          ${DESTRUCT.map(([v, l]) => `<button type="button" class="seg-btn" role="radio" data-destruct="${v}" aria-checked="${(s.destruct ?? 6) === v}">${l}</button>`).join('')}
        </div>
      </div>
    </section>
    <section class="group">
      ${row('data-sec="delete"', ICON.trash, 'Delete account', '', 'danger')}
    </section>`;
  refreshRefraction();
}

function saveSecurity(patch) {
  db.update(me().id, (u) => { u.security = { ...(u.security ?? {}), ...patch }; });
  state.reload();
}

$('#security-body').addEventListener('click', (e) => {
  const a = e.target.closest('[data-autolock]');
  if (a) { saveSecurity({ autoLock: Number(a.dataset.autolock) }); renderSecurity(); }
  const d = e.target.closest('[data-destruct]');
  if (d) { saveSecurity({ destruct: Number(d.dataset.destruct) }); renderSecurity(); }
  const s = e.target.closest('[data-sec]');
  if (!s) return;
  if (s.dataset.sec === 'passcode') startPasscode('change');
  if (s.dataset.sec === 'delete') startPasscode('delete');
  if (s.dataset.sec === 'lock-now') lock();
});

/* ---------- Смена кода-пароля и подтверждение удаления ---------- */
let pc = null;   // { mode: 'change' | 'delete', step, code }
$('#passcode-body').innerHTML = `
  <div class="pc-step" id="pc-step">
    <span class="sec-shield">${SICON.key}</span>
    <p class="pass-sub" id="pc-sub"></p>
    <div id="pc-pad"></div>
  </div>
  <div class="delete-confirm" id="pc-delete" hidden></div>`;
const passPad = createPad($('#pc-pad'), { onComplete: onPasscode });

function setPassTitle(text, sub = '') {
  $('#passcode-title').textContent = text;
  $('#pc-sub').textContent = sub;
}

function startPasscode(mode) {
  pc = { mode, step: 'current' };
  passPad.reset();
  $('#pc-step').hidden = false;
  $('#pc-delete').hidden = true;
  setPassTitle(mode === 'delete' ? 'Delete account' : 'Change passcode', 'Enter your current passcode');
  openOverlay('passcode');
}

async function checkCode(code) {
  const u = me();
  return (await hashPasscode(u.passSalt ?? u.id, code)) === u.passHash;
}

async function onPasscode(code, api) {
  if (!pc) return;
  if (pc.step === 'current') {
    if (!(await checkCode(code))) { toast('Wrong passcode'); await api.error(); return; }
    await api.success();
    if (pc.mode === 'delete') { api.reset(); confirmDelete(); return; }
    pc.step = 'new';
    api.reset();
    setPassTitle('Change passcode', 'Enter a new passcode');
    return;
  }
  if (pc.step === 'new') {
    if (await checkCode(code)) { toast('Choose a different passcode'); await api.error(); return; }
    pc.code = code;
    pc.step = 'repeat';
    api.reset();
    setPassTitle('Change passcode', 'Repeat the new passcode');
    return;
  }
  if (pc.code !== code) {
    toast('Passcodes don’t match');
    pc.step = 'new';
    await api.error();
    setPassTitle('Change passcode', 'Enter a new passcode');
    return;
  }
  await api.success();
  const u = me();
  const hash = await hashPasscode(u.passSalt ?? u.id, code);
  db.update(u.id, (x) => {
    x.passHash = hash;
    const s = state.acc.session;
    x.messages.push({ id: crypto.randomUUID?.() ?? String(Date.now()), kind: 'passcode', at: Date.now(), sid: s.id, device: s.name, type: s.type, ip: s.ip, location: s.location });
  });
  state.reload();
  pc = null;
  closeOverlay();
  toast('Passcode changed');
  document.dispatchEvent(new CustomEvent('kosmo:changed'));
}

function confirmDelete() {
  $('#passcode-title').textContent = 'Delete account';
  const box = $('#pc-delete');
  $('#pc-step').hidden = true;
  box.hidden = false;
  box.classList.add('step-in');
  box.innerHTML = `
    <span class="sec-shield is-danger">${ICON.trash}</span>
    <h3>Delete your account?</h3>
    <p>Your profile, posts, channels and groups you own will be deleted for everyone. This can’t be undone.</p>
    <button class="btn btn-danger" type="button" data-delete-account>Delete my account</button>
    <button class="btn btn-secondary glass" type="button" data-close-overlay>Cancel</button>`;
  refreshRefraction();
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-delete-account]')) return;
  const uidX = me().id;
  // чаты: свои группы и каналы удаляются, из остальных выходим
  const all = chats.all();
  for (const [id, c] of Object.entries(all)) {
    if (!c.members.includes(uidX)) continue;
    if (isRoom(c) && c.owner === uidX) delete all[id];
    else if (isRoom(c)) {
      c.members = c.members.filter((x) => x !== uidX);
      c.admins = (c.admins ?? []).filter((x) => x !== uidX);
    }
  }
  localStorage.setItem('kosmo:chats', JSON.stringify(all));
  localStorage.setItem('kosmo:feed', JSON.stringify(posts.all().filter((p) => p.author !== uidX)));
  const accounts = db.all();
  delete accounts[uidX];
  localStorage.setItem('kosmo:accounts', JSON.stringify(accounts));
  closeOverlay();
  await wait(200);
  document.dispatchEvent(new CustomEvent('kosmo:account-deleted'));
});

/* ---------------------------------------------------------------------------
   Экран блокировки
   --------------------------------------------------------------------------- */
const lockEl = $('#lock');
const LOCK_KEY = 'kosmo:unlocked';
let hiddenAt = 0;

const lockPad = createPad($('#lock-pad'), {
  onComplete: async (code, api) => {
    if (!(await checkCode(code))) {
      api.error();
      return;
    }
    await api.success();
    unlock();
  },
});

export function lock() {
  if (!state.acc) return;
  const u = me();
  $('#lock-avatar').innerHTML = userAvatarHtml(u, 'avatar-lock');
  hydrateMedia($('#lock-avatar'));
  $('#lock-title').textContent = `Hi, ${u.name.split(/\s+/)[0]}`;
  lockPad.reset();
  try { sessionStorage.removeItem(LOCK_KEY); } catch { /* */ }
  lockEl.hidden = false;
  lockEl.classList.remove('is-leaving');
  document.activeElement?.blur?.();
}

function unlock() {
  try { sessionStorage.setItem(LOCK_KEY, '1'); } catch { /* */ }
  lockEl.classList.add('is-leaving');
  setTimeout(() => { lockEl.hidden = true; lockEl.classList.remove('is-leaving'); }, 420);
}

// Вызывается при показе приложения: нужна ли блокировка
export function maybeLock() {
  const s = me().security ?? {};
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(LOCK_KEY) === '1'; } catch { /* */ }
  if (s.lock && !unlocked) lock();
  else lockEl.hidden = true;
}

document.addEventListener('visibilitychange', () => {
  if (!state.acc || $('#app').hidden) return;
  const s = me().security ?? {};
  if (!s.lock) return;
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (s.autoLock && hiddenAt && Date.now() - hiddenAt > s.autoLock * 60_000) lock();
});

$('#lock-logout').addEventListener('click', () => {
  lockEl.hidden = true;
  $('#logout-btn')?.click();
});

/* ---------------------------------------------------------------------------
   Notifications
   --------------------------------------------------------------------------- */
function renderNotifications() {
  const n = sets().notify ?? {};
  $('#notifications-body').innerHTML = `
    <p class="section-label">Message notifications</p>
    <section class="group group-pad">
      ${sw('notify.private', 'Private chats', n.private !== false)}
      ${sw('notify.groups', 'Groups', n.groups !== false)}
      ${sw('notify.channels', 'Channels', n.channels !== false)}
      ${sw('notify.preview', 'Show message preview', n.preview !== false, 'Show the text of new messages in notifications.')}
    </section>
    <p class="section-label">In-app</p>
    <section class="group group-pad">
      ${sw('notify.sound', 'Sounds', n.sound !== false)}
      ${sw('notify.vibrate', 'Vibrate', n.vibrate !== false)}
      ${sw('notify.feed', 'Comments on my posts', n.feed !== false)}
    </section>
    <button class="btn btn-secondary glass" type="button" data-test-notify>${SICON.bell}Test notification</button>`;
  refreshRefraction();
}

$('#notifications-body').addEventListener('click', (e) => {
  if (e.target.closest('[data-test-notify]')) notify({ kind: 'private', title: 'Kosmo', text: 'Notifications work!' });
});

let audio = null;
// Уведомление о новом сообщении с учётом настроек
export function notify({ kind, title, text }) {
  const n = state.acc?.user.settings?.notify ?? {};
  if (n[kind] === false) return;
  toast(n.preview === false ? `${title}: New message` : `${title}: ${text}`);
  if (n.vibrate !== false) navigator.vibrate?.(30);
  if (n.sound !== false) {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, audio.currentTime + 0.08);
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.26);
    } catch { /* без звука */ }
  }
}

/* ---------------------------------------------------------------------------
   Data and storage
   --------------------------------------------------------------------------- */
const fmtBytes = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

async function renderStorage() {
  const s = sets();
  const myChats = chats.forUser(me().id);
  const msgs = myChats.reduce((n, c) => n + c.messages.length, 0);
  const media = myChats.reduce((n, c) => n + c.messages.filter((m) => m.media).length, 0);
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const used = est?.usage ?? 0;
  const quota = est?.quota ?? 0;
  const pct = quota ? Math.min(100, Math.max(1, (used / quota) * 100)) : 0;
  $('#storage-body').innerHTML = `
    <section class="storage-card">
      <span class="storage-big">${used ? fmtBytes(used) : '—'}</span>
      <span class="storage-sub">used on this device${quota ? ` of ${fmtBytes(quota)}` : ''}</span>
      <div class="storage-bar"><span style="width:${pct}%"></span></div>
      <div class="storage-stats">
        <span><b>${myChats.length}</b>chats</span><span><b>${msgs}</b>messages</span><span><b>${media}</b>files</span><span><b>${posts.all().filter((p) => p.author === me().id).length}</b>posts</span>
      </div>
    </section>
    <p class="section-label">Media</p>
    <section class="group group-pad">
      ${sw('autoplay', 'Auto-play videos in Feed', s.autoplay !== false)}
      ${sw('sendEnter', 'Send with Enter', s.sendEnter !== false, 'On a keyboard, Shift+Enter adds a new line.')}
      ${sw('saveMedia', 'Compress photos before sending', s.compress !== false)}
    </section>
    <section class="group">
      ${row('data-clear-cache', ICON.trash, 'Clear cache', '<span class="row-value">Thumbnails</span>')}
    </section>`;
}

$('#storage-body').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-clear-cache]')) return;
  try {
    const keys = await caches?.keys?.();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
  } catch { /* нет Cache API */ }
  toast('Cache cleared');
  renderStorage();
});

/* ---------------------------------------------------------------------------
   About
   --------------------------------------------------------------------------- */
function renderAbout() {
  const users = Object.keys(db.all()).length;
  $('#about-body').innerHTML = `
    <section class="about-hero">
      ${kosmoAvatar('avatar-hero')}
      <h2>Kosmo</h2>
      <p>Version 0.6 · web</p>
    </section>
    <p class="section-label">What’s new</p>
    <section class="group group-pad about-list">
      <p>${SICON.sparkle}<span><b>Channels and groups</b> with admins, @usernames and comments.</span></p>
      <p>${SICON.sparkle}<span><b>Feed</b>: share photos, videos and code with everyone.</span></p>
      <p>${SICON.sparkle}<span><b>Privacy and Security</b>: passcode lock, blocked users and more.</span></p>
      <p>${SICON.sparkle}<span><b>Media viewer</b> with zoom, swipes and video controls.</span></p>
    </section>
    <p class="section-label">This demo</p>
    <section class="group group-pad about-list">
      <p>${SICON.info}<span>Accounts, chats and files are stored only in this browser. ${users} account${users === 1 ? '' : 's'} on this device. Use +000 numbers for test accounts.</span></p>
    </section>`;
}

/* ---------------------------------------------------------------------------
   Переключатели и открытие страниц
   --------------------------------------------------------------------------- */
document.addEventListener('change', (e) => {
  const s = e.target.closest('[data-sw]');
  if (!s || !state.acc) return;
  const key = s.dataset.sw;
  const on = s.checked;
  if (['findByPhone', 'readReceipts'].includes(key)) savePrivacy({ [key]: on });
  else if (key === 'lock' || key === 'loginAlerts') { saveSecurity({ [key]: on }); if (key === 'lock') { renderSecurity(); if (on) { try { sessionStorage.setItem(LOCK_KEY, '1'); } catch { /* */ } toast('Passcode lock is on'); } } }
  else if (key.startsWith('notify.')) saveSettings({ notify: { ...(sets().notify ?? {}), [key.slice(7)]: on } });
  else if (key === 'saveMedia') saveSettings({ compress: on });
  else saveSettings({ [key]: on });
});

document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open-settings]');
  if (!o || !state.acc) return;
  const page = o.dataset.openSettings;
  ({ privacy: renderPrivacy, security: renderSecurity, notifications: renderNotifications, storage: renderStorage, about: renderAbout })[page]();
  openPanel(page);
});

export function refreshSettings() {
  if (!state.acc) return;
  if ($('#panel-privacy').classList.contains('is-open')) renderPrivacy();
  if ($('#panel-security').classList.contains('is-open') && overlayOpen() !== 'passcode') renderSecurity();
}
