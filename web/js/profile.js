// Профиль: аватар и имя сверху, остальное плашками; редактирование
// (фото / цвет / буквы аватарки, имя, @username, био), сессии, смена номера.

import {
  $, $$, db, wait, toast, shake, escapeHtml, userAvatarHtml, cosmicBadge, userBadge, AVATAR_COLORS,
  timeAgo, refreshRefraction, initials, arrangeTiles,
} from './core.js';
import { createOtp } from './otp.js';
import { state, openPanel, overlayOpen, closeOverlay } from './panels.js';
import { putBlob, hydrateMedia, squareAvatar, mediaDuration, videoPoster, compressImage } from './media.js';
import { bannerHtml, profileExtras, tracksOf } from './info.js';
import { openModal, closeModal } from './plus.js';
import { ICON as CHAT_ICON, deviceIcon, openSaved, openChatAt, chatTitle, chats, chatAvatar, openChat, isRoom } from './chats.js';
import {
  PI, openBookmarks, openDnd, dndUntil, openBackup, openBots, bookmarks, openStats,
} from './plus.js';
import { SICON } from './settings.js';
import { accountsHtml, linkedAccounts } from './accounts.js';
import { api, loadSnapshot } from './api.js';
import { openCropper, openFieldScreen } from './editkit.js';

const STATS_ICON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>';
import './qrlogin.js';

