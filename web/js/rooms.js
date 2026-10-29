// Группы и каналы: создание (аватар, название, @username, описание, участники),
// информация (участники, админы, настройки, обсуждение), комментарии к постам.
// Комментарии хранятся в привязанной группе как сообщения с threadOf.

import {
  $, db, toast, shake, escapeHtml, userAvatarHtml, cosmicBadge, formatTime, formatDate, refreshRefraction,
} from './core.js';
import { state, openPanel, closePanel, openOverlay, closeOverlay, overlayOpen } from './panels.js';
import { putBlob, hydrateMedia, squareAvatar } from './media.js';
import {
  chats, isRoom, roleOf, isAdmin, publicUser, roomAvatar, displayName, mediaBody, ICON, openChat, openChatId,
  renderChatList, renderMessages, leaveRoom, previewText,
} from './chats.js';
import { USERNAME_RE, RESERVED } from './profile.js';
import { showUser } from './people.js';

const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  ...ICON,
  at: svg('<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/>'),
  quote: svg('<path d="M5 6.5h14M5 11h14M5 15.5h9"/>'),
  camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  crown: svg('<path d="M4 17.5L3 8l5 3.5L12 5l4 6.5L21 8l-1 9.5z"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>'),
  chevron: svg('<path d="M9.5 6l6 6-6 6"/>', 'i chev-right'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
};
const label = (type) => (type === 'channel' ? 'channel' : 'group');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// @username занят пользователем или другой группой/каналом
export function handleTaken(name, exceptId) {
  if (db.usernameTaken(name)) return true;
  return Object.values(chats.all()).some((c) => isRoom(c) && c.username === name && c.id !== exceptId);
}
function handleError(v, exceptId) {
  if (!v) return '';
  if (v.length < 3) return 'At least 3 characters';
  if (!USERNAME_RE.test(v)) return 'Add at least one letter';
  if (RESERVED.includes(v) || handleTaken(v, exceptId)) return 'This username is taken';
  return '';
}

