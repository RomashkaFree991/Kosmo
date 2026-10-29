// Истории поверх ленты: фото или видео с подписью, живут 24 часа.
// Просмотр на весь экран: полоски прогресса, тап влево/вправо, удержание —
// пауза, свайп вниз — закрыть, ответ в личку и быстрая реакция.

import { $, $$, db, store, uid, toast, escapeHtml, userAvatarHtml, timeAgo, patchList } from './core.js';
import { state } from './panels.js';
import { hydrateMedia, mediaUrl, compressImage, putBlob, mediaDuration } from './media.js';
import { openSheet } from './phone.js';
import { chats, publicUser } from './chats.js';
import { emojiSvg } from './emoji.js';

const DAY = 24 * 3600 * 1000;
const PHOTO_MS = 5000;
const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  trash: svg('<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5"/>'),
  send: svg('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
};

export const stories = {
  all() {
    const now = Date.now();
    const list = store.getJSON('stories', []);
    const live = list.filter((s) => now - s.at < DAY);
    if (live.length !== list.length) store.setJSON('stories', live);   // старше суток — удаляем
    return live;
  },
  save(list) { store.setJSON('stories', list); },
  update(id, fn) {
    const list = this.all();
    const s = list.find((x) => x.id === id);
    if (s) { fn(s); this.save(list); }
  },
};

// Истории по авторам: сначала мои, потом непросмотренные
function groups() {
  const me = state.acc.user.id;
  const map = new Map();
  for (const s of stories.all().sort((a, b) => a.at - b.at)) {
    const u = db.get(s.author);
    if (!u || u.privacy?.blocked?.includes(me) || state.acc.user.privacy?.blocked?.includes(s.author)) continue;
    if (!map.has(s.author)) map.set(s.author, []);
    map.get(s.author).push(s);
  }
  return [...map.entries()].map(([author, items]) => ({
    author, items, unseen: items.some((s) => !s.views?.includes(me)), last: items.at(-1).at,
  })).sort((a, b) => (b.author === me) - (a.author === me) || b.unseen - a.unseen || b.last - a.last);
}

export function renderStories() {
  if (!state.acc) return;
  const me = state.acc.user;
  const gs = groups();
  const mineHas = gs.some((g) => g.author === me.id);
  const rows = [];
  if (!mineHas) {
    const html = `<button class="story story-add" type="button" data-story-add>
      <span class="story-ring is-add">${userAvatarHtml(me, 'avatar-story')}<span class="story-plus">${I.plus}</span></span><span class="story-name">Your story</span></button>`;
    rows.push({ key: 'add', sig: html, html });
  }
  for (const g of gs) {
    const u = publicUser(db.get(g.author));
    const html = `<button class="story" type="button" data-story-open="${g.author}">
      <span class="story-ring${g.unseen ? ' is-unseen' : ''}">${userAvatarHtml(u, 'avatar-story')}</span>
      <span class="story-name">${g.author === me.id ? 'Your story' : escapeHtml(u.name.split(/\s+/)[0])}</span></button>`;
    rows.push({ key: g.author, sig: html, html });
  }
  patchList($('#stories'), rows);
  hydrateMedia($('#stories'));
}

/* ---------- Новая история ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-story-add]')) $('#story-input').click();
  const o = e.target.closest('[data-story-open]');
  if (o) openStories(o.dataset.storyOpen);
});

$('#story-input').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { toast('File is too large (max 50 MB)'); return; }
  openSheet('media', {
    files: [file],
    title: 'New story',
    onSend: async (caption) => {
      try {
        const media = file.type.startsWith('video/')
          ? { type: 'video', media: await putBlob(file), duration: Math.min(30, await mediaDuration(file, 'video')) }
          : await compressImage(file).then(async ({ blob, w, h }) => ({ type: 'photo', media: await putBlob(blob), w, h }));
        const list = stories.all();
        list.push({ id: uid(), author: state.acc.user.id, at: Date.now(), media, text: caption, views: [state.acc.user.id], likes: [] });
        stories.save(list);
        renderStories();
        toast('Story published · visible for 24 hours');
      } catch {
        toast('Could not add this file');
      }
    },
  });
});

/* ---------------------------------------------------------------------------
   Просмотр
   --------------------------------------------------------------------------- */
