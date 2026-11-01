// Kosmo+: «Избранное», закладки, «Не беспокоить», перевод, цитаты, статус,
// списки дел, итоги опросов, геопозиция, приглашения по ссылке и QR,
// темы в группах, резервная копия и боты. Окна — модальные листы.

import {
  $, $$, db, uid, toast, escapeHtml, userAvatarHtml, formatDate, formatTime, refreshRefraction, timeAgo,
} from './core.js';
import { state } from './panels.js';
import { api } from './api.js';
import { EMOJI, emojiSvg } from './emoji.js';
import { qrSvg, qrReady } from './qrlogin.js';
import { lang } from './i18n.js';

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const PI = {
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  bookmark: svg('<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z"/>'),
  moon: svg('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
  translate: svg('<path d="M4 5h9M8.5 3v2M6 5c1 3.5 3.5 6 6.5 7.5M11 5c-1 4-4 7.5-7 9M13 20l4-10 4 10M14.5 16.5h5"/>'),
  quote: svg('<path d="M9.5 7H6a1.5 1.5 0 0 0-1.5 1.5V12H9v1.5A3.5 3.5 0 0 1 5.5 17M19 7h-3.5a1.5 1.5 0 0 0-1.5 1.5V12h4.5v1.5A3.5 3.5 0 0 1 15 17"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  todo: svg('<path d="M4 6.5l1.5 1.5L8.5 5M4 12.5l1.5 1.5 3-3M4 18.5l1.5 1.5 3-3M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5"/>'),
  pin: svg('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  trash: svg('<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5"/>'),
  bot: svg('<rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 8V5M9.5 13h.01M14.5 13h.01M9.5 16.5h5"/><circle cx="12" cy="4" r="1"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  fire: svg('<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.5 2.6-5.5 3.6-8.8 2.4 1.6 3.2 3.6 3.2 5.5 1-.6 1.7-1.7 1.9-3 2.1 1.8 3.3 4 3.3 6.3 0 3.6-2.5 6.2-5.5 6.2z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
};

/* ---------------------------------------------------------------------------
   Модальный лист
   --------------------------------------------------------------------------- */
let sheet = null;
export function openModal(title, body, { onClick, cls = '' } = {}) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal-scrim" data-pm-close></div>
    <div class="modal plus-modal glass glass-text ${cls}" role="dialog" aria-label="${escapeHtml(title)}">
      <header class="modal-head"><h2>${escapeHtml(title)}</h2><button class="icon-btn" type="button" data-pm-close aria-label="Close">${PI.close}</button></header>
      <div class="pm-body">${body}</div>
    </div>`;
  document.body.append(wrap);
  sheet = wrap;
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-pm-close]')) { closeModal(); return; }
    onClick?.(e, wrap);
  });
  refreshRefraction();
  return wrap;
}
export function closeModal() {
  if (!sheet) return;
  const el = sheet;
  sheet = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 180);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheet) { e.stopImmediatePropagation(); closeModal(); }
}, true);

const me = () => state.acc?.user;
const saveMe = (fn) => { db.update(me().id, fn); state.reload(); };

/* ---------------------------------------------------------------------------
   «Избранное» — чат с самим собой
   --------------------------------------------------------------------------- */
export const savedId = () => `saved_${me().id}`;
export const isSavedChat = (c) => Boolean(c?.saved);
export function savedAvatar(cls = '') {
  return `<span class="avatar avatar-saved ${cls}" aria-hidden="true">${PI.bookmark}</span>`;
}

/* ---------------------------------------------------------------------------
   Закладки на сообщения
   --------------------------------------------------------------------------- */
export const bookmarks = () => me()?.bookmarks ?? [];
export const isBookmarked = (chatId, msgId) => bookmarks().some((b) => b.chatId === chatId && b.msgId === msgId);
export function toggleBookmark(chatId, m, text) {
  const on = !isBookmarked(chatId, m.id);
  saveMe((u) => {
    const list = (u.bookmarks ?? []).filter((b) => !(b.chatId === chatId && b.msgId === m.id));
    if (on) list.unshift({ chatId, msgId: m.id, at: Date.now(), msgAt: m.at, text: String(text ?? '').slice(0, 300) });
    u.bookmarks = list.slice(0, 500);
  });
  toast(on ? 'Bookmark added' : 'Bookmark removed');
  return on;
}

export function openBookmarks({ title, onOpen }) {
  const render = (q = '') => {
    const s = q.trim().toLowerCase();
    const list = bookmarks().filter((b) => !s || b.text.toLowerCase().includes(s) || (title(b.chatId) ?? '').toLowerCase().includes(s));
    return list.length ? list.map((b) => `
      <button class="bm-row" type="button" data-bm-open="${b.chatId}|${b.msgId}">
        <span class="bm-ic">${PI.bookmark}</span>
        <span class="bm-text"><b>${escapeHtml(title(b.chatId) ?? 'Chat')}</b><span>${escapeHtml(b.text || 'Message')}</span></span>
        <time>${formatDate(b.msgAt ?? b.at).split(',')[0]}</time>
      </button>`).join('') : `<p class="pm-empty">${s ? 'Nothing found' : 'No bookmarks yet. Long-press a message and tap “Bookmark”.'}</p>`;
  };
  const wrap = openModal('Bookmarks', `
    <div class="search-field glass" data-refract="0.5"><input type="search" id="bm-search" placeholder="Search bookmarks" aria-label="Search bookmarks" autocomplete="off"></div>
    <div class="bm-list" id="bm-list">${render()}</div>`, {
    onClick: (e) => {
      const r = e.target.closest('[data-bm-open]');
      if (!r) return;
      const [chatId, msgId] = r.dataset.bmOpen.split('|');
      closeModal();
      onOpen(chatId, msgId);
    },
  });
  $('#bm-search', wrap).addEventListener('input', (e) => { $('#bm-list', wrap).innerHTML = render(e.target.value); });
}

/* ---------------------------------------------------------------------------
   «Не беспокоить»: 1 час, 8 часов, до утра
   --------------------------------------------------------------------------- */
export const dndUntil = () => {
  const t = me()?.settings?.dnd ?? 0;
  return t > Date.now() ? t : 0;
};
function morning() {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
export function openDnd(onChange) {
  const until = dndUntil();
  const opts = [['1h', 'For 1 hour', () => Date.now() + 3_600_000], ['8h', 'For 8 hours', () => Date.now() + 8 * 3_600_000], ['morning', 'Until 7:00', morning]];
  openModal('Do not disturb', `
    <p class="pm-note">${until ? `Notifications are muted until ${formatTime(until)}` : 'Mute notification sounds, vibration and pop-ups for a while.'}</p>
    <div class="pm-options">${opts.map(([k, l]) => `<button class="pm-opt" type="button" data-dnd="${k}">${PI.moon}<span>${l}</span></button>`).join('')}</div>
    ${until ? '<button class="btn btn-secondary glass" type="button" data-dnd="off">Turn off</button>' : ''}`, {
    onClick: (e) => {
      const b = e.target.closest('[data-dnd]');
      if (!b) return;
      const v = b.dataset.dnd === 'off' ? 0 : opts.find(([k]) => k === b.dataset.dnd)[2]();
      saveMe((u) => { u.settings = { ...(u.settings ?? {}), dnd: v }; });
      closeModal();
      toast(v ? `Do not disturb until ${formatTime(v)}` : 'Do not disturb is off');
      onChange?.();
    },
  });
}

/* ---------------------------------------------------------------------------
   Перевод RU ↔ EN: встроенный переводчик браузера (на устройстве),
   иначе — бесплатный MyMemory
   --------------------------------------------------------------------------- */
const translations = new Map();   // id сообщения → перевод (только в этой вкладке)
export const translationOf = (id) => translations.get(id);
export function clearTranslation(id) { translations.delete(id); }

export async function translate(id, text) {
  const ru = /[а-яё]/i.test(text);
  const [from, to] = ru ? ['ru', 'en'] : ['en', 'ru'];
  let out = null;
  try {
    if ('Translator' in self) {
      const tr = await self.Translator.create({ sourceLanguage: from, targetLanguage: to });
      out = await tr.translate(text);
    }
  } catch { /* встроенного нет — запасной вариант */ }
  if (!out) {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${from}|${to}`);
    const j = await r.json();
    out = j?.responseData?.translatedText;
  }
  if (!out) throw new Error('no translation');
  translations.set(id, { text: out, to });
  return out;
}

/* ---------------------------------------------------------------------------
   Ответ с цитатой: выделить кусочек текста
   --------------------------------------------------------------------------- */
export function openQuote(text, onPick) {
  const wrap = openModal('Quote', `
    <p class="pm-note">Select the part you want to quote</p>
    <div class="quote-src" id="quote-src">${escapeHtml(text)}</div>
    <button class="btn btn-primary" type="button" data-quote-go>${PI.quote}Reply with quote</button>`, {
    onClick: (e) => {
      if (!e.target.closest('[data-quote-go]')) return;
      const sel = String(getSelection()).trim();
      const src = $('#quote-src', wrap);
      const part = sel && src.textContent.includes(sel) ? sel : text;
      closeModal();
      onPick(part.slice(0, 500));
    },
  });
  // сразу выделяем всё — можно сузить пальцем
  const range = document.createRange();
  range.selectNodeContents($('#quote-src', wrap));
  getSelection().removeAllRanges();
  getSelection().addRange(range);
}

/* ---------------------------------------------------------------------------
   Статус: эмодзи и текст рядом с именем, со сроком
   --------------------------------------------------------------------------- */
const STATUS_EMOJI = ['party', 'fire', 'cool', 'rocket', 'planet', 'heart', 'laugh', 'star', 'like', 'wow'].filter((e) => EMOJI[e]);
export const statusOf = (u) => (u?.status && (!u.status.until || u.status.until > Date.now()) ? u.status : null);
export function statusHtml(u, withText = false) {
  const s = statusOf(u);
  if (!s) return '';
  return `<span class="user-status" title="${escapeHtml(s.text ?? '')}">${s.emoji && EMOJI[s.emoji] ? emojiSvg(s.emoji, 'status-emoji') : ''}${withText && s.text ? `<span>${escapeHtml(s.text)}</span>` : ''}</span>`;
}
export function openStatus(onChange) {
  const cur = statusOf(me()) ?? {};
  let pick = cur.emoji ?? STATUS_EMOJI[0];
  const DUR = [[3_600_000, '1 hour'], ['today', 'Today'], [7 * 86_400_000, '1 week'], [0, 'Forever']];
  const wrap = openModal('Status', `
    <div class="status-emojis">${STATUS_EMOJI.map((e) => `<button class="status-pick" type="button" data-st-emoji="${e}" aria-checked="${e === pick}" aria-label="${EMOJI[e].label}">${emojiSvg(e)}</button>`).join('')}</div>
    <label class="modal-field"><span>What’s up?</span><input type="text" id="st-text" maxlength="60" placeholder="In a meeting, on vacation…" value="${escapeHtml(cur.text ?? '')}"></label>
    <span class="modal-label">Clear after</span>
    <div class="segs segs-wrap">${DUR.map(([v, l], i) => `<button type="button" class="seg-btn" role="radio" data-st-dur="${v}" aria-checked="${i === 0}">${l}</button>`).join('')}</div>
    <button class="btn btn-primary" type="button" data-st-save>Set status</button>
    ${statusOf(me()) ? '<button class="btn btn-secondary glass" type="button" data-st-clear>Clear status</button>' : ''}`, {
    onClick: (e) => {
      const em = e.target.closest('[data-st-emoji]');
      if (em) { pick = em.dataset.stEmoji; $$('[data-st-emoji]', wrap).forEach((b) => b.setAttribute('aria-checked', String(b === em))); }
      const d = e.target.closest('[data-st-dur]');
      if (d) $$('[data-st-dur]', wrap).forEach((b) => b.setAttribute('aria-checked', String(b === d)));
      if (e.target.closest('[data-st-clear]')) {
        saveMe((u) => { u.status = null; });
        closeModal(); toast('Status cleared'); onChange?.();
      }
      if (e.target.closest('[data-st-save]')) {
        const dv = $('[data-st-dur][aria-checked="true"]', wrap).dataset.stDur;
        let until = 0;
        if (dv === 'today') { const t = new Date(); t.setHours(23, 59, 59, 0); until = t.getTime(); } else if (Number(dv)) until = Date.now() + Number(dv);
        const text = $('#st-text', wrap).value.trim();
        saveMe((u) => { u.status = { emoji: pick, text, until }; });
        closeModal(); toast('Status set'); onChange?.();
      }
    },
  });
}

/* ---------------------------------------------------------------------------
   Совместный список дел
   --------------------------------------------------------------------------- */
export function openTodoCreator(onSend) {
  const row = (v = '') => `<div class="todo-edit-row"><input type="text" maxlength="200" placeholder="Task" value="${escapeHtml(v)}"><button class="icon-btn" type="button" data-todo-del aria-label="Remove">${PI.close}</button></div>`;
  const wrap = openModal('Checklist', `
    <label class="modal-field"><span>Title</span><input type="text" id="todo-title" maxlength="80" placeholder="Shopping, trip, plans…"></label>
    <span class="modal-label">Tasks</span>
    <div class="todo-edit" id="todo-edit">${row()}${row()}</div>
    <button class="link-btn todo-add-row" type="button" data-todo-more>${PI.plus}Add task</button>
    <label class="sw-row"><span>Members can add tasks</span><input type="checkbox" id="todo-open" checked></label>
    <button class="btn btn-primary" type="button" data-todo-send>Send checklist</button>`, {
    onClick: (e) => {
      if (e.target.closest('[data-todo-more]')) { $('#todo-edit', wrap).insertAdjacentHTML('beforeend', row()); $('#todo-edit input:last-of-type', wrap); $$('#todo-edit input', wrap).at(-1).focus(); }
      const del = e.target.closest('[data-todo-del]');
      if (del && $$('.todo-edit-row', wrap).length > 1) del.closest('.todo-edit-row').remove();
      if (e.target.closest('[data-todo-send]')) {
        const items = $$('#todo-edit input', wrap).map((i) => i.value.trim()).filter(Boolean).slice(0, 50);
        if (!items.length) { toast('Add at least one task'); return; }
        const by = me().id;
        closeModal();
        onSend({ kind: 'todo', todo: { title: $('#todo-title', wrap).value.trim(), open: $('#todo-open', wrap).checked, items: items.map((text) => ({ id: uid(), text, by, done: [] })) } });
      }
    },
  });
  $('#todo-title', wrap).focus();
}

export function todoHtml(m, chatId) {
  const t = m.todo;
  const done = t.items.filter((i) => i.done?.length).length;
  const myId = me().id;
  return `<div class="todo" data-todo="${m.id}" data-chat="${chatId}">
    <p class="todo-title">${PI.todo}<b>${escapeHtml(t.title || 'Checklist')}</b><span>${done}/${t.items.length}</span></p>
    <ul class="todo-list">${t.items.map((i) => {
      const who = (i.done ?? []).map((u) => db.get(u)).filter(Boolean);
      const mine = (i.done ?? []).includes(myId);
      return `<li class="todo-item${who.length ? ' is-done' : ''}">
        <button class="todo-check${mine ? ' is-mine' : ''}" type="button" data-todo-toggle="${i.id}" aria-pressed="${mine}" aria-label="${escapeHtml(i.text)}">${PI.check}</button>
        <span class="todo-text">${escapeHtml(i.text)}</span>
        <span class="todo-who">${who.slice(0, 3).map((u) => userAvatarHtml(u, 'avatar-xxs')).join('')}</span>
      </li>`;
    }).join('')}</ul>
    ${t.open !== false || m.from === myId ? `<form class="todo-new" data-todo-add><input type="text" maxlength="200" placeholder="Add a task" aria-label="Add a task"><button type="submit" aria-label="Add">${PI.plus}</button></form>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------------------
   Итог опроса (сервер пишет его в чат после дедлайна)
   --------------------------------------------------------------------------- */
export function pollResultHtml(m) {
  const w = m.winners ?? [];
  return `<button class="poll-result" type="button" data-jump="${m.pollOf}">
    <span class="pr-head">${svg('<path d="M5 20V10M12 20V4M19 20v-7"/>')}Poll results</span>
    <b>${escapeHtml(m.question)}</b>
    <span>${!m.total ? 'Nobody voted' : w.length === 1 ? `Winner: ${escapeHtml(w[0])} · ${m.top} of ${m.total}` : `Tie: ${w.map(escapeHtml).join(', ')} · ${m.top} each`}</span>
  </button>`;
}

/* ---------------------------------------------------------------------------
   Геопозиция: разово или «в реальном времени» на 15 минут или час
   --------------------------------------------------------------------------- */
const sharing = new Map();   // id сообщения → watchId
export function openLocation(onSend, onLiveUpdate) {
  if (!navigator.geolocation) { toast('Location is not available'); return; }
  openModal('Location', `
    <div class="pm-options">
      <button class="pm-opt" type="button" data-loc="0">${PI.pin}<span>Send my current location</span></button>
      <button class="pm-opt" type="button" data-loc="15">${svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>')}<span>Share live location · 15 min</span></button>
      <button class="pm-opt" type="button" data-loc="60">${svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>')}<span>Share live location · 1 hour</span></button>
    </div>
    <p class="pm-note">Your browser will ask for permission. Live location updates while Kosmo is open.</p>`, {
    onClick: (e) => {
      const b = e.target.closest('[data-loc]');
      if (!b) return;
      const mins = Number(b.dataset.loc);
      closeModal();
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: +pos.coords.latitude.toFixed(6), lon: +pos.coords.longitude.toFixed(6), acc: Math.round(pos.coords.accuracy) };
        const msg = { kind: 'location', location: mins ? { ...loc, live: true, until: Date.now() + mins * 60_000, updated: Date.now() } : loc };
        const sent = onSend(msg);
        if (mins && sent) startLive(sent.chatId, sent.id, msg.location.until, onLiveUpdate);
      }, () => toast('Allow location access to share it'), { enableHighAccuracy: true, timeout: 15_000 });
    },
  });
}
function startLive(chatId, msgId, until, onLiveUpdate) {
  let last = 0;
  const id = navigator.geolocation.watchPosition((pos) => {
    if (Date.now() > until) { stopLive(msgId); return; }
    if (Date.now() - last < 10_000) return;
    last = Date.now();
    onLiveUpdate(chatId, msgId, { lat: +pos.coords.latitude.toFixed(6), lon: +pos.coords.longitude.toFixed(6), acc: Math.round(pos.coords.accuracy), updated: Date.now() });
  }, () => {}, { enableHighAccuracy: true });
  sharing.set(msgId, id);
  setTimeout(() => stopLive(msgId), until - Date.now() + 1000);
}
export function stopLive(msgId, onStop) {
  const w = sharing.get(msgId);
  if (w != null) navigator.geolocation.clearWatch(w);
  sharing.delete(msgId);
  onStop?.();
}
export const isSharing = (msgId) => sharing.has(msgId);