// Добавить можно только тех, с кем уже есть личная переписка
// (и кто не запретил добавлять себя); им придёт сообщение-приглашение
function addable(c) {
  const me = state.acc.user.id;
  return Object.values(db.all()).filter((u) => u.id !== me && !c?.members.includes(u.id)
    && !u.privacy?.blocked?.includes(me) && (chats.get(chats.idFor(me, u.id))?.messages.length ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sendInvites(roomIdX, userIds) {
  const me = state.acc.user.id;
  userIds.forEach((u) => chats.send(chats.idFor(me, u), [me, u], { from: me, kind: 'invite', room: roomIdX, to: u }));
}
const canBeAdded = (u) => u.privacy?.groups !== 'nobody';

/* ---------------------------------------------------------------------------
   Создание группы / канала: шаг 1 — профиль, шаг 2 — участники
   --------------------------------------------------------------------------- */
let draft = null;

export function openCreate(type) {
  draft = { type, name: '', username: '', bio: '', avatar: { color: null, text: '', photo: null }, members: [] };
  $('#create-title').textContent = type === 'channel' ? 'New channel' : 'New group';
  $('#panel-create').setAttribute('aria-label', $('#create-title').textContent);
  renderInfoStep();
  openPanel('create');
  setTimeout(() => $('#room-name')?.focus({ preventScroll: true }), 380);
}

function avatarEditor(av, name) {
  return `
    <button class="room-avatar-pick" type="button" data-room-photo aria-label="Choose photo">
      ${userAvatarHtml({ name: name || '?', avatar: av }, 'avatar-edit avatar-room')}
      <span class="hero-edit" aria-hidden="true">${I.camera}</span>
    </button>`;
}

function infoFields(d, exceptId) {
  return `
    <div class="room-avatar-wrap" id="room-avatar">${avatarEditor(d.avatar, d.name)}</div>
    ${d.avatar.photo ? '<button class="link-btn" type="button" data-room-photo-remove>Remove photo</button>' : ''}
    <div class="field glass" data-refract="0.5" id="room-name-field">
      <input id="room-name" type="text" maxlength="64" placeholder="${d.type === 'channel' ? 'Channel name' : 'Group name'}" aria-label="Name" value="${escapeHtml(d.name)}" autocomplete="off">
    </div>
    <div class="field field-username glass" data-refract="0.5" id="room-username-field">
      <span class="at" aria-hidden="true">@</span>
      <input id="room-username" type="text" autocapitalize="none" spellcheck="false" maxlength="32" placeholder="username (public link, optional)" aria-label="Username" value="${escapeHtml(d.username)}">
    </div>
    <p class="field-hint" id="room-username-hint">${d.username ? escapeHtml(handleError(d.username, exceptId) || `kosmo.app/${d.username}`) : 'With a username anyone can find it in Search.'}</p>
    <div class="field field-area glass" data-refract="0.5">
      <textarea id="room-bio" rows="3" maxlength="255" placeholder="Description (optional)" aria-label="Description">${escapeHtml(d.bio)}</textarea>
    </div>`;
}

function renderInfoStep() {
  $('#create-body').innerHTML = `
    <form class="setup-form room-form step-in" id="create-info" novalidate>
      ${infoFields(draft)}
      <button class="btn btn-primary" type="submit">Next</button>
    </form>`;
  hydrateMedia($('#create-body'));
  refreshRefraction();
}

function readFields(d, exceptId) {
  d.name = $('#room-name').value.trim();
  d.username = $('#room-username').value;
  d.bio = $('#room-bio').value.trim();
  if (!d.name) { shake($('#room-name-field')); $('#room-name').focus(); return false; }
  const err = handleError(d.username, exceptId);
  if (err) { shake($('#room-username-field')); toast(err); return false; }
  return true;
}

function memberPicker(c, picked, query = '') {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  const people = addable(c).filter((u) => !q || u.name.toLowerCase().includes(q) || u.username?.includes(q) || u.publicId === q);
  return people.length ? people.map((u) => {
    const p = publicUser(u);
    const ok = canBeAdded(u);
    return `
      <li class="chat pick-row${ok ? '' : ' is-disabled'}" data-pick="${u.id}" role="checkbox" aria-checked="${picked.includes(u.id)}" tabindex="0">
        ${userAvatarHtml(p)}
        <div class="chat-top"><span class="chat-name">${displayName(p)}</span></div>
        <div class="chat-meta"><span class="pick-check">${I.check}</span></div>
        <div class="chat-bottom"><span class="chat-text">${ok ? (u.username ? `@${escapeHtml(u.username)}` : `ID ${escapeHtml(u.publicId)}`) : 'Doesn\'t allow adding to groups'}</span></div>
      </li>`;
  }).join('') : `<li class="list-empty"><span>${query ? 'No people found' : 'You can add people you already chat with. Start a chat first, then add them here.'}</span></li>`;
}

function renderMembersStep() {
  const ch = draft.type === 'channel';
  $('#create-body').innerHTML = `
    <div class="room-step step-in">
      <p class="section-label">${ch ? 'Add subscribers' : 'Add members'}${draft.members.length ? ` · ${draft.members.length}` : ''}</p>
      <div class="search-field glass" data-refract="0.5">${I.search}<input type="search" id="pick-search" placeholder="Search people" aria-label="Search people"></div>
      <ul class="chat-list pick-list" id="pick-list">${memberPicker(null, draft.members)}</ul>
      <button class="btn btn-primary room-create-btn" type="button" id="create-room">${ch ? 'Create channel' : 'Create group'}</button>
    </div>`;
  hydrateMedia($('#create-body'));
  refreshRefraction();
}

function createRoom() {
  const me = state.acc.user.id;
  const c = chats.save({
    id: `${draft.type}_${crypto.randomUUID?.() ?? Date.now()}`,
    type: draft.type,
    name: draft.name,
    username: draft.username,
    bio: draft.bio,
    avatar: draft.avatar,
    owner: me,
    admins: [],
    members: [me, ...draft.members],
    messages: [],
    read: { [me]: Date.now() },
    createdAt: Date.now(),
    settings: draft.type === 'channel' ? { signatures: false, reactions: true } : { invite: true, media: true },
  });
  sendInvites(c.id, c.members.filter((x) => x !== me));
  draft = null;
  closePanel({ instant: true });
  renderChatList();
  openChat(c.id);
  toast(c.type === 'channel' ? 'Channel created' : 'Group created');
}

$('#panel-create').addEventListener('submit', (e) => {
  if (e.target.id !== 'create-info') return;
  e.preventDefault();
  if (!readFields(draft)) return;
  renderMembersStep();
});

/* ---------- Общие обработчики: фото, @username, выбор людей ---------- */
let photoTarget = null;   // draft создания или черновик правки

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-room-photo]')) {
    photoTarget = draft ?? edit;
    $('#room-avatar-input').click();
  }
  if (e.target.closest('[data-room-photo-remove]')) {
    const d = draft ?? edit;
    if (!d) return;
    d.avatar.photo = null;
    repaintAvatar(d);
    e.target.closest('[data-room-photo-remove]').remove();
  }
  const pick = e.target.closest('[data-pick]');
  if (pick) togglePick(pick);
  if (e.target.closest('#create-room')) createRoom();
});
document.addEventListener('keydown', (e) => {
  const pick = e.target.closest?.('[data-pick]');
  if (pick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); togglePick(pick); }
});