let v = null;

function openStories(authorId) {
  const gs = groups();
  const gi = gs.findIndex((g) => g.author === authorId);
  if (gi < 0) return;
  const me = state.acc.user.id;
  // начинаем с первой непросмотренной
  const first = Math.max(0, gs[gi].items.findIndex((s) => !s.views?.includes(me)));
  const el = document.createElement('div');
  el.className = 'story-viewer';
  el.innerHTML = `
    <div class="sv-media"></div>
    <div class="sv-top">
      <div class="sv-bars"></div>
      <div class="sv-head"><span class="sv-who"></span><button class="v-btn sv-del" type="button" data-sv="delete" aria-label="Delete story" hidden>${I.trash}</button><button class="v-btn" type="button" data-sv="close" aria-label="Close">${I.close}</button></div>
    </div>
    <button class="sv-tap sv-prev" type="button" data-sv="prev" aria-label="Previous"></button>
    <button class="sv-tap sv-next" type="button" data-sv="next" aria-label="Next"></button>
    <p class="sv-caption"></p>
    <form class="sv-reply" novalidate>
      <input type="text" placeholder="Reply…" aria-label="Reply to story" maxlength="500">
      <button class="sv-like" type="button" data-sv="like" aria-label="Like">${emojiSvg('heart')}</button>
      <button class="sv-send" type="submit" aria-label="Send">${I.send}</button>
    </form>
    <div class="sv-seen" hidden></div>`;
  document.body.append(el);
  v = { el, gs, gi, i: first, timer: null, started: 0, elapsed: 0, paused: false };
  bind(el);
  show();
}

function cur() { return v.gs[v.gi].items[v.i]; }

async function show() {
  const s = cur();
  const me = state.acc.user.id;
  const g = v.gs[v.gi];
  const author = publicUser(db.get(g.author));
  stories.update(s.id, (x) => { if (!x.views.includes(me)) x.views.push(me); });
  v.el.querySelector('.sv-bars').innerHTML = g.items.map((_, k) => `<span class="sv-bar${k < v.i ? ' is-done' : ''}"><i></i></span>`).join('');
  v.el.querySelector('.sv-who').innerHTML = `${userAvatarHtml(author, 'avatar-xs')}<b>${escapeHtml(author.name)}</b><small>${timeAgo(s.at)}</small>`;
  v.el.querySelector('.sv-caption').textContent = s.text ?? '';
  const mine = g.author === me;
  v.el.querySelector('.sv-del').hidden = !mine;
  v.el.querySelector('.sv-reply').hidden = mine;
  const seen = v.el.querySelector('.sv-seen');
  seen.hidden = !mine;
  if (mine) {
    const viewers = (stories.all().find((x) => x.id === s.id)?.views ?? []).filter((x) => x !== me);
    seen.innerHTML = `${I.eye}<span>${viewers.length ? `Seen by ${viewers.length}` : 'No views yet'}</span>${s.likes?.length ? `<span class="sv-likes">${emojiSvg('heart')}${s.likes.length}</span>` : ''}`;
  }
  v.el.querySelector('.sv-like').classList.toggle('is-on', Boolean(s.likes?.includes(me)));
  const url = await mediaUrl(s.media.media);
  if (!v) return;
  const box = v.el.querySelector('.sv-media');
  box.innerHTML = s.media.type === 'video'
    ? `<video src="${url ?? ''}" playsinline autoplay></video>`
    : `<img src="${url ?? ''}" alt="">`;
  hydrateMedia(v.el);
  v.duration = s.media.type === 'video' ? (s.media.duration || 15) * 1000 : PHOTO_MS;
  v.elapsed = 0;
  v.paused = false;
  run();
}