// Карта: одна плитка OpenStreetMap с булавкой
function tileOf(lat, lon, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), fx: x % 1, fy: y % 1 };
}
export function locationHtml(m) {
  const l = m.location;
  const z = 15;
  const t = tileOf(l.lat, l.lon, z);
  const live = l.live && l.until > Date.now();
  const mine = m.from === me()?.id;
  const left = live ? Math.max(1, Math.round((l.until - Date.now()) / 60_000)) : 0;
  return `<div class="loc">
    <a class="loc-map" href="https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=16/${l.lat}/${l.lon}" target="_blank" rel="noopener noreferrer" aria-label="Open map">
      <span class="loc-tiles" style="--fx:${t.fx};--fy:${t.fy}">
        ${[-1, 0, 1].map((dy) => [-1, 0, 1].map((dx) => `<img alt="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://tile.openstreetmap.org/${z}/${t.x + dx}/${t.y + dy}.png" style="--dx:${dx};--dy:${dy}">`).join('')).join('')}
      </span>
      <span class="loc-pin${live ? ' is-live' : ''}">${PI.pin}</span>
    </a>
    <div class="loc-foot">
      <span>${live ? `<b class="loc-live">Live location</b> · ${left} min left · updated ${timeAgo(l.updated ?? m.at)}` : l.live ? 'Live location ended' : 'Location'}</span>
      ${live && mine && isSharing(m.id) ? `<button class="chip-btn" type="button" data-loc-stop="${m.id}">Stop</button>` : ''}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------------------
   Одноразовое фото
   --------------------------------------------------------------------------- */
export function viewOnceHtml(m) {
  const myId = me().id;
  const opened = (m.viewedBy ?? []).length > 0;
  if (m.from === myId) {
    return `<div class="vo-card is-mine">${PI.fire}<span><b>View-once photo</b><small>${opened ? 'Opened' : 'Not opened yet'}</small></span></div>`;
  }
  const seen = (m.viewedBy ?? []).includes(myId);
  return seen
    ? `<div class="vo-card is-seen">${PI.fire}<span><b>Photo</b><small>Opened</small></span></div>`
    : `<button class="vo-card" type="button" data-view-once="${m.id}">${PI.fire}<span><b>View-once photo</b><small>Tap to view · disappears after</small></span></button>`;
}

/* ---------------------------------------------------------------------------
   Приглашения по ссылке и QR-коду
   --------------------------------------------------------------------------- */
const INVITE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const newInviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => INVITE_ALPHA[b % INVITE_ALPHA.length]).join('');
export const inviteUrl = (code) => `${location.origin}/#join=${code}`;

export function openInvites(c, save) {
  const EXP = [[3_600_000, '1 hour'], [86_400_000, '1 day'], [7 * 86_400_000, '7 days'], [0, 'Never']];
  let exp = 86_400_000;
  const active = () => (c().invites ?? []).filter((i) => !i.expires || i.expires > Date.now());
  const list = () => active().map((i) => `
    <div class="inv-row">
      <span class="inv-ic">${PI.link}</span>
      <span class="inv-text"><b>${escapeHtml(inviteUrl(i.code).replace(/^https?:\/\//, ''))}</b><small>${i.expires ? `Expires ${formatDate(i.expires)}` : 'No expiry'} · joined ${i.used ?? 0}</small></span>
      <button class="icon-btn" type="button" data-inv-qr="${i.code}" aria-label="QR code">${svg('<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.6"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.6"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.6"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18z"/>')}</button>
      <button class="icon-btn" type="button" data-inv-copy="${i.code}" aria-label="Copy link">${PI.copy}</button>
      <button class="icon-btn danger" type="button" data-inv-del="${i.code}" aria-label="Revoke">${PI.trash}</button>
    </div>`).join('') || '<p class="pm-empty">No active links</p>';
  const wrap = openModal('Invite links', `
    <div class="inv-qr" id="inv-qr" hidden></div>
    <div id="inv-list">${list()}</div>
    <span class="modal-label">New link expires after</span>
    <div class="segs segs-wrap">${EXP.map(([v, l]) => `<button type="button" class="seg-btn" role="radio" data-inv-exp="${v}" aria-checked="${v === exp}">${l}</button>`).join('')}</div>
    <button class="btn btn-primary" type="button" data-inv-new>${PI.link}Create link</button>`, {
    onClick: async (e) => {
      const ex = e.target.closest('[data-inv-exp]');
      if (ex) { exp = Number(ex.dataset.invExp); $$('[data-inv-exp]', wrap).forEach((b) => b.setAttribute('aria-checked', String(b === ex))); }
      if (e.target.closest('[data-inv-new]')) {
        const code = newInviteCode();
        save([...active(), { code, expires: exp ? Date.now() + exp : null, by: me().id, at: Date.now() }]);
        $('#inv-list', wrap).innerHTML = list();
        showQr(code);
        navigator.clipboard?.writeText(inviteUrl(code)).then(() => toast('Link copied'), () => {});
      }
      const cp = e.target.closest('[data-inv-copy]');
      if (cp) navigator.clipboard?.writeText(inviteUrl(cp.dataset.invCopy)).then(() => toast('Link copied'), () => toast(inviteUrl(cp.dataset.invCopy)));
      const del = e.target.closest('[data-inv-del]');
      if (del) { save(active().filter((i) => i.code !== del.dataset.invDel)); $('#inv-list', wrap).innerHTML = list(); $('#inv-qr', wrap).hidden = true; toast('Link revoked'); }
      const qr = e.target.closest('[data-inv-qr]');
      if (qr) showQr(qr.dataset.invQr);
    },
  });
  async function showQr(code) {
    await qrReady;
    const box = $('#inv-qr', wrap);
    box.hidden = false;
    box.innerHTML = `${qrSvg(inviteUrl(code)) ?? ''}<small>${escapeHtml(inviteUrl(code))}</small>`;
  }
}

// Открыли сайт по ссылке …/#join=КОД — показать группу и предложить вступить
export async function handleJoinLink(onJoined) {
  const m = location.hash.match(/^#join=([A-Za-z0-9]{6,32})$/);
  if (!m || !state.acc) return;
  history.replaceState(null, '', location.pathname);
  try {
    const info = await api('GET', `/api/invite/${m[1]}`);
    openModal(info.type === 'channel' ? 'Join channel' : 'Join group', `
      <div class="join-card">
        ${userAvatarHtml({ name: info.name, avatar: info.avatar }, 'avatar-lg avatar-room')}
        <b>${escapeHtml(info.name)}</b>
        <small>${info.members} ${info.type === 'channel' ? 'subscribers' : 'members'}</small>
        ${info.bio ? `<p>${escapeHtml(info.bio)}</p>` : ''}
      </div>
      <button class="btn btn-primary" type="button" data-join-go>${info.type === 'channel' ? 'Join channel' : 'Join group'}</button>`, {
      onClick: async (e) => {
        if (!e.target.closest('[data-join-go]')) return;
        try {
          const r = await api('POST', '/api/join', { code: m[1] });
          closeModal();
          onJoined(r.id);
        } catch (err) { toast(err.message); }
      },
    });
  } catch (err) {
    toast(err.message);
  }
}

/* ---------------------------------------------------------------------------
   Темы в группах (форум)
   --------------------------------------------------------------------------- */
export const GENERAL = 'general';
export function topicsBarHtml(c, current, admin) {
  const topics = c.topics ?? [];
  const chip = (id, name, emoji) => `<button class="topic-chip" type="button" data-topic="${id}" aria-pressed="${current === id}">${emoji && EMOJI[emoji] ? emojiSvg(emoji, 'topic-emoji') : '#'}<span>${escapeHtml(name)}</span></button>`;
  return `${chip(GENERAL, 'General')}${topics.map((t) => chip(t.id, t.name, t.emoji)).join('')}${admin ? `<button class="topic-chip topic-add" type="button" data-topic-new aria-label="New topic">${PI.plus}</button>` : ''}`;
}
export function openTopicCreator(onCreate) {
  const EM = ['rocket', 'fire', 'heart', 'party', 'planet', 'cool', 'like', 'star'].filter((e) => EMOJI[e]);
  let pick = EM[0];
  const wrap = openModal('New topic', `
    <div class="status-emojis">${EM.map((e) => `<button class="status-pick" type="button" data-tp-emoji="${e}" aria-checked="${e === pick}">${emojiSvg(e)}</button>`).join('')}</div>
    <label class="modal-field"><span>Topic name</span><input type="text" id="tp-name" maxlength="40" placeholder="Announcements, memes, help…"></label>
    <button class="btn btn-primary" type="button" data-tp-save>Create topic</button>`, {
    onClick: (e) => {
      const em = e.target.closest('[data-tp-emoji]');
      if (em) { pick = em.dataset.tpEmoji; $$('[data-tp-emoji]', wrap).forEach((b) => b.setAttribute('aria-checked', String(b === em))); }
      if (e.target.closest('[data-tp-save]')) {
        const name = $('#tp-name', wrap).value.trim();
        if (!name) { toast('Enter a topic name'); return; }
        closeModal();
        onCreate({ id: uid(), name, emoji: pick });
      }
    },
  });
  $('#tp-name', wrap).focus();
}

/* ---------------------------------------------------------------------------
   Резервная копия переписки: зашифрованный файл (AES-GCM, ключ из пароля)
   --------------------------------------------------------------------------- */
async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function openBackup(collect) {
  const wrap = openModal('Backup', `
    <p class="pm-note">Save all your chats to an encrypted file. Only someone with the password can open it.</p>
    <label class="modal-field"><span>Password</span><input type="password" id="bk-pass" minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>
    <button class="btn btn-primary" type="button" data-bk-save>${PI.lock}Download encrypted backup</button>
    <div class="pm-divider"><span>or</span></div>
    <label class="btn btn-secondary glass bk-open">Open a backup file<input type="file" id="bk-file" accept=".kosmo,application/octet-stream" hidden></label>`, {
    onClick: async (e) => {
      if (!e.target.closest('[data-bk-save]')) return;
      const pass = $('#bk-pass', wrap).value;
      if (pass.length < 6) { toast('Password: at least 6 characters'); return; }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode(JSON.stringify(collect()));
      const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pass, salt), data);
      const file = JSON.stringify({ kosmo: 'backup', v: 1, salt: b64(salt), iv: b64(iv), data: b64(enc) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([file], { type: 'application/octet-stream' }));
      a.download = `kosmo-backup-${new Date().toISOString().slice(0, 10)}.kosmo`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Backup saved');
    },
  });
  $('#bk-file', wrap).addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const pass = $('#bk-pass', wrap).value || prompt('Backup password') || '';
    try {
      const j = JSON.parse(await f.text());
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(j.iv) }, await keyFrom(pass, unb64(j.salt)), unb64(j.data));
      showBackup(JSON.parse(new TextDecoder().decode(plain)));
    } catch {
      toast('Wrong password or damaged file');
    }
  });
}