function togglePick(row) {
  if (row.classList.contains('is-disabled')) { toast('This person doesn\'t allow adding to groups'); return; }
  const list = draft ? draft.members : picking;
  const id = row.dataset.pick;
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  row.setAttribute('aria-checked', String(i < 0));
  const lbl = row.closest('.room-step, .room-add')?.querySelector('.section-label');
  if (lbl) lbl.textContent = lbl.textContent.replace(/ · \d+$/, '') + (list.length ? ` · ${list.length}` : '');
  const addBtn = $('#add-members-go');
  if (addBtn) addBtn.disabled = !list.length;
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'room-username') {
    const el = e.target;
    const clean = el.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean !== el.value) el.value = clean;
    const err = handleError(clean, edit?.id);
    $('#room-username-field').classList.toggle('is-invalid', Boolean(err) && clean.length >= 3);
    $('#room-username-hint').textContent = clean ? (err || `kosmo.app/${clean}`) : 'With a username anyone can find it in Search.';
  }
  if (e.target.id === 'room-name') repaintAvatar(draft ?? edit, e.target.value);
  if (e.target.id === 'pick-search') {
    const c = draft ? null : chats.get(roomId);
    $('#pick-list').innerHTML = memberPicker(c, draft ? draft.members : picking, e.target.value);
    hydrateMedia($('#pick-list'));
  }
});

function repaintAvatar(d, name = $('#room-name')?.value) {
  if (!d || !$('#room-avatar')) return;
  $('#room-avatar').innerHTML = avatarEditor(d.avatar, name ?? d.name);
  hydrateMedia($('#room-avatar'));
}

$('#room-avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !photoTarget) return;
  try {
    photoTarget.avatar.photo = await putBlob(await squareAvatar(file));
    repaintAvatar(photoTarget);
  } catch {
    toast('Could not read this photo');
  }
});

/* ---------------------------------------------------------------------------
   Информация о группе / канале (поверх чата)
   --------------------------------------------------------------------------- */
let roomId = null;
let mode = 'info';     // info | edit | add | link
let edit = null;
let picking = [];

export function showRoom(id, nextMode = 'info') {
  const c = chats.get(id);
  if (!c) { toast('This chat no longer exists'); return; }
  roomId = id;
  mode = nextMode;
  edit = null;
  renderRoom();
  if (overlayOpen() !== 'room') openOverlay('room');
}
document.addEventListener('kosmo:open-room', (e) => showRoom(e.detail));