const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  ...CHAT_ICON,
  at: svg('<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/>'),
  call: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  quote: svg('<path d="M5 6.5h14M5 11h14M5 15.5h9"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  devices: svg('<rect x="2.5" y="5" width="14" height="10" rx="2"/><path d="M6 19h7"/><rect x="17" y="9" width="4.5" height="10" rx="1.2"/>'),
  hash: svg('<path d="M9.5 4l-2 16M16.5 4l-2 16M4.5 9h16M3.5 15h16"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  palette: svg('<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15" cy="7.8" r="1.1"/>'),
  chevron: svg('<path d="M9.5 6l6 6-6 6"/>', 'i chev-right'),
  logout: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>'),
};

// @username: 3–32 английские буквы или цифры, хотя бы одна буква
export const USERNAME_RE = /^(?=.*[a-z])[a-z0-9]{3,32}$/;
export const RESERVED = ['kosmo', 'admin', 'support', 'settings', 'official'];

/* ---------------------------------------------------------------------------
   Профиль
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

const row = (attrs, icon, text, extra = '', cls = '') => `
  <button class="group-row group-row-btn ripple-host ${cls}" type="button" ${attrs}>
    <span class="row-icon">${icon}</span><span class="row-text">${text}</span>${extra}
  </button>`;

// пометка «скрыто от других» на своих плашках
const hiddenMark = '<span class="tile-hidden"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.2"/></svg>hidden</span>';

const MAIL_ICON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>';

let sig = '';
export function renderProfile(force = false) {
  const u = state.acc.user;
  const next = JSON.stringify([u.banner, u.music, u.profileChannel, u.profileChannel && chats.get(u.profileChannel)?.members?.length, u.premium, u.settings?.dnd, (u.bookmarks ?? []).length, u.name, u.username, u.email, u.bio, u.role, u.avatar, u.publicId, u.sessions.length, u.privacy, u.security?.lock, linkedAccounts().map((a) => a.uid)]);
  if (next === sig && !force) return;
  sig = next;
  $('#profile').innerHTML = `
    <section class="profile-hero${u.banner?.media ? ' has-banner' : ''}">
      ${bannerHtml(u)}
      <button class="hero-avatar" type="button" data-open-edit aria-label="Edit profile">
        <span class="hero-orbit" aria-hidden="true"></span>
        ${userAvatarHtml(u, 'avatar-hero')}
        <span class="hero-edit" aria-hidden="true">${ICON.camera}</span>
      </button>
      <h2 class="profile-name"><span>${escapeHtml(u.name)}</span>${userBadge(u)}</h2>
      ${u.official ? '<p class="official-note">Official account</p>' : ''}
      <button class="pill-btn" type="button" data-open-edit>${ICON.edit}Edit profile</button>
    </section>

    ${profileExtras(u)}
    <section class="tiles" aria-label="Account">
      ${arrangeTiles([
        u.username ? tile(ICON.at, 'Username', `@${escapeHtml(u.username)}`, 'data-copy="username" aria-label="Copy username"') : tile(ICON.at, 'Username', '<span class="tile-muted">Not set</span>', 'data-open-edit aria-label="Set username"'),
        tile(ICON.hash, 'ID', escapeHtml(u.publicId), 'data-copy="id" aria-label="Copy ID"'),
        tile(MAIL_ICON, `Email${u.privacy?.showEmail ? '' : hiddenMark}`, escapeHtml(u.email ?? ''), 'data-open-email aria-label="Change email"', true),
        u.bio ? tile(ICON.quote, `Bio${u.privacy?.hideBio ? hiddenMark : ''}`, escapeHtml(u.bio), '', true) : '',
        tile(ICON.calendar, 'Joined', monthYear.format(u.createdAt)),
        tile(ICON.devices, 'Sessions', `${u.sessions.length} active`, 'data-open-sessions aria-label="Sessions"'),
      ])}
    </section>

    <section class="group settings-group" aria-label="Kosmo">
      ${row('data-open-saved', PI.bookmark, 'Saved Messages', ICON.chevron, 'ic-blue')}
      ${row('data-open-bookmarks', PI.star, 'Bookmarks', `<span class="row-value">${bookmarks().length || ''}</span>${ICON.chevron}`, 'ic-orange')}
      ${String(u.publicId) === '1' ? row('data-open-stats', STATS_ICON, 'Statistics', ICON.chevron, 'ic-violet') : ''}
      ${row('data-open-dnd', PI.moon, 'Do not disturb', `<span class="row-value">${dndUntil() ? `until ${new Date(dndUntil()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Off'}</span>${ICON.chevron}`, 'ic-violet')}
    </section>
    <section class="group settings-group" aria-label="Account settings">
      ${row('data-open-edit', ICON.edit, 'Edit profile', ICON.chevron, 'ic-blue')}
      ${row('data-open-design', ICON.palette, 'Designs', ICON.chevron, 'ic-pink')}
    </section>
    <section class="group settings-group" aria-label="Settings">
      ${row('data-open-settings="privacy"', SICON.lock, 'Privacy', ICON.chevron, 'ic-violet')}
      ${row('data-open-settings="security"', ICON.shield, 'Security', `<span class="row-value">${u.security?.lock ? 'Passcode lock' : ''}</span>${ICON.chevron}`, 'ic-green')}
      ${row('data-open-settings="notifications"', SICON.bell, 'Notifications', ICON.chevron, 'ic-red')}
      ${row('data-open-settings="storage"', SICON.data, 'Data and storage', ICON.chevron, 'ic-orange')}
      ${row('data-open-sessions', ICON.devices, 'Sessions', `<span class="row-value">${u.sessions.length}</span>${ICON.chevron}`, 'ic-teal')}
    </section>
    ${accountsHtml(u.id)}
    <section class="group settings-group" aria-label="More">
      ${row('data-open-backup', PI.lock, 'Backup', ICON.chevron, 'ic-green')}
      ${row('data-open-bots', PI.bot, 'My bots', ICON.chevron, 'ic-teal')}
      ${row('data-open-settings="about"', SICON.info, 'About Kosmo', ICON.chevron, 'ic-blue')}
      <button class="group-row group-row-btn ripple-host danger" type="button" id="logout-btn">
        <span class="row-icon">${ICON.logout}</span><span class="row-text">Log out</span>
      </button>
    </section>`;
  hydrateMedia($('#profile'));
  const tabAvatar = $('#tab-avatar');
  tabAvatar.outerHTML = userAvatarHtml(u, 'avatar-tab').replace('<span class="avatar', '<span id="tab-avatar" class="avatar');
  hydrateMedia($('#tabbar'));
  refreshRefraction();
}

document.addEventListener('click', async (e) => {
  if (!state.acc || $('#app').hidden) return;
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const value = copy.dataset.copy === 'id' ? state.acc.user.publicId : `@${state.acc.user.username}`;
    try {
      await navigator.clipboard.writeText(value);
      toast(copy.dataset.copy === 'id' ? 'ID copied' : 'Username copied');
    } catch {
      toast(value);
    }
  }
  if (e.target.closest('[data-open-edit]')) openEdit();
  if (e.target.closest('[data-open-sessions]')) { renderSessions(); openPanel('sessions'); }
  if (e.target.closest('[data-open-email]')) openEmailChange();
  if (e.target.closest('[data-open-saved]')) openSaved();
  if (e.target.closest('[data-open-bookmarks]')) {
    openBookmarks({
      title: (id) => (id.startsWith('saved_') ? 'Saved Messages' : chats.get(id) ? chatTitle(chats.get(id)) : 'Chat'),
      onOpen: (chatId, msgId) => openChatAt(chatId, msgId),
    });
  }
  if (e.target.closest('[data-open-dnd]')) openDnd(() => renderProfile(true));
  if (e.target.closest('[data-open-bots]')) openBots();
  if (e.target.closest('[data-open-stats]')) openStats();
  if (e.target.closest('[data-open-backup]')) {
    openBackup(() => {
      const me = state.acc.user;
      const mine = Object.values(chats.all()).filter((c) => c.members.includes(me.id));
      const ids = new Set(mine.flatMap((c) => c.members));
      return {
        kosmo: 'backup', exportedAt: Date.now(), me: me.id, bookmarks: me.bookmarks ?? [],
        accounts: Object.fromEntries([...ids].map((id) => [id, { name: db.get(id)?.name ?? 'Unknown', username: db.get(id)?.username ?? '' }])),
        chats: Object.fromEntries(mine.map((c) => [c.id, { ...c, messages: c.messages.filter((m) => !m.hiddenFor?.includes(me.id)) }])),
      };
    });
  }
});

/* ---------------------------------------------------------------------------
   Редактирование профиля — выглядит как сам профиль: баннер, аватар, имя,
   плитки канала и музыки (пустые — с «+»), плашки полей. Нажатие на плашку
   открывает отдельный экран поля; галочка справа от заголовка сохраняет всё.
   --------------------------------------------------------------------------- */
let draft = null;
let saved = '';
const editView = $('#edit-view');
const dirty = () => draft && JSON.stringify(draft) !== saved;

// пустой @username тоже можно
function usernameOk(v) {
  if (!v || v === state.acc.user.username) return true;   // своё имя не проверяем
  return USERNAME_RE.test(v) && (!RESERVED.includes(v) || state.acc.user.official) && !db.usernameTaken(v, state.acc.user.id);
}

const PICK_ICON = {
  channel: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  music: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pencil: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>',
  user: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
};
const BANNER_IC = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-3L20 16"/></svg>';
const myPublicRooms = () => Object.values(chats.all()).filter((c) => isRoom(c) && c.username && c.owner === state.acc.user.id);
const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

function editTile(key, icon, label, value, wide = false) {
  return `<button class="tile${wide ? ' tile-wide' : ''} ripple-host edit-tile" type="button" data-edit="${key}">
    <span class="tile-icon">${icon}</span>
    <span class="tile-label">${label}</span>
    <span class="tile-value">${value}</span>
    <span class="edit-pen" aria-hidden="true">${PICK_ICON.pencil}</span>
  </button>`;
}

function paintEdit() {
  const u = state.acc.user;
  const d = draft;
  const preview = { ...u, name: d.name || u.name, avatar: d.avatar, banner: d.banner };
  const ch = d.channel ? chats.get(d.channel) : null;
  const music = d.music ?? [];
  const busy = (k) => (d.busy === k ? ' is-busy' : '');
  editView.innerHTML = `
    <section class="profile-hero edit-hero${d.banner?.media ? ' has-banner' : ''}">
      ${bannerHtml(preview)}
      <button class="edit-banner-btn${busy('banner')}" type="button" data-edit="banner" aria-label="Banner">
        <span class="edit-chip">${BANNER_IC}${d.banner?.media ? 'Change banner' : 'Add banner'}</span>
      </button>
      <button class="hero-avatar${busy('avatar')}" type="button" data-edit="avatar" aria-label="Profile photo">
        <span class="hero-orbit" aria-hidden="true"></span>
        ${userAvatarHtml(preview, 'avatar-hero')}
        <span class="hero-edit" aria-hidden="true">${ICON.camera}</span>
      </button>
      <button class="profile-name edit-name" type="button" data-edit="name"><span>${escapeHtml(d.name || 'Your name')}</span>${PICK_ICON.pencil}</button>
    </section>

    <div class="profile-extras is-two edit-extras">
      ${ch ? `<button class="tile profile-channel ripple-host" type="button" data-edit="channel">
          ${chatAvatar(ch, 'avatar-sm')}
          <span class="info-ch-text"><span class="info-value">${escapeHtml(chatTitle(ch))}</span><span class="info-label">${ch.type === 'channel' ? 'Channel' : 'Group'} · @${escapeHtml(ch.username)}</span></span>
        </button>`
        : `<button class="tile tile-add ripple-host" type="button" data-edit="channel"><span class="add-plus">${PICK_ICON.plus}</span><span class="tile-label">Add channel</span></button>`}
      ${music.length ? `<button class="tile profile-music ripple-host${busy('music')}" type="button" data-edit="music">
          <span class="pm-play" aria-hidden="true">${PICK_ICON.music}</span>
          <span class="pm-text"><span class="info-value">${escapeHtml(music[0].title || 'Track')}</span><span class="info-label">${music.length > 1 ? `${music.length} tracks` : escapeHtml(music[0].artist || 'Music')}</span></span>
        </button>`
        : `<button class="tile tile-add ripple-host${busy('music')}" type="button" data-edit="music"><span class="add-plus">${PICK_ICON.plus}</span><span class="tile-label">${d.busy === 'music' ? 'Uploading…' : 'Add music'}</span></button>`}
    </div>

    <section class="tiles" aria-label="Profile">
      ${arrangeTiles([
        editTile('name', PICK_ICON.user, 'Name', escapeHtml(d.name)),
        editTile('username', ICON.at, 'Username', d.username ? `@${escapeHtml(d.username)}` : '<span class="tile-muted">Not set</span>'),
        editTile('bio', ICON.quote, 'Bio', d.bio ? escapeHtml(d.bio) : '<span class="tile-muted">A few words about you</span>', true),
        editTile('look', ICON.palette, 'Avatar', d.avatar.photo ? 'Photo' : `Color${d.avatar.text ? ` · ${escapeHtml(d.avatar.text)}` : ''}`),
        editTile('email', MAIL_ICON, 'Email', escapeHtml(u.email ?? '')),
      ])}
    </section>`;
  hydrateMedia(editView);
  $('#edit-save').classList.toggle('is-dirty', dirty());
}

function openEdit() {
  const u = state.acc.user;
  draft = {
    name: u.name,
    username: u.username ?? '',
    bio: u.bio ?? '',
    avatar: { color: null, text: '', photo: null, ...u.avatar },
    channel: myPublicRooms().some((c) => c.id === u.profileChannel) ? u.profileChannel : '',
    music: tracksOf(u).map((t) => ({ ...t })),
    banner: u.banner ?? null,
  };
  saved = JSON.stringify(draft);
  paintEdit();
  openPanel('edit');
}

// плашки → экраны полей и листы
editView.addEventListener('click', async (e) => {
  const key = e.target.closest('[data-edit]')?.dataset.edit;
  if (!key || !draft) return;
  if (key === 'name') {
    const v = await openFieldScreen({
      title: 'Name', value: draft.name, max: 40, counter: true, placeholder: 'Your name',
      rules: `<p>This is how people see you in chats, groups and search.</p>
        <p><b>You can:</b> any letters, spaces, emoji — up to 40 characters.</p>
        <p><b>You can’t:</b> leave it empty.</p>`,
      check: (x) => (x.trim() ? { ok: true } : { ok: false, note: 'The name can’t be empty' }),
    });
    if (v != null) { draft.name = v; paintEdit(); }
  }
  if (key === 'username') {
    const me = state.acc.user;
    const v = await openFieldScreen({
      title: 'Username', value: draft.username, prefix: '@', max: 32, placeholder: 'username',
      clean: (x) => x.toLowerCase().replace(/[^a-z0-9]/g, ''),
      rules: `<p>People can find you by this name and write to you without knowing your email.</p>
        <p><b>You can:</b> English letters a–z and numbers 0–9, from 3 to 32 characters.</p>
        <p><b>You can’t:</b> spaces, dots, dashes or other symbols; only numbers without a letter; a name someone else already has.</p>
        <p>You can also leave it empty — then you can only be found by ID.</p>`,
      check: (x) => {
        if (!x) return { ok: true, note: me.username ? 'Your username will be removed' : '' , tone: '' };
        if (x === me.username) return { ok: true, note: 'This is your username', tone: '' };
        if (x.length < 3) return { ok: false, note: 'At least 3 characters', tone: 'bad' };
        if (!/[a-z]/.test(x)) return { ok: false, note: 'Add at least one letter', tone: 'bad' };
        if (!usernameOk(x)) return { ok: false, note: `@${x} is taken`, tone: 'bad' };
        // этот браузер знает не всех: занятость проверяет сервер
        const p = new Promise((r) => setTimeout(r, 350))
          .then(() => api('GET', `/api/username/${x}`))
          .then(({ free }) => (free ? { ok: true, note: `@${x} is available` } : { ok: false, note: `@${x} is taken`, tone: 'bad' }))
          .catch(() => ({ ok: true, note: 'Could not check now — will check when saving' }));
        p.pending = 'Checking…';
        return p;
      },
    });
    if (v != null) { draft.username = v; paintEdit(); }
  }
  if (key === 'bio') {
    const v = await openFieldScreen({
      title: 'Bio', value: draft.bio, max: 70, multiline: true, counter: true, placeholder: 'A few words about you',
      rules: `<p>Shown in your profile under your name.</p>
        <p><b>You can:</b> any text, emoji and links — up to 70 characters. Can be empty.</p>
        <p>You can hide it from others in Privacy.</p>`,
      check: () => ({ ok: true }),
    });
    if (v != null) { draft.bio = v; paintEdit(); }
  }
  if (key === 'email') { closePanelQuiet(); document.querySelector('[data-open-email]')?.click(); }
  if (key === 'avatar') pickAvatar();
  if (key === 'banner') pickBanner();
  if (key === 'channel') pickChannel();
  if (key === 'music') openMusicSheet();
  if (key === 'look') openLookSheet();
});

function closePanelQuiet() { saved = JSON.stringify(draft); $('#panel-edit [data-close-panel]').click(); }

/* ---------- Аватар: фото с обрезкой по кругу, видео до 15 с ---------- */
function pickAvatar() {
  if (!draft.avatar.photo) { $('#avatar-input').click(); return; }
  openModal('Profile photo', `
    <div class="pick-list">
      <button class="pick-opt" type="button" data-av="pick"><span class="pick-ic">${ICON.camera}</span><span class="pick-text"><b>Choose photo or video</b><small>From your gallery</small></span></button>
      <button class="pick-opt danger" type="button" data-av="remove"><span class="pick-ic">${PI.close}</span><span class="pick-text"><b>Remove photo</b><small>Use color and letters instead</small></span></button>
    </div>`, {
    cls: 'pick-sheet',
    onClick: (e) => {
      const a = e.target.closest('[data-av]')?.dataset.av;
      if (a === 'pick') { closeModal(); $('#avatar-input').click(); }
      if (a === 'remove') { draft.avatar.photo = null; draft.avatar.video = null; closeModal(); paintEdit(); }
    },
  });
}
$('#avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !draft) return;
  try {
    if (file.type.startsWith('video/')) {
      // видео-аватарка: до 15 секунд, кадр из неё — для маленьких аватарок
      if (file.size > 25 * 1024 * 1024) { toast('The video is too large (max 25 MB)'); return; }
      const { blob, duration } = await videoPoster(file);
      if (duration > 15.5) { toast('Video avatar can be up to 15 seconds'); return; }
      draft.busy = 'avatar'; paintEdit();
      draft.avatar.photo = await putBlob(blob);
      draft.avatar.video = await putBlob(file, { type: file.type });
    } else {
      const cut = await openCropper({ file, shape: 'circle', out: 640, title: 'Profile photo' });
      if (!cut) return;
      draft.busy = 'avatar'; paintEdit();
      draft.avatar.photo = await putBlob(await squareAvatar(cut));
      draft.avatar.video = null;
    }
  } catch {
    toast('Could not read this file');
  }
  draft.busy = null;
  paintEdit();
});

