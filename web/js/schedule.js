// Отложенные сообщения, напоминания и автоудаление (исчезающие сообщения).
// Отправку отложенных и удаление истёкших сообщений делает сервер;
// вкладка только присылает наступившие напоминания.

import { $, db, store, uid, toast, escapeHtml, formatDate, refreshRefraction } from './core.js';
import { state } from './panels.js';
import { chats } from './chats.js';

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  send: svg('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>'),
  trash: svg('<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5"/>'),
};

export const TTL_OPTIONS = [[0, 'Off'], [60, '1 min'], [3600, '1 hour'], [86400, '1 day'], [604800, '1 week']];
export const ttlLabel = (s) => TTL_OPTIONS.find(([v]) => v === s)?.[1] ?? 'Off';

/* ---------------------------------------------------------------------------
   Выбор времени
   --------------------------------------------------------------------------- */
let dlg = null;

function quick() {
  const now = new Date();
  const tonight = new Date(now); tonight.setHours(21, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
  return [
    ['In 1 minute', Date.now() + 60_000],
    ['In 10 minutes', Date.now() + 600_000],
    ['In 1 hour', Date.now() + 3_600_000],
    ...(tonight > now ? [['Tonight at 21:00', tonight.getTime()]] : []),
    ['Tomorrow at 9:00', tomorrow.getTime()],
  ];
}

export function pickTime(title, onPick) {
  closePicker();
  const local = new Date(Date.now() + 3_600_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  dlg = document.createElement('div');
  dlg.className = 'modal-wrap';
  dlg.innerHTML = `
    <div class="modal-scrim" data-tp-close></div>
    <div class="modal glass glass-text" role="dialog" aria-label="${escapeHtml(title)}">
      <header class="modal-head"><h2>${escapeHtml(title)}</h2><button class="icon-btn" type="button" data-tp-close aria-label="Close">${I.close}</button></header>
      <div class="tp-quick">${quick().map(([l, t]) => `<button class="tp-opt" type="button" data-tp="${t}">${I.clock}<span>${l}</span><small>${formatDate(t)}</small></button>`).join('')}</div>
      <label class="modal-field"><span>Or pick a date and time</span><input type="datetime-local" id="tp-custom" value="${local}"></label>
      <button class="btn btn-primary" type="button" data-tp-custom>Set</button>
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-tp-close]')) closePicker();
    const q = e.target.closest('[data-tp]');
    if (q) { closePicker(); onPick(Number(q.dataset.tp)); }
    if (e.target.closest('[data-tp-custom]')) {
      const t = new Date($('#tp-custom').value).getTime();
      if (!t || t <= Date.now()) { toast('Pick a time in the future'); return; }
      closePicker();
      onPick(t);
    }
  });
  refreshRefraction();
}

function closePicker() {
  if (!dlg) return;
  const el = dlg;
  dlg = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 200);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (dlg || list)) { e.stopImmediatePropagation(); closePicker(); closeList(); }
}, true);

/* ---------------------------------------------------------------------------
   Отложенные сообщения
   --------------------------------------------------------------------------- */
export function schedule(chatId, members, msg, sendAt) {
  const me = state.acc.user.id;
  const all = chats.all();
  const c = all[chatId] ?? { id: chatId, members, messages: [], read: {} };
  (c.scheduled ??= []).push({ id: uid(), from: me, sendAt, msg: { from: me, kind: 'text', ...msg } });
  all[chatId] = c;
  store.setJSON('chats', all);
  toast(`Scheduled for ${formatDate(sendAt)}`);
}

export const myScheduled = (c) => (c?.scheduled ?? []).filter((s) => s.from === state.acc?.user.id);

function sendNow(chatId, sid) {
  const all = chats.all();
  const c = all[chatId];
  const item = c?.scheduled?.find((s) => s.id === sid);
  if (!item) return;
  c.scheduled = c.scheduled.filter((s) => s.id !== sid);
  const m = { id: uid(), at: Date.now(), ...item.msg, scheduledAt: item.sendAt };
  if (c.ttl) m.expiresAt = m.at + c.ttl * 1000;
  c.messages.push(m);
  (c.read ??= {})[m.from] = m.at;
  store.setJSON('chats', all);
}

let list = null;
export function openScheduledList(chatId, preview) {
  closeList();
  const c = chats.get(chatId);
  const items = myScheduled(c).sort((a, b) => a.sendAt - b.sendAt);
  if (!items.length) return;
  list = document.createElement('div');
  list.className = 'modal-wrap';
  list.innerHTML = `
    <div class="modal-scrim" data-sl-close></div>
    <div class="modal glass glass-text" role="dialog" aria-label="Scheduled messages">
      <header class="modal-head"><h2>Scheduled messages</h2><button class="icon-btn" type="button" data-sl-close aria-label="Close">${I.close}</button></header>
      <ul class="sched-list">${items.map((s) => `
        <li class="sched-item">
          <span class="sched-text"><b>${formatDate(s.sendAt)}</b><span>${escapeHtml(preview(s.msg))}</span></span>
          <button class="icon-btn" type="button" data-sl-send="${s.id}" aria-label="Send now">${I.send}</button>
          <button class="icon-btn danger" type="button" data-sl-del="${s.id}" aria-label="Delete">${I.trash}</button>
        </li>`).join('')}</ul>
    </div>`;
  document.body.append(list);
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-sl-close]')) closeList();
    const s = e.target.closest('[data-sl-send]');
    if (s) { sendNow(chatId, s.dataset.slSend); changed(chatId); openScheduledList(chatId, preview); }
    const d = e.target.closest('[data-sl-del]');
    if (d) {
      chats.update(chatId, (x) => { x.scheduled = x.scheduled.filter((y) => y.id !== d.dataset.slDel); });
      changed(chatId);
      openScheduledList(chatId, preview);
    }
    if (list && !list.querySelector('.sched-item')) closeList();
  });
  refreshRefraction();
}
function closeList() {
  if (!list) return;
  const el = list;
  list = null;
  el.remove();
}

const changed = (id) => document.dispatchEvent(new CustomEvent('kosmo:chat-updated', { detail: id }));

/* ---------------------------------------------------------------------------
   Напоминания: в чат Kosmo приходит сообщение с текстом и ссылкой
   --------------------------------------------------------------------------- */
export function addReminder(chatId, msgId, text, at) {
  db.update(state.acc.user.id, (u) => { (u.reminders ??= []).push({ id: uid(), chatId, msgId, text, at }); });
  state.reload();
  toast(`I'll remind you ${formatDate(at)}`);
}

/* ---------------------------------------------------------------------------
   Тик: напоминания
   --------------------------------------------------------------------------- */
function tick() {
  if (!state.acc || $('#app').hidden) return;
  const me = state.acc.user.id;
  const now = Date.now();
  const due = (state.acc.user.reminders ?? []).filter((r) => r.at <= now);
  if (due.length) {
    db.update(me, (u) => {
      u.reminders = u.reminders.filter((r) => r.at > now);
      due.forEach((r) => u.messages.push({ id: uid(), kind: 'reminder', at: now, chatId: r.chatId, msgId: r.msgId, text: r.text }));
    });
    toast(`Reminder: ${due[0].text}`);
    navigator.vibrate?.([30, 60, 30]);
    document.dispatchEvent(new CustomEvent('kosmo:changed'));
  }
}
setInterval(tick, 3000);