const tileHtml = (icon, lbl, value, attrs = '', wide = false) => `
  <${attrs ? 'button' : 'div'} class="tile${wide ? ' tile-wide' : ''}" ${attrs}${attrs ? ' type="button"' : ''}>
    <span class="tile-icon">${icon}</span><span class="tile-label">${lbl}</span><span class="tile-value">${value}</span>
  </${attrs ? 'button' : 'div'}>`;

const rowBtn = (attrs, icon, text, extra = '', cls = '') => `
  <button class="group-row group-row-btn ripple-host ${cls}" type="button" ${attrs}>
    <span class="row-icon">${icon}</span><span class="row-text">${text}</span>${extra}
  </button>`;

function memberRow(c, u) {
  const me = state.acc.user.id;
  const role = roleOf(c, u.id);
  const myRole = roleOf(c, me);
  const p = publicUser(u);
  const chip = role === 'owner' ? `<span class="role-chip is-owner">${I.crown}Owner</span>` : role === 'admin' ? '<span class="role-chip">Admin</span>' : '';
  const actions = [];
  if (u.id !== me && myRole === 'owner' && role !== 'owner') {
    actions.push(role === 'admin'
      ? `<button class="chip-btn" type="button" data-dismiss-admin="${u.id}">Dismiss admin</button>`
      : `<button class="chip-btn" type="button" data-make-admin="${u.id}">Make admin</button>`);
  }
  if (u.id !== me && (myRole === 'owner' || (myRole === 'admin' && role === 'member'))) {
    actions.push(`<button class="chip-btn danger" type="button" data-kick="${u.id}">Remove</button>`);
  }
  return `
    <li class="member">
      <button class="member-main" type="button" data-member="${u.id}">
        ${userAvatarHtml(p)}
        <span class="member-text"><span class="member-name">${displayName(p)}${u.id === me ? ' <span class="tile-muted">(you)</span>' : ''}</span>
        <span class="member-sub">${u.username ? `@${escapeHtml(u.username)}` : `ID ${escapeHtml(u.publicId)}`}</span></span>
        ${chip}
      </button>
      ${actions.length ? `<div class="member-actions">${actions.join('')}</div>` : ''}
    </li>`;
}