/* ---------- Баннер: фото с обрезкой рамкой или видео до 30 с ---------- */
function pickBanner() {
  const b = draft.banner;
  if (!b?.media) { $('#banner-input').click(); return; }
  openModal('Banner', `
    <div class="pick-list">
      <button class="pick-opt" type="button" data-bn="pick"><span class="pick-ic">${BANNER_IC}</span><span class="pick-text"><b>Choose photo or video</b><small>A photo or a video up to 30 seconds</small></span></button>
      <button class="pick-opt danger" type="button" data-bn="remove"><span class="pick-ic">${PI.close}</span><span class="pick-text"><b>Remove banner</b><small>Nothing at the top of your profile</small></span></button>
    </div>`, {
    cls: 'pick-sheet',
    onClick: (e) => {
      const a = e.target.closest('[data-bn]')?.dataset.bn;
      if (a === 'pick') { closeModal(); $('#banner-input').click(); }
      if (a === 'remove') { draft.banner = null; closeModal(); paintEdit(); }
    },
  });
}
$('#banner-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !draft) return;
  try {
    if (file.type.startsWith('video/')) {
      if (file.size > 40 * 1024 * 1024) { toast('The video is too large (max 40 MB)'); return; }
      const { blob, duration } = await videoPoster(file, 720);
      if (duration > 30.5) { toast('Banner video can be up to 30 seconds'); return; }
      draft.busy = 'banner'; paintEdit();
      const poster = await putBlob(blob);
      draft.banner = { media: await putBlob(file, { type: file.type }), type: 'video', poster };
    } else {
      const cut = await openCropper({ file, shape: 'banner', aspect: 16 / 9, out: 1600, title: 'Banner' });
      if (!cut) return;
      draft.busy = 'banner'; paintEdit();
      draft.banner = { media: await putBlob(cut), type: 'photo' };
    }
  } catch { toast('Could not read this file'); }
  draft.busy = null;
  paintEdit();
});