function run() {
  cancelAnimationFrame(v.timer);
  v.started = performance.now() - v.elapsed;
  const bar = v.el.querySelectorAll('.sv-bar i')[v.i];
  const step = (t) => {
    if (!v) return;
    if (v.paused) { v.started = t - v.elapsed; v.timer = requestAnimationFrame(step); return; }
    v.elapsed = t - v.started;
    const p = Math.min(1, v.elapsed / v.duration);
    bar.style.transform = `scaleX(${p})`;
    if (p >= 1) { next(); return; }
    v.timer = requestAnimationFrame(step);
  };
  v.timer = requestAnimationFrame(step);
}

function next() {
  const g = v.gs[v.gi];
  if (v.i < g.items.length - 1) { v.i += 1; show(); return; }
  if (v.gi < v.gs.length - 1) { v.gi += 1; v.i = 0; show(); return; }
  closeStories();
}
function prev() {
  if (v.i > 0) { v.i -= 1; show(); return; }
  if (v.gi > 0) { v.gi -= 1; v.i = 0; show(); return; }
  v.elapsed = 0;
  run();
}

function pause(on) {
  if (!v) return;
  v.paused = on;
  const vid = v.el.querySelector('video');
  if (vid) { if (on) vid.pause(); else vid.play().catch(() => {}); }
}

export function closeStories() {
  if (!v) return;
  cancelAnimationFrame(v.timer);
  const { el } = v;
  v = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 240);
  renderStories();
}

function bind(el) {
  let down = null;
  let held = false;
  let holdTimer = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sv-reply, .sv-head button')) return;
    down = { x: e.clientX, y: e.clientY };
    held = false;
    holdTimer = setTimeout(() => { held = true; pause(true); }, 220);
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dy = e.clientY - down.y;
    if (dy > 0) el.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 400) / 2000})`;
  });
  el.addEventListener('pointerup', (e) => {
    clearTimeout(holdTimer);
    if (!down) return;
    const dy = e.clientY - down.y;
    down = null;
    el.style.transform = '';
    if (dy > 120) { closeStories(); return; }
    if (held) { pause(false); held = false; el.dataset.skip = '1'; }
  });
  el.addEventListener('click', (e) => {
    if (el.dataset.skip) { delete el.dataset.skip; if (e.target.closest('.sv-tap')) return; }
    const b = e.target.closest('[data-sv]');
    if (!b || !v) return;
    const act = b.dataset.sv;
    if (act === 'close') closeStories();
    if (act === 'next') next();
    if (act === 'prev') prev();
    if (act === 'like') {
      const me = state.acc.user.id;
      let on = false;
      stories.update(cur().id, (x) => {
        x.likes ??= [];
        on = !x.likes.includes(me);
        x.likes = on ? [...x.likes, me] : x.likes.filter((u) => u !== me);
      });
      b.classList.toggle('is-on', on);
      if (on) navigator.vibrate?.(10);
    }
    if (act === 'delete') {
      const id = cur().id;
      stories.save(stories.all().filter((x) => x.id !== id));
      toast('Story deleted');
      const g = v.gs[v.gi];
      g.items = g.items.filter((x) => x.id !== id);
      if (!g.items.length) { closeStories(); return; }
      v.i = Math.min(v.i, g.items.length - 1);
      show();
    }
  });
  const form = el.querySelector('.sv-reply');
  const inp = form.querySelector('input');
  inp.addEventListener('focus', () => pause(true));
  inp.addEventListener('blur', () => pause(false));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inp.value.trim();
    if (!text) return;
    const me = state.acc.user.id;
    const author = v.gs[v.gi].author;
    chats.send(chats.idFor(me, author), [me, author], { from: me, kind: 'text', text: `↩︎ Story reply: ${text}` });
    inp.value = '';
    inp.blur();
    toast('Reply sent');
    document.dispatchEvent(new CustomEvent('kosmo:changed'));
  });
}

document.addEventListener('keydown', (e) => {
  if (!v || e.target.closest?.('input')) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); closeStories(); }
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
}, true);