function renderRoom() {
  const c = chats.get(roomId);
  if (!c) { closeOverlay(); return; }
  const me = state.acc.user.id;
  const admin = isAdmin(c, me);
  const owner = c.owner === me;
  const member = Boolean(roleOf(c, me));
  const ch = c.type === 'channel';
  $('#room-title').textContent = mode === 'edit' ? 'Edit' : mode === 'add' ? (ch ? 'Add subscribers' : 'Add members') : mode === 'link' ? 'Discussion' : ch ? 'Channel' : 'Group';
  const body = $('#room-body');

  if (mode === 'edit') {
    edit ??= { id: c.id, type: c.type, name: c.name, username: c.username ?? '', bio: c.bio ?? '', avatar: { color: null, text: '', photo: null, ...c.avatar } };
    const s = c.settings ?? {};
    body.innerHTML = `
      <form class="setup-form room-form step-in" id="room-edit" novalidate>
        ${infoFields(edit, c.id)}
        <section class="group group-pad">
          <span class="group-label">Settings</span>
          ${ch ? `
            <label class="switch-row"><span>Sign posts with author name</span><input type="checkbox" class="switch" id="rs-signatures" role="switch" ${s.signatures ? 'checked' : ''}></label>
            <label class="switch-row"><span>Allow reactions</span><input type="checkbox" class="switch" id="rs-reactions" role="switch" ${s.reactions !== false ? 'checked' : ''}></label>` : `
            <label class="switch-row"><span>Members can add people</span><input type="checkbox" class="switch" id="rs-invite" role="switch" ${s.invite !== false ? 'checked' : ''}></label>
            <label class="switch-row"><span>Members can send media</span><input type="checkbox" class="switch" id="rs-media" role="switch" ${s.media !== false ? 'checked' : ''}></label>`}
        </section>
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn btn-secondary glass" type="button" data-room-mode="info">Cancel</button>
      </form>`;
    hydrateMedia(body);
    refreshRefraction();
    return;
  }

  if (mode === 'add') {
    body.innerHTML = `
      <div class="room-add step-in">
        <p class="section-label">Choose people</p>
        <div class="search-field glass" data-refract="0.5">${I.search}<input type="search" id="pick-search" placeholder="Search people" aria-label="Search people"></div>
        <ul class="chat-list pick-list" id="pick-list">${memberPicker(c, picking)}</ul>
        <button class="btn btn-primary" type="button" id="add-members-go" disabled>Add</button>
        <button class="btn btn-secondary glass" type="button" data-room-mode="info">Cancel</button>
      </div>`;
    hydrateMedia(body);
    refreshRefraction();
    return;
  }

  if (mode === 'link') {
    const groups = chats.forUser(me).filter((g) => g.type === 'group' && isAdmin(g, me) && (!g.linkedChannel || g.linkedChannel === c.id));
    body.innerHTML = `
      <div class="room-add step-in">
        <div class="note">${I.comment}<span>Posts of the channel get a comments button. Comments are kept in the discussion group.</span></div>
        <p class="section-label">Your groups</p>
        <ul class="chat-list">${groups.map((g) => `
          <li class="chat ripple-host" data-link-group="${g.id}" tabindex="0" role="button" aria-checked="${c.linked === g.id}">
            ${roomAvatar(g)}
            <div class="chat-top"><span class="chat-name">${escapeHtml(g.name)}</span></div>
            <div class="chat-meta">${c.linked === g.id ? `<span class="pick-check is-on">${I.check}</span>` : ''}</div>
            <div class="chat-bottom"><span class="chat-text">${plural(g.members.length, 'member')}</span></div>
          </li>`).join('') || '<li class="list-empty"><span>You have no groups yet</span></li>'}</ul>
        <button class="btn btn-primary" type="button" data-link-new>Create a new discussion group</button>
        ${c.linked ? '<button class="btn btn-danger" type="button" data-unlink>Unlink group</button>' : ''}
      </div>`;
    hydrateMedia(body);
    refreshRefraction();
    return;
  }

  const linked = c.linked && chats.get(c.linked);
  const linkedCh = c.linkedChannel && chats.get(c.linkedChannel);
  const members = c.members.map((id) => db.get(id)).filter(Boolean)
    .sort((a, b) => ({ owner: 0, admin: 1, member: 2 }[roleOf(c, a.id)] - { owner: 0, admin: 1, member: 2 }[roleOf(c, b.id)]));
  const canInvite = admin || (!ch && c.settings?.invite !== false && member);
  const showMembers = !ch || admin;
  body.innerHTML = `
    <section class="profile-hero">
      <div class="hero-avatar"><span class="hero-orbit" aria-hidden="true"></span>${roomAvatar(c, 'avatar-hero')}</div>
      <h2 class="profile-name"><span>${escapeHtml(c.name)}</span></h2>
      <p class="hero-sub">${ch ? 'Channel' : 'Group'} · ${plural(c.members.length, ch ? 'subscriber' : 'member')}</p>
      <div class="hero-actions">
        ${member ? `<button class="pill-btn" type="button" data-room-open>${I.comment}${ch ? 'Open' : 'Message'}</button>` : `<button class="pill-btn" type="button" data-room-join>${I.plus}Join</button>`}
        ${admin ? `<button class="pill-btn" type="button" data-room-mode="edit">${I.edit}Edit</button>` : ''}
      </div>
    </section>
    <section class="tiles" aria-label="Info">
      ${c.username ? tileHtml(I.at, 'Link', `@${escapeHtml(c.username)}`, 'data-copy-room') : tileHtml(I.at, 'Type', 'Private')}
      ${tileHtml(I.calendar, 'Created', formatDate(c.createdAt ?? Date.now()).split(',')[0])}
      ${c.bio ? tileHtml(I.quote, 'Description', escapeHtml(c.bio), '', true) : ''}
      ${ch && (linked || admin) ? tileHtml(I.comment, 'Discussion', linked ? escapeHtml(linked.name) : '<span class="tile-muted">Not linked</span>', admin ? 'data-room-mode="link"' : 'data-open-linked', true) : ''}
      ${linkedCh ? tileHtml(I.channel, 'Linked channel', escapeHtml(linkedCh.name), 'data-open-linked-channel', true) : ''}
    </section>
    ${showMembers ? `
      <p class="section-label">${ch ? 'Subscribers' : 'Members'} · ${members.length}</p>
      <section class="group">
        ${canInvite ? rowBtn('data-room-mode="add"', I.plus, ch ? 'Add subscribers' : 'Add members') : ''}
        <ul class="members">${members.map((u) => memberRow(c, u)).join('')}</ul>
      </section>` : ''}
    <section class="group">
      ${member ? rowBtn('data-room-leave', I.leave, ch ? 'Leave channel' : 'Leave group', '', 'danger') : ''}
      ${owner ? rowBtn('data-room-delete', I.trash, ch ? 'Delete channel' : 'Delete group', '', 'danger') : ''}
    </section>`;
  hydrateMedia(body);
  refreshRefraction();
}