/* ---------- Канал или группа в профиле ---------- */
function pickChannel() {
  const rooms = myPublicRooms();
  const cur = draft.channel;
  const wrap = openModal('Channel in profile', `
    <div class="pick-list">
      <button class="pick-opt${cur ? '' : ' is-on'}" type="button" data-pick-room=""><span class="pick-ic">${PICK_ICON.channel}</span><span class="pick-text"><b>Don’t show</b><small>Nothing in your profile</small></span><span class="pick-check"></span></button>
      ${rooms.map((c) => `<button class="pick-opt${cur === c.id ? ' is-on' : ''}" type="button" data-pick-room="${c.id}">${chatAvatar(c, 'avatar-sm')}<span class="pick-text"><b>${escapeHtml(chatTitle(c))}</b><small>${c.type === 'channel' ? 'Channel' : 'Group'} · @${escapeHtml(c.username)} · ${c.members.length}</small></span><span class="pick-check"></span></button>`).join('')}
    </div>
    ${rooms.length ? '' : '<p class="pm-note">You have no public channels or groups yet. Create one and give it a @username — then you can show it here.</p>'}`, {
    cls: 'pick-sheet',
    onClick: (e) => {
      const b = e.target.closest('[data-pick-room]');
      if (!b) return;
      draft.channel = b.dataset.pickRoom;
      closeModal();
      paintEdit();
    },
  });
  hydrateMedia(wrap);
}

