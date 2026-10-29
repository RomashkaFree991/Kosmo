// Лента: посты для всех — текст, фото, видео, код. Реакции, комментарии,
// пересылка в чаты, просмотры. Автор может изменить или удалить свой пост.

import {
  $, $$, db, toast, shake, escapeHtml, userAvatarHtml, cosmicBadge, formatTime, timeAgo, refreshRefraction,
} from './core.js';
import { state, openPanel, closePanel, openOverlay, closeOverlay, overlayOpen } from './panels.js';
import { putBlob, hydrateMedia, compressImage, mediaDuration } from './media.js';
import { posts } from './feeddata.js';
import { EMOJI, REACTIONS, emojiSvg } from './emoji.js';
import { openSheet } from './phone.js';
import { openViewer } from './viewer.js';
import { publicUser, forwardTargets, sendToChat, flyReaction, ICON, fmtDur } from './chats.js';
import { showUser } from './people.js';

const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  ...ICON,
  more: svg('<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>'),
  smile: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" stroke-width="2.4"/>'),
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  share: svg('<path d="M4 12.5L20 5l-5 15-3.5-6.5z"/><path d="M11.5 13.5L20 5"/>'),
};
const LANGS = ['JavaScript', 'Kotlin', 'Python', 'HTML', 'CSS', 'JSON', 'Other'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------------------------------------------------------------------------
   Карточка поста
   --------------------------------------------------------------------------- */
function mediaGrid(p) {
  if (!p.media?.length) return '';
  return `<div class="post-media" data-count="${Math.min(p.media.length, 4)}">${p.media.slice(0, 4).map((m, i) => `
    <button class="post-media-item" type="button" data-post-view="${p.id}" data-i="${i}" aria-label="Open ${m.type}">
      ${m.type === 'video'
        ? `<video data-media="${m.media}" muted playsinline preload="metadata" ${store.autoplay ? 'autoplay loop' : ''}></video><span class="b-play-ov">${ICON.play}</span>${m.duration ? `<span class="b-dur-ov">${fmtDur(m.duration)}</span>` : ''}`
        : `<img data-media="${m.media}" alt="" style="aspect-ratio:${m.w || 4}/${m.h || 3}">`}
      ${i === 3 && p.media.length > 4 ? `<span class="post-more">+${p.media.length - 4}</span>` : ''}
    </button>`).join('')}</div>`;
}
const store = { get autoplay() { return state.acc?.user.settings?.autoplay !== false; } };

function reactionRow(p) {
  const me = state.acc.user.id;
  const entries = Object.entries(p.reactions ?? {}).filter(([, u]) => u.length);
  return `<div class="reactions post-reactions">${entries.map(([id, users]) => `
    <button class="reaction${users.includes(me) ? ' is-mine' : ''}" type="button" data-post-react="${id}" data-post="${p.id}" aria-label="${EMOJI[id]?.label} ${users.length}">${emojiSvg(id)}<span>${users.length}</span></button>`).join('')}
    <button class="reaction reaction-add" type="button" data-post-react-open="${p.id}" aria-label="Add reaction">${I.smile}</button>
  </div>`;
}

function postCard(p, { full = false, i = 0 } = {}) {
  const me = state.acc.user.id;
  const author = publicUser(db.get(p.author)) ?? { id: null, name: 'Deleted account', avatar: {} };
  const mine = p.author === me;
  return `
    <article class="post${full ? ' is-full' : ''}" data-post-card="${p.id}" style="--i:${i}">
      <header class="post-head">
        <button class="post-author" type="button" data-post-author="${author.id ?? ''}">
          ${userAvatarHtml(author)}
          <span class="post-who"><b class="name-with-badge">${escapeHtml(author.name)}${author.role === 'owner' ? cosmicBadge('owner') : ''}</b>
          <span>${timeAgo(p.at)}${p.edited ? ' · edited' : ''}</span></span>
        </button>
        ${mine ? `<button class="icon-btn post-more-btn" type="button" data-post-menu="${p.id}" aria-label="Post options">${I.more}</button>` : ''}
      </header>
      ${p.text ? `<p class="post-text">${escapeHtml(p.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${mediaGrid(p)}
      ${p.code ? `<div class="b-code post-code"><div class="b-code-head"><span>${escapeHtml(p.code.lang)}</span><button type="button" data-copy-code aria-label="Copy code">${ICON.copy}</button></div><pre><code>${escapeHtml(p.code.text)}</code></pre></div>` : ''}
      ${reactionRow(p)}
      <footer class="post-actions">
        <button class="post-act" type="button" data-post-open="${p.id}">${ICON.comment}<span>${p.comments.length || ''}</span><span class="sr">comments</span></button>
        <button class="post-act" type="button" data-post-share="${p.id}">${I.share}<span>${p.forwards || ''}</span><span class="sr">shares</span></button>
        <span class="post-views">${ICON.eye}${p.views?.length ?? 0}</span>
      </footer>
    </article>`;
}

/* ---------------------------------------------------------------------------
   Лента
   --------------------------------------------------------------------------- */
let feedSig = '';

export function renderFeed(force = false) {
  if (!state.acc) return;
  const me = state.acc.user.id;
  const list = posts.all().filter((p) => db.get(p.author) && !db.get(p.author).privacy?.blocked?.includes(me));
  const sig = JSON.stringify([list, Object.values(db.all()).map((u) => [u.name, u.avatar, u.privacy])]);
  if (sig === feedSig && !force) return;
  feedSig = sig;
  const box = $('#feed');
  if (!list.length) {
    box.innerHTML = `
      <div class="feed-empty">
        <div class="feed-empty-art" aria-hidden="true"><span class="feed-empty-icon">${I.share}</span><span class="orbit-ring"></span><span class="orbit-moon"></span></div>
        <h3>Nothing here yet</h3>
        <p>Share a photo, a video, some code or a thought with everyone on Kosmo.</p>
        <button class="btn btn-primary" type="button" data-new-post>Create a post</button>
      </div>`;
    return;
  }
  box.innerHTML = list.map((p, i) => postCard(p, { i: Math.min(i, 8) })).join('');
  hydrateMedia(box);
  markViewed(list);
}

// Просмотр засчитывается, когда пост показан этому пользователю
function markViewed(list) {
  const me = state.acc.user.id;
  const unseen = list.filter((p) => !p.views?.includes(me)).map((p) => p.id);
  if (!unseen.length) return;
  const all = posts.all();
  all.forEach((p) => { if (unseen.includes(p.id)) (p.views ??= []).push(me); });
  localStorage.setItem('kosmo:feed', JSON.stringify(all));
  feedSig = '';
}

function refreshPostEverywhere(id) {
  renderFeed();
  if (overlayOpen() === 'post' && openPost === id) renderPost();
}

/* ---------------------------------------------------------------------------
   Реакции на посты
   --------------------------------------------------------------------------- */
function reactPost(id, emoji) {
  const me = state.acc.user.id;
  let added = false;
  const card = $(`[data-post-card="${id}"]`, overlayOpen() === 'post' ? $('#post-body') : $('#feed'));
  const from = card?.getBoundingClientRect();
  posts.update(id, (p) => {
    const had = p.reactions[emoji]?.includes(me);
    for (const k of Object.keys(p.reactions)) {
      p.reactions[k] = p.reactions[k].filter((u) => u !== me);
      if (!p.reactions[k].length) delete p.reactions[k];
    }
    if (!had) { (p.reactions[emoji] ??= []).push(me); added = true; }
  });
  refreshPostEverywhere(id);
  if (!added) return;
  navigator.vibrate?.(10);
  const scope = overlayOpen() === 'post' ? $('#post-body') : $('#feed');
  const chip = $(`[data-post-card="${id}"] [data-post-react="${emoji}"]`, scope);
  if (chip) flyReaction(emoji, from && { left: from.left, top: from.top + from.height / 2 - 60, width: from.width, height: 120 }, chip);
}

let pop = null;
function openReactPop(btn, id) {
  closeReactPop();
  const r = btn.getBoundingClientRect();
  pop = document.createElement('div');
  pop.className = 'react-bar react-pop glass glass-text';
  pop.innerHTML = REACTIONS.map((e, i) => `<button class="react-opt" type="button" style="--i:${i}" data-pop-react="${e}" aria-label="${EMOJI[e].label}">${emojiSvg(e)}</button>`).join('');
  document.body.append(pop);
  const w = pop.offsetWidth;
  pop.style.left = `${Math.max(10, Math.min(r.left, innerWidth - w - 10))}px`;
  pop.style.top = `${Math.max(10, r.top - 64)}px`;
  pop.dataset.post = id;
  refreshRefraction();
}
function closeReactPop() {
  if (!pop) return;
  const el = pop;
  pop = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 160);
}

/* ---------------------------------------------------------------------------
   Меню автора: изменить / удалить
   --------------------------------------------------------------------------- */
let menu = null;
function openPostMenu(btn, id) {
  closePostMenu();
  const r = btn.getBoundingClientRect();
  menu = document.createElement('div');
  menu.className = 'menu post-menu glass glass-text';
  menu.innerHTML = `
    <button class="menu-item" type="button" data-pm="edit">${ICON.edit}Edit</button>
    <button class="menu-item danger" type="button" data-pm="delete">${ICON.trash}Delete</button>`;
  menu.dataset.post = id;
  document.body.append(menu);
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.left = `${Math.max(10, r.right - 220)}px`;
  menu.style.transformOrigin = '200px 0';
  refreshRefraction();
}
function closePostMenu() {
  if (!menu) return;
  const el = menu;
  menu = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 160);
}

document.addEventListener('click', (e) => {
  if (!state.acc || $('#app').hidden) return;
  const t = e.target;
  if (pop && !t.closest('.react-pop, [data-post-react-open]')) closeReactPop();
  if (menu && !t.closest('.post-menu, [data-post-menu]')) closePostMenu();

  const pick = t.closest('[data-pop-react]');
  if (pick && pop) { const id = pop.dataset.post; closeReactPop(); reactPost(id, pick.dataset.popReact); return; }
  const ro = t.closest('[data-post-react-open]');
  if (ro) { openReactPop(ro, ro.dataset.postReactOpen); return; }
  const rc = t.closest('[data-post-react]');
  if (rc) { reactPost(rc.dataset.post, rc.dataset.postReact); return; }

  const pm = t.closest('[data-post-menu]');
  if (pm) { openPostMenu(pm, pm.dataset.postMenu); return; }
  const act = t.closest('[data-pm]');
  if (act && menu) {
    const id = menu.dataset.post;
    if (act.dataset.pm === 'edit') { closePostMenu(); openCompose(id); return; }
    if (!act.classList.contains('is-confirm')) {
      act.classList.add('is-confirm');
      act.lastChild.textContent = 'Delete for everyone?';
      return;
    }
    closePostMenu();
    $$(`[data-post-card="${id}"]`).forEach((c) => c.classList.add('is-removing'));
    setTimeout(() => {
      posts.remove(id);
      if (overlayOpen() === 'post' && openPost === id) closeOverlay();
      renderFeed(true);
      toast('Post deleted');
    }, 260);
    return;
  }

  const view = t.closest('[data-post-view]');
  if (view) {
    const p = posts.get(view.dataset.postView);
    const author = db.get(p.author);
    openViewer(p.media.map((m) => ({ ...m, caption: p.text, title: author?.name ?? '', sub: timeAgo(p.at) })), Number(view.dataset.i));
    return;
  }
  const op = t.closest('[data-post-open]');
  if (op) { showPost(op.dataset.postOpen, true); return; }
  const share = t.closest('[data-post-share]');
  if (share) { sharePost(share.dataset.postShare); return; }
  const au = t.closest('[data-post-author]');
  if (au && au.dataset.postAuthor && au.dataset.postAuthor !== state.acc.user.id) { showUser(au.dataset.postAuthor); return; }
  if (au && au.dataset.postAuthor === state.acc.user.id) toast('This is your post');
  if (t.closest('[data-new-post], #new-post-btn')) openCompose();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !(pop || menu)) return;
  e.stopImmediatePropagation();
  closeReactPop();
  closePostMenu();
}, true);

function sharePost(id) {
  openSheet('forward', {
    title: 'Share post',
    items: forwardTargets(),
    onPick: (chatId) => {
      sendToChat(chatId, { kind: 'post', post: id });
      posts.update(id, (p) => { p.forwards = (p.forwards ?? 0) + 1; });
      refreshPostEverywhere(id);
      toast('Post shared');
    },
  });
}

/* ---------------------------------------------------------------------------
   Пост с комментариями (поверх ленты или чата)
   --------------------------------------------------------------------------- */
let openPost = null;

function commentHtml(c, p) {
  const me = state.acc.user.id;
  const u = publicUser(db.get(c.from)) ?? { name: 'Deleted account', avatar: {} };
  const canDel = c.from === me || p.author === me;
  return `
    <li class="comment" data-c="${c.id}">
      <button class="comment-avatar" type="button" data-post-author="${db.get(c.from) ? c.from : ''}">${userAvatarHtml(u, 'avatar-xs')}</button>
      <div class="comment-body">
        <span class="comment-name">${escapeHtml(u.name)}${u.role === 'owner' ? cosmicBadge('owner') : ''}${c.from === p.author ? '<span class="role-chip">Author</span>' : ''}<time>${formatTime(c.at)}</time></span>
        <p class="comment-text">${escapeHtml(c.text).replace(/\n/g, '<br>')}</p>
      </div>
      ${canDel ? `<button class="comment-del" type="button" data-del-pc="${c.id}" aria-label="Delete comment">${ICON.trash}</button>` : ''}
    </li>`;
}

function renderPost() {
  const p = posts.get(openPost);
  if (!p) { closeOverlay(); toast('This post was deleted'); return; }
  $('#post-title').textContent = p.comments.length ? plural(p.comments.length, 'comment') : 'Post';
  $('#post-body').innerHTML = `
    ${postCard(p, { full: true })}
    <p class="section-label">${p.comments.length ? 'Comments' : 'No comments yet — be the first'}</p>
    <ul class="comments">${p.comments.map((c) => commentHtml(c, p)).join('')}</ul>`;
  hydrateMedia($('#post-body'));
}

export function showPost(id, focus = false) {
  if (!posts.get(id)) { toast('This post was deleted'); return; }
  openPost = id;
  renderPost();
  $('#post-comment-input').value = '';
  openOverlay('post');
  if (focus) setTimeout(() => $('#post-comment-input').focus({ preventScroll: true }), 380);
}
document.addEventListener('kosmo:open-post', (e) => showPost(e.detail));

$('#post-comment-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#post-comment-input');
  const text = input.value.trim();
  if (!text || !openPost) return;
  posts.update(openPost, (p) => { p.comments.push({ id: crypto.randomUUID?.() ?? String(Date.now()), from: state.acc.user.id, text, at: Date.now() }); });
  input.value = '';
  input.style.height = '';
  renderPost();
  renderFeed();
  $('#panel-post').scrollTo({ top: $('#panel-post').scrollHeight, behavior: 'smooth' });
});
$('#post-comment-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#post-comment-form').requestSubmit(); }
});
$('#post-comment-input').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; });
$('#post-body').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-pc]');
  if (!del) return;
  del.closest('.comment').classList.add('is-removing');
  setTimeout(() => {
    posts.update(openPost, (p) => { p.comments = p.comments.filter((c) => c.id !== del.dataset.delPc); });
    renderPost();
    renderFeed();
  }, 220);
});

/* ---------------------------------------------------------------------------
   Новый пост / изменение
   --------------------------------------------------------------------------- */
let draft = null;

export function openCompose(editId = null) {
  const p = editId && posts.get(editId);
  draft = p
    ? { id: p.id, text: p.text ?? '', media: [...(p.media ?? [])], code: p.code ? { ...p.code } : null }
    : { id: null, text: '', media: [], code: null };
  $('#compose-title').textContent = p ? 'Edit post' : 'New post';
  renderCompose();
  openPanel('compose');
  setTimeout(() => $('#post-text')?.focus({ preventScroll: true }), 380);
}

function renderCompose() {
  const me = state.acc.user;
  $('#compose-body').innerHTML = `
    <form class="post-compose setup-form step-in" id="post-form" novalidate>
      <div class="pc-head">${userAvatarHtml(me)}<b>${escapeHtml(me.name)}</b><span class="pc-audience">${ICON.globe}Everyone</span></div>
      <div class="field field-area glass" data-refract="0.5">
        <textarea id="post-text" rows="4" maxlength="2000" placeholder="What's new?" aria-label="Post text">${escapeHtml(draft.text)}</textarea>
      </div>
      <div class="pc-media" id="pc-media">${draft.media.map((m, i) => `
        <div class="mp-item">${m.type === 'video' ? `<video data-media="${m.media}" muted playsinline preload="metadata"></video><span class="mp-badge">Video</span>` : `<img data-media="${m.media}" alt="">`}
          <button class="mp-remove" type="button" data-pc-remove="${i}" aria-label="Remove">${I.close}</button></div>`).join('')}</div>
      ${draft.code ? `
        <div class="pc-code">
          <div class="lang-row" role="radiogroup" aria-label="Language">${LANGS.map((l) => `<button class="lang-chip" type="button" role="radio" data-pc-lang="${l}" aria-checked="${l === draft.code.lang}">${l}</button>`).join('')}</div>
          <div class="code-field"><textarea id="pc-code" rows="7" spellcheck="false" placeholder="Paste or write code" aria-label="Code">${escapeHtml(draft.code.text)}</textarea></div>
          <button class="link-btn" type="button" data-pc-code-remove>Remove code</button>
        </div>` : ''}
      <div class="pc-tools">
        <button class="chip-btn" type="button" data-pc-add="media">${ICON.photo}Photo / Video</button>
        ${draft.code ? '' : `<button class="chip-btn" type="button" data-pc-add="code">${ICON.code}Code</button>`}
      </div>
      <button class="btn btn-primary" type="submit" id="pc-publish">${draft.id ? 'Save' : 'Publish'}</button>
    </form>`;
  hydrateMedia($('#compose-body'));
  refreshRefraction();
}

function syncDraft() {
  draft.text = $('#post-text')?.value ?? draft.text;
  if (draft.code && $('#pc-code')) draft.code.text = $('#pc-code').value;
}

$('#compose-body').addEventListener('click', (e) => {
  const t = e.target;
  const add = t.closest('[data-pc-add]');
  if (add) {
    syncDraft();
    if (add.dataset.pcAdd === 'media') $('#post-media-input').click();
    else { draft.code = { lang: LANGS[0], text: '' }; renderCompose(); $('#pc-code').focus(); }
  }
  const rm = t.closest('[data-pc-remove]');
  if (rm) { syncDraft(); draft.media.splice(Number(rm.dataset.pcRemove), 1); renderCompose(); }
  const lang = t.closest('[data-pc-lang]');
  if (lang) {
    draft.code.lang = lang.dataset.pcLang;
    $$('[data-pc-lang]').forEach((c) => c.setAttribute('aria-checked', String(c === lang)));
  }
  if (t.closest('[data-pc-code-remove]')) { syncDraft(); draft.code = null; renderCompose(); }
});
$('#compose-body').addEventListener('keydown', (e) => {
  if (e.target.id === 'pc-code' && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    e.target.setRangeText('  ', e.target.selectionStart, e.target.selectionEnd, 'end');
  }
});

$('#post-media-input').addEventListener('change', async (e) => {
  const files = [...e.target.files].slice(0, 10 - draft.media.length);
  e.target.value = '';
  if (!files.length || !draft) return;
  syncDraft();
  const btn = $('#pc-publish');
  btn.disabled = true;
  for (const f of files) {
    try {
      if (f.type.startsWith('video/')) {
        if (f.size > 50 * 1024 * 1024) { toast('Video is too large (max 50 MB)'); continue; }
        draft.media.push({ type: 'video', media: await putBlob(f), duration: await mediaDuration(f, 'video') });
      } else {
        const { blob, w, h } = await compressImage(f);
        draft.media.push({ type: 'photo', media: await putBlob(blob), w, h });
      }
    } catch {
      toast('Could not add this file');
    }
  }
  renderCompose();
});

$('#compose-body').addEventListener('submit', (e) => {
  if (e.target.id !== 'post-form') return;
  e.preventDefault();
  syncDraft();
  const text = draft.text.trim();
  const code = draft.code?.text.trim() ? { lang: draft.code.lang, text: draft.code.text.replace(/\s+$/, '') } : null;
  if (!text && !draft.media.length && !code) { shake($('#post-form .field')); toast('Write something or add media'); return; }
  if (draft.id) {
    posts.update(draft.id, (p) => { Object.assign(p, { text, media: draft.media, code, edited: true }); });
    toast('Post updated');
  } else {
    posts.add({ author: state.acc.user.id, text, media: draft.media, code, views: [state.acc.user.id] });
    toast('Published');
  }
  const editedId = draft.id;
  draft = null;
  closePanel();
  renderFeed(true);
  if (editedId && overlayOpen() === 'post') renderPost();
  if (!editedId) $('#view-feed').scrollTo({ top: 0, behavior: 'smooth' });
});

export const refreshFeed = () => {
  renderFeed();
  if (overlayOpen() === 'post' && openPost) renderPost();
};