function showBackup(b) {
  const name = (id) => b.accounts?.[id]?.name ?? 'Unknown';
  const chats = Object.values(b.chats ?? {});
  const wrap = openModal(`Backup · ${formatDate(b.exportedAt)}`, `
    <div class="bm-list">${chats.map((c) => `
      <button class="bm-row" type="button" data-bk-chat="${escapeHtml(c.id)}">
        <span class="bm-ic">${c.type ? svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6"/>') : svg('<path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z"/>')}</span>
        <span class="bm-text"><b>${escapeHtml(c.name ?? (c.saved ? 'Saved Messages' : c.members.filter((x) => x !== b.me).map(name).join(', ')))}</b><span>${c.messages.length} messages</span></span>
      </button>`).join('') || '<p class="pm-empty">No chats</p>'}</div>`, {
    onClick: (e) => {
      const r = e.target.closest('[data-bk-chat]');
      if (!r) return;
      const c = chats.find((x) => x.id === r.dataset.bkChat);
      $('.pm-body', wrap).innerHTML = `<div class="bk-msgs">${c.messages.map((m) => `
        <p class="bk-msg${m.from === b.me ? ' is-mine' : ''}"><b>${escapeHtml(name(m.from))}</b> <time>${formatDate(m.at)}</time><br>${escapeHtml(m.text ?? m.caption ?? `[${m.kind ?? 'message'}]`)}</p>`).join('')}</div>`;
    },
  });
}

/* ---------------------------------------------------------------------------
   Боты: создать, токен, пример
   --------------------------------------------------------------------------- */
export async function openBots() {
  let list = [];
  try { list = (await api('GET', '/api/bots')).bots; } catch (err) { toast(err.message); return; }
  const rows = () => list.map((b) => `
    <div class="inv-row">
      <span class="inv-ic">${PI.bot}</span>
      <span class="inv-text"><b>${escapeHtml(b.name)}</b><small>@${escapeHtml(b.username)}</small></span>
      <button class="chip-btn" type="button" data-bot-token="${b.id}">New token</button>
      <button class="icon-btn danger" type="button" data-bot-del="${b.id}" aria-label="Delete">${PI.trash}</button>
    </div>`).join('') || '<p class="pm-empty">No bots yet</p>';
  const tokenBox = (t, username) => `
    <div class="bot-token">
      <span class="modal-label">Token — keep it secret, shown once</span>
      <code id="bot-token-text">${escapeHtml(t)}</code>
      <button class="chip-btn" type="button" data-bot-copy>Copy</button>
      <span class="modal-label">Try it</span>
      <pre class="bot-example">curl ${escapeHtml(location.origin)}/api/bot/${escapeHtml(t)}/getUpdates?timeout=30
curl -X POST ${escapeHtml(location.origin)}/api/bot/${escapeHtml(t)}/sendMessage \\
  -H 'Content-Type: application/json' \\
  -d '{"chat_id":"CHAT_ID","text":"Hello from @${escapeHtml(username)}"}'</pre>
    </div>`;
  const wrap = openModal('My bots', `
    <div id="bot-list">${rows()}</div>
    <div id="bot-new-token"></div>
    <span class="modal-label">New bot</span>
    <label class="modal-field"><input type="text" id="bot-name" maxlength="64" placeholder="Name"></label>
    <label class="modal-field"><input type="text" id="bot-username" maxlength="32" placeholder="username ending with bot" autocapitalize="off" spellcheck="false"></label>
    <button class="btn btn-primary" type="button" data-bot-create>${PI.bot}Create bot</button>
    <p class="pm-note">Bots get messages people send them (getUpdates) and reply with sendMessage. Docs: GET /api/bot/&lt;token&gt;/getMe.</p>`, {
    onClick: async (e) => {
      if (e.target.closest('[data-bot-copy]')) navigator.clipboard?.writeText($('#bot-token-text', wrap).textContent).then(() => toast('Token copied'));
      try {
        if (e.target.closest('[data-bot-create]')) {
          const r = await api('POST', '/api/bots', { name: $('#bot-name', wrap).value, username: $('#bot-username', wrap).value.trim().toLowerCase() });
          list.push(r);
          $('#bot-list', wrap).innerHTML = rows();
          $('#bot-new-token', wrap).innerHTML = tokenBox(r.token, r.username);
          $('#bot-name', wrap).value = ''; $('#bot-username', wrap).value = '';
        }
        const tk = e.target.closest('[data-bot-token]');
        if (tk) {
          const r = await api('POST', `/api/bots/${tk.dataset.botToken}/token`);
          $('#bot-new-token', wrap).innerHTML = tokenBox(r.token, list.find((b) => b.id === tk.dataset.botToken)?.username ?? 'bot');
          toast('Old token no longer works');
        }
        const del = e.target.closest('[data-bot-del]');
        if (del) {
          await api('DELETE', `/api/bots/${del.dataset.botDel}`);
          list = list.filter((b) => b.id !== del.dataset.botDel);
          $('#bot-list', wrap).innerHTML = rows();
          toast('Bot deleted');
        }
      } catch (err) { toast(err.message); }
    },
  });
}

/* ---------------------------------------------------------------------------
   Расшифровка голосовых: распознавание речи браузера во время записи
   --------------------------------------------------------------------------- */
export function startTranscriber() {
  const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang() === 'ru' ? 'ru-RU' : (navigator.language || 'en-US');
  r.continuous = true;
  r.interimResults = false;
  let text = '';
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += `${e.results[i][0].transcript} `;
  };
  r.onerror = () => {};
  try { r.start(); } catch { return null; }
  return {
    stop: () => new Promise((resolve) => {
      r.onend = () => resolve(text.trim());
      try { r.stop(); } catch { resolve(text.trim()); }
      setTimeout(() => resolve(text.trim()), 1500);
    }),
  };
}