/* ---------- Музыка: список треков, убрать, добавить ещё (до 50) ---------- */
let musicSheet = null;
function musicSheetHtml() {
  const list = draft?.music ?? [];
  return `
    <div class="ms-head"><span class="ms-cover">${PICK_ICON.music}</span><span class="pick-text"><b>${list.length ? `${list.length} of 50 tracks` : 'No tracks yet'}</b><small>Everyone who opens your profile can play them</small></span></div>
    ${list.length ? `<div class="pick-list">${list.map((t, i) => `<div class="pick-opt ms-track"><span class="ms-n">${i + 1}</span><span class="pick-text"><b>${escapeHtml(t.title || 'Track')}</b><small>${escapeHtml(t.artist || '')}${t.dur ? ` · ${fmtDur(t.dur)}` : ''}</small></span><button class="ms-x" type="button" data-music-rm="${i}" aria-label="Remove">${PI.close}</button></div>`).join('')}</div>` : ''}
    ${list.length < 50 ? `<button class="btn btn-primary" type="button" data-music-pick>${draft?.busy === 'music' ? 'Uploading…' : 'Add tracks'}</button>` : ''}`;
}
function openMusicSheet() {
  if (!draft.music.length) { $('#music-input').click(); return; }
  musicSheet = openModal('Music in profile', musicSheetHtml(), {
    cls: 'pick-sheet',
    onClick: (e) => {
      if (e.target.closest('[data-music-pick]')) $('#music-input').click();
      const rm = e.target.closest('[data-music-rm]');
      if (rm) {
        draft.music.splice(Number(rm.dataset.musicRm), 1);
        paintEdit();
        musicSheet.querySelector('.pm-body').innerHTML = musicSheetHtml();
      }
    },
  });
}
$('#music-input').addEventListener('change', async (e) => {
  const files = [...(e.target.files ?? [])];
  e.target.value = '';
  if (!draft) return;
  const room = 50 - draft.music.length;
  if (files.length > room) toast('Up to 50 tracks');
  draft.busy = 'music';
  paintEdit();
  for (const file of files.slice(0, room)) {
    if (file.size > 15 * 1024 * 1024) { toast('The track is too large (max 15 MB)'); continue; }
    const name = file.name.replace(/\.[a-z0-9]+$/i, '');
    const [artist, title] = name.includes(' - ') ? name.split(' - ', 2) : ['', name];
    try {
      const dur = await mediaDuration(file).catch(() => 0);
      const media = await putBlob(file, { type: file.type || 'audio/mpeg' });
      draft.music.push({ media, title: title.trim().slice(0, 80), artist: artist.trim().slice(0, 60), dur: Math.round(dur || 0) });
    } catch (err) { toast(err.message || 'Upload failed'); }
  }
  draft.busy = null;
  paintEdit();
  if (musicSheet?.isConnected) musicSheet.querySelector('.pm-body').innerHTML = musicSheetHtml();
});