export function refreshRoom() {
  if (overlayOpen() === 'room' && mode === 'info') renderRoom();
  if (overlayOpen() === 'thread') renderThread();
}

function mutate(fn) {
  chats.update(roomId, fn);
  renderRoom();
  renderChatList();
  if (openChatId() === roomId) renderMessages();
}

$('#room-body').addEventListener('submit', (e) => {
  if (e.target.id !== 'room-edit') return;
  e.preventDefault();
  if (!readFields(edit, roomId)) return;
  const ch = edit.type === 'channel';
  const settings = ch
    ? { signatures: $('#rs-signatures').checked, reactions: $('#rs-reactions').checked }
    : { invite: $('#rs-invite').checked, media: $('#rs-media').checked };
  const d = edit;
  mode = 'info';
  edit = null;
  mutate((c) => Object.assign(c, { name: d.name, username: d.username, bio: d.bio, avatar: d.avatar, settings }));
  document.dispatchEvent(new CustomEvent('kosmo:room-changed'));
  toast('Saved');
});

$('#room-body').addEventListener('click', (e) => {
  const me = state.acc.user.id;
  const t = e.target;
  const m = t.closest('[data-room-mode]');
  if (m) {
    mode = m.dataset.roomMode;
    edit = null;
    picking = [];
    renderRoom();
    $('#panel-room').scrollTop = 0;
    return;
  }
  if (t.closest('[data-room-open]')) {
    closeOverlay();
    if (openChatId() !== roomId) { closePanel({ instant: true }); openChat(roomId); }
  }
  if (t.closest('[data-room-join]')) {
    mutate((c) => { if (!c.members.includes(me)) c.members.push(me); });
    if (openChatId() === roomId) openChat(roomId);
    toast('You joined');
  }
  if (t.closest('[data-copy-room]')) {
    const c = chats.get(roomId);
    navigator.clipboard?.writeText(`@${c.username}`).then(() => toast('Link copied'), () => toast(`@${c.username}`));
  }
  const member = t.closest('[data-member]');
  if (member && member.dataset.member !== me) { closeOverlay(); showUser(member.dataset.member); }
  const make = t.closest('[data-make-admin]');
  if (make) { mutate((c) => { c.admins = [...new Set([...(c.admins ?? []), make.dataset.makeAdmin])]; }); toast('Now an admin'); }
  const dismiss = t.closest('[data-dismiss-admin]');
  if (dismiss) { mutate((c) => { c.admins = (c.admins ?? []).filter((x) => x !== dismiss.dataset.dismissAdmin); }); toast('Admin rights removed'); }
  const kick = t.closest('[data-kick]');
  if (kick) {
    kick.closest('.member').classList.add('is-removing');
    setTimeout(() => mutate((c) => {
      c.members = c.members.filter((x) => x !== kick.dataset.kick);
      c.admins = (c.admins ?? []).filter((x) => x !== kick.dataset.kick);
    }), 240);
  }
  if (t.closest('#add-members-go') && picking.length) {
    const n = picking.length;
    const add = picking.filter((id) => canBeAdded(db.get(id) ?? {}));
    mode = 'info';
    picking = [];
    mutate((c) => { c.members = [...new Set([...c.members, ...add])]; });
    sendInvites(roomId, add);
    toast(n === 1 ? 'Added' : `${n} people added`);
  }
  const lg = t.closest('[data-link-group]');
  if (lg) link(lg.dataset.linkGroup);
  if (t.closest('[data-link-new]')) {
    const c = chats.get(roomId);
    const g = chats.save({
      id: `group_${crypto.randomUUID?.() ?? Date.now()}`,
      type: 'group', name: `${c.name} Chat`, username: '', bio: `Discussion of ${c.name}`,
      avatar: { ...c.avatar }, owner: me, admins: [...(c.admins ?? [])].filter((x) => x !== me),
      members: [...c.members], messages: [], read: { [me]: Date.now() }, createdAt: Date.now(),
      settings: { invite: true, media: true },
    });
    link(g.id);
  }
  if (t.closest('[data-unlink]')) {
    const c = chats.get(roomId);
    if (c.linked) chats.update(c.linked, (g) => { delete g.linkedChannel; });
    mode = 'info';
    mutate((x) => { delete x.linked; });
    toast('Group unlinked');
  }
  if (t.closest('[data-open-linked]')) {
    const c = chats.get(roomId);
    if (c.linked) showRoom(c.linked);
  }
  if (t.closest('[data-open-linked-channel]')) {
    const c = chats.get(roomId);
    if (c.linkedChannel) showRoom(c.linkedChannel);
  }
  if (t.closest('[data-room-leave]')) {
    const c = chats.get(roomId);
    closeOverlay();
    leaveRoom(roomId);
    toast(`You left the ${label(c.type)}`);
    renderChatList();
  }
  const del = t.closest('[data-room-delete]');
  if (del) {
    if (!del.classList.contains('is-confirm')) {
      del.classList.add('is-confirm');
      del.querySelector('.row-text').textContent = 'Tap again to delete for everyone';
      return;
    }
    const c = chats.get(roomId);
    closeOverlay();
    leaveRoom(roomId, true);
    toast(`${c.type === 'channel' ? 'Channel' : 'Group'} deleted`);
    renderChatList();
  }
});

function link(groupId) {
  const c = chats.get(roomId);
  if (c.linked && c.linked !== groupId) chats.update(c.linked, (g) => { delete g.linkedChannel; });
  chats.update(groupId, (g) => { g.linkedChannel = roomId; });
  mode = 'info';
  mutate((x) => { x.linked = groupId; });
  toast('Discussion group linked');
}

/* ---------------------------------------------------------------------------
   Комментарии к посту канала
   --------------------------------------------------------------------------- */
let thread = null;   // { channel, post }

function renderThread() {
  if (!thread) return;
  const c = chats.get(thread.channel);
  const post = c?.messages.find((m) => m.id === thread.post);
  const g = c?.linked && chats.get(c.linked);
  if (!post || !g) { closeOverlay(); toast('Comments are unavailable'); return; }
  const me = state.acc.user.id;
  const comments = g.messages.filter((m) => m.threadOf?.post === post.id && !m.hiddenFor?.includes(me));
  $('#thread-title').textContent = comments.length ? plural(comments.length, 'comment') : 'Comments';
  $('#thread-body').innerHTML = `
    <article class="thread-post">
      <header class="thread-head">${roomAvatar(c, 'avatar-xs')}<b>${escapeHtml(c.name)}</b><span>${formatTime(post.at)}</span></header>
      <div class="bubble theirs-like kind-${post.kind ?? 'text'}">${mediaBody(post)}${post.caption ? `<p class="b-text b-caption">${escapeHtml(post.caption)}</p>` : ''}</div>
    </article>
    <p class="section-label">${comments.length ? 'Comments' : 'No comments yet — be the first'}</p>
    <ul class="comments">${comments.map((m) => commentRow(m, g)).join('')}</ul>`;
  hydrateMedia($('#thread-body'));
}