/* ---------- Цвет и буквы аватарки ---------- */
function openLookSheet() {
  const sheetHtml = () => {
    const prev = { name: draft.name, avatar: { ...draft.avatar, photo: null, video: null } };
    return `
      <div class="look-preview">${userAvatarHtml(prev, 'avatar-lg')}</div>
      ${draft.avatar.photo ? '<p class="pm-note">Color and letters are shown when there is no photo.</p>' : ''}
      <span class="group-label">Color</span>
      <div class="color-row" role="radiogroup" aria-label="Avatar color">
        <button class="color-chip color-auto" type="button" role="radio" data-color="null" aria-checked="${draft.avatar.color == null}" aria-label="Automatic color">Auto</button>
        ${AVATAR_COLORS.map(([a, b], i) => `<button class="color-chip" type="button" role="radio" data-color="${i}" style="--a1:${a};--a2:${b}" aria-checked="${String(draft.avatar.color) === String(i)}" aria-label="Color ${i + 1}"></button>`).join('')}
      </div>
      <span class="group-label">Letters</span>
      <div class="field glass"><input class="look-letters" type="text" maxlength="4" placeholder="${escapeHtml(initials(draft.name) || 'Auto')}" value="${escapeHtml(draft.avatar.text ?? '')}" aria-label="Avatar letters" autocomplete="off"></div>`;
  };
  const wrap = openModal('Avatar color and letters', sheetHtml(), {
    cls: 'pick-sheet look-sheet',
    onClick: (e) => {
      const chip = e.target.closest('.color-chip');
      if (!chip) return;
      draft.avatar.color = chip.dataset.color === 'null' ? null : Number(chip.dataset.color);
      wrap.querySelectorAll('.color-chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      wrap.querySelector('.look-preview').innerHTML = userAvatarHtml({ name: draft.name, avatar: { ...draft.avatar, photo: null, video: null } }, 'avatar-lg');
      paintEdit();
    },
  });
  wrap.querySelector('.look-letters').addEventListener('input', (e) => {
    draft.avatar.text = [...e.target.value.trim()].slice(0, 2).join('').toUpperCase();
    wrap.querySelector('.look-preview').innerHTML = userAvatarHtml({ name: draft.name, avatar: { ...draft.avatar, photo: null, video: null } }, 'avatar-lg');
    paintEdit();
  });
}

/* ---------- Сохранить: галочка справа от заголовка ---------- */
async function saveEdit() {
  if (!draft) return;
  if (draft.busy) { toast('Wait until the upload finishes'); return; }
  const { name, username } = draft;
  if (!name.trim()) { toast('The name can’t be empty'); return; }
  let free = true;
  if (username && username !== state.acc.user.username) {
    if (!usernameOk(username)) free = false;
    else { try { ({ free } = await api('GET', `/api/username/${username}`)); } catch { /* нет связи — проверит сервер */ } }
  }
  if (!free) { shake($('#edit-save')); toast('This username is taken'); return; }
  db.update(state.acc.user.id, (u) => {
    u.name = name.trim();
    u.username = username;
    u.bio = draft.bio.trim();
    u.avatar = draft.avatar;
    u.profileChannel = draft.channel || null;
    u.music = draft.music?.length ? draft.music : null;
    u.banner = draft.banner ?? null;
  });
  state.reload();
  renderProfile(true);
  document.dispatchEvent(new CustomEvent('kosmo:profile'));
  toast('Profile updated');
  closePanelQuiet();
}
$('#edit-save').addEventListener('click', saveEdit);

// «Назад» с несохранёнными правками — спросить
$('#panel-edit [data-close-panel]').addEventListener('click', (e) => {
  if (!dirty()) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  openModal('Save changes?', `
    <p class="pm-note">You changed your profile. Save it before leaving?</p>
    <button class="btn btn-primary" type="button" data-leave="save">Save</button>
    <button class="btn btn-secondary glass" type="button" data-leave="drop">Discard</button>`, {
    cls: 'pick-sheet',
    onClick: (ev) => {
      const a = ev.target.closest('[data-leave]')?.dataset.leave;
      if (!a) return;
      closeModal();
      if (a === 'save') saveEdit();
      else closePanelQuiet();
    },
  });
}, true);

/* ---------------------------------------------------------------------------
   Сессии: выгнать устройство, добавить в доверенные.
   Управлять могут только доверенные устройства; устройство, создавшее
   аккаунт, нельзя выгнать или лишить доверия.
   --------------------------------------------------------------------------- */
const canManage = () => state.acc.session.trusted;
const canControl = (s) => canManage() && s.id !== state.acc.session.id && !s.first;

async function terminate(sid, el) {
  const s = state.acc.user.sessions.find((x) => x.id === sid);
  if (!s || !canControl(s)) return;
  el?.closest('.sess-card')?.classList.add('is-removing');
  try {
    await Promise.all([api('DELETE', `/api/sessions/${sid}`), wait(260)]);
    toast(`${s.name} — session terminated`);
  } catch (err) {
    el?.closest('.sess-card')?.classList.remove('is-removing');
    toast(err.message);
  }
}

function toggleTrust(sid) {
  const s = state.acc.user.sessions.find((x) => x.id === sid);
  if (!s || !canControl(s)) return;
  api('POST', `/api/sessions/${sid}/trust`, { trusted: !s.trusted })
    .then(() => toast(s.trusted ? `${s.name} is no longer trusted` : `${s.name} is now trusted`), (err) => toast(err.message));
}

function terminateOthers() {
  const ids = state.acc.user.sessions.filter(canControl).map((s) => s.id);
  if (!ids.length) return;
  $$('.sess-card[data-sid]').forEach((c) => { if (ids.includes(c.dataset.sid)) c.classList.add('is-removing'); });
  Promise.all(ids.map((id) => api('DELETE', `/api/sessions/${id}`)))
    .then(() => toast(ids.length === 1 ? 'Session terminated' : `${ids.length} sessions terminated`), (err) => toast(err.message));
}

function sessionCard(s) {
  const mine = s.id === state.acc.session.id;
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

export function renderSessions() {
  const { user, session } = state.acc;
  const others = user.sessions.filter((s) => s.id !== session.id).sort((a, b) => b.lastActive - a.lastActive);
  const removable = others.filter(canControl).length;
  $('#sessions').innerHTML = `
    <p class="section-label">This device</p>
    ${sessionCard(session)}
    ${canManage() ? '' : `<div class="note">${ICON.info}<span>This device isn't trusted yet. A trusted device can trust it or terminate it.</span></div>`}
    <p class="section-label">Other sessions${others.length ? ` · ${others.length}` : ''}</p>
    ${others.length ? others.map(sessionCard).join('') : `<div class="note">${ICON.devices}<span>No other active sessions. Each new sign-in will appear here and in the Kosmo chat.</span></div>`}
    ${removable ? '<button class="btn btn-danger" type="button" id="terminate-all">Terminate all other sessions</button>' : ''}
    <button class="btn btn-secondary glass" type="button" data-link-device>${ICON.devices}Link a device</button>`;
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-terminate]');
  if (t) terminate(t.dataset.terminate, t);
  const tr = e.target.closest('[data-trust]');
  if (tr) toggleTrust(tr.dataset.trust);
  if (e.target.closest('#terminate-all')) terminateOthers();
});

/* ---------------------------------------------------------------------------
   Смена почты: код на старую почту → новая почта → код на новую
   --------------------------------------------------------------------------- */
const steps = $('#email-steps');
const cpInput = $('#cp-email-input');
const cpField = $('#cp-email-field');
const cpSubmit = $('#cp-new-submit');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let cpNewEmail = null;

function setStep(name, animate = true) {
  $$('.step', steps).forEach((s) => {
    const on = s.dataset.step === name;
    s.hidden = !on;
    s.classList.toggle('step-in', on && animate);
  });
  refreshRefraction();
}

function openEmailChange() {
  $('#cp-current').textContent = state.acc.user.email;
  setStep('intro', false);
  openPanel('email');
}

let cpTicket = null;
const oldOtp = createOtp($('#cp-old-otp'), {
  verify: async (code) => {
    try { cpTicket = (await api('POST', '/api/email/verify', { step: 'old', code })).ticket; return true; } catch (err) { toast(err.message); return false; }
  },
  onComplete: () => {
    setStep('new-email');
    cpInput.value = '';
    setTimeout(() => cpInput.focus(), 350);
  },
});

const newOtp = createOtp($('#cp-new-otp'), {
  verify: async (code) => {
    try { await api('POST', '/api/email/verify', { step: 'new', email: cpNewEmail, code, ticket: cpTicket }); return true; } catch (err) { toast(err.message); return false; }
  },
  onComplete: () => {
    $('#cp-done').textContent = cpNewEmail;
    setStep('done');
    document.dispatchEvent(new CustomEvent('kosmo:changed'));
  },
});

$('#cp-start').addEventListener('click', async () => {
  try {
    await api('POST', '/api/email/code', { step: 'old' });
  } catch (err) { toast(err.message); return; }
  $('#cp-old').textContent = state.acc.user.email;
  oldOtp.reset();
  setStep('old-code');
  setTimeout(oldOtp.focus, 350);
});

cpInput.addEventListener('input', () => cpField.classList.remove('is-error'));
$('#cp-new-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (cpSubmit.classList.contains('is-loading')) return;
  const email = cpInput.value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { shake(cpField); cpField.classList.add('is-error'); return; }
  if (email === state.acc.user.email) { shake(cpField); toast('This is already your email'); return; }
  cpNewEmail = email;
  cpSubmit.style.width = `${cpSubmit.offsetWidth}px`;
  requestAnimationFrame(() => cpSubmit.classList.add('is-loading'));
  const stop = () => { cpSubmit.classList.remove('is-loading'); cpSubmit.style.removeProperty('width'); };
  api('POST', '/api/email/code', { step: 'new', email, ticket: cpTicket })
    .then(() => {
      stop();
      $('#cp-new').textContent = email;
      newOtp.reset();
      setStep('new-code');
      setTimeout(newOtp.focus, 350);
    })
    .catch((err) => { stop(); shake(cpField); toast(err.message); });
});

export const resetProfileCache = () => { sig = ''; };

// канал/группа из профиля
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open-profile-channel]');
  if (!b) return;
  if (overlayOpen()) closeOverlay();
  openChat(b.dataset.openProfileChannel);
});