export function commentRow(m, g, scope = 'comment') {
  const me = state.acc.user.id;
  const u = publicUser(db.get(m.from)) ?? { name: 'Deleted account', avatar: {} };
  const canDel = m.from === me || (g && isAdmin(g, me));
  return `
    <li class="comment" data-${scope}="${m.id}">
      <button class="comment-avatar" type="button" data-member-open="${m.from}">${userAvatarHtml(u, 'avatar-xs')}</button>
      <div class="comment-body">
        <span class="comment-name">${escapeHtml(u.name)}${u.role === 'owner' ? cosmicBadge('owner') : ''}<time>${formatTime(m.at)}</time></span>
        <p class="comment-text">${escapeHtml(m.text).replace(/\n/g, '<br>')}</p>
      </div>
      ${canDel ? `<button class="comment-del" type="button" data-del-${scope}="${m.id}" aria-label="Delete comment">${I.trash}</button>` : ''}
    </li>`;
}

export function openThread({ channel, post }) {
  thread = { channel, post };
  renderThread();
  $('#thread-input').value = '';
  openOverlay('thread');
  requestAnimationFrame(() => { $('#panel-thread').scrollTop = $('#panel-thread').scrollHeight; });
}
document.addEventListener('kosmo:open-thread', (e) => openThread(e.detail));

$('#thread-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#thread-input').value.trim();
  if (!text || !thread) return;
  const me = state.acc.user.id;
  const c = chats.get(thread.channel);
  const g = c?.linked && chats.get(c.linked);
  if (!g) return;
  // писать комментарии могут подписчики канала — они автоматически в обсуждении
  if (!g.members.includes(me)) chats.update(g.id, (x) => { x.members.push(me); });
  chats.send(g.id, g.members, { from: me, kind: 'text', text, threadOf: { channel: c.id, post: thread.post } });
  $('#thread-input').value = '';
  $('#thread-input').style.height = '';
  renderThread();
  if (openChatId() === thread.channel) renderMessages();
  $('#panel-thread').scrollTo({ top: $('#panel-thread').scrollHeight, behavior: 'smooth' });
});
$('#thread-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#thread-form').requestSubmit(); }
});
$('#thread-input').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; });

$('#thread-body').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-comment]');
  if (del) {
    const c = chats.get(thread.channel);
    chats.update(c.linked, (g) => { g.messages = g.messages.filter((m) => m.id !== del.dataset.delComment); });
    del.closest('.comment').classList.add('is-removing');
    setTimeout(() => { renderThread(); if (openChatId() === thread.channel) renderMessages(); }, 220);
  }
  const who = e.target.closest('[data-member-open]');
  if (who && who.dataset.memberOpen !== state.acc.user.id && db.get(who.dataset.memberOpen)) { closeOverlay(); showUser(who.dataset.memberOpen); }
});

// Для поиска: публичные группы и каналы (с @username) и те, где я состою
export function searchRooms(q) {
  const me = state.acc.user.id;
  return Object.values(chats.all()).filter((c) => isRoom(c) && (c.username || c.members.includes(me))
    && (!q || c.name.toLowerCase().includes(q) || c.username?.includes(q)));
}

export const roomPreview = (c) => (c.username ? `@${c.username}` : '') + (c.username ? ' · ' : '') + plural(c.members.length, c.type === 'channel' ? 'subscriber' : 'member');
export { previewText };
