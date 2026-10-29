// Несколько аккаунтов в одной вкладке (до 5): список внизу профиля,
// переключение в одно касание, «Add account» ведёт на вход, не выходя
// из текущих. Список живёт столько же, сколько вход вкладки (sessionStorage).

import { $, db, tab, escapeHtml, userAvatarHtml, toast } from './core.js';
import { formatPhone } from './phone.js';

export const MAX_ACCOUNTS = 5;
const KEY = 'kosmo:tab-accounts';

const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) ?? []; } catch { return []; } };
const write = (list) => { try { sessionStorage.setItem(KEY, JSON.stringify(list)); } catch { /* приватный режим */ } };

// Только живые входы: сессию могли завершить с другого устройства
export function linkedAccounts() {
  const list = read().filter((a) => db.get(a.uid)?.sessions.some((s) => s.id === a.sid));
  write(list);
  return list;
}

export function rememberAccount() {
  const t = tab.get();
  if (!t) return;
  const list = linkedAccounts().filter((a) => a.uid !== t.uid);
  list.unshift(t);
  write(list.slice(0, MAX_ACCOUNTS));
}

export function forgetAccount(uid) {
  write(read().filter((a) => a.uid !== uid));
}

// Непрочитанное у другого аккаунта — для бейджа в списке
function unreadFor(uid) {
  const all = JSON.parse(localStorage.getItem('kosmo:chats') || '{}');
  return Object.values(all).filter((c) => c.members.includes(uid))
    .reduce((n, c) => n + c.messages.filter((m) => m.from !== uid && m.at > (c.read?.[uid] ?? 0) && !m.threadOf).length, 0);
}

export function accountsHtml(currentUid) {
  const list = linkedAccounts();
  const rows = list.map((a) => {
    const u = db.get(a.uid);
    const me = a.uid === currentUid;
    const n = me ? 0 : unreadFor(a.uid);
    return `
      <button class="group-row group-row-btn account-row${me ? ' is-current' : ''}" type="button" ${me ? 'disabled' : `data-switch-account="${a.uid}"`}>
        ${userAvatarHtml(u, 'avatar-xs')}
        <span class="row-text"><b>${escapeHtml(u.name)}</b><small>${escapeHtml(formatPhone(u.phone))}</small></span>
        ${me ? '<svg class="i account-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : n ? `<span class="badge">${n}</span>` : ''}
      </button>`;
  }).join('');
  const add = list.length < MAX_ACCOUNTS
    ? `<button class="group-row group-row-btn ripple-host" type="button" data-add-account>
        <span class="row-icon"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span class="row-text">Add account</span>
      </button>`
    : `<div class="group-row"><span class="row-text tile-muted">Maximum ${MAX_ACCOUNTS} accounts</span></div>`;
  return `<p class="section-label">Accounts · ${list.length}/${MAX_ACCOUNTS}</p><section class="group accounts-group" aria-label="Accounts">${rows}${add}</section>`;
}

document.addEventListener('click', (e) => {
  const sw = e.target.closest('[data-switch-account]');
  if (sw) {
    const target = linkedAccounts().find((a) => a.uid === sw.dataset.switchAccount);
    if (!target) { toast('This session was terminated'); return; }
    document.dispatchEvent(new CustomEvent('kosmo:switch-account', { detail: target }));
  }
  if (e.target.closest('[data-add-account]')) {
    if (linkedAccounts().length >= MAX_ACCOUNTS) { toast(`Maximum ${MAX_ACCOUNTS} accounts`); return; }
    document.dispatchEvent(new CustomEvent('kosmo:add-account'));
  }
  if (e.target.closest('#auth-cancel')) {
    const back = linkedAccounts()[0];
    if (back) document.dispatchEvent(new CustomEvent('kosmo:switch-account', { detail: back }));
  }
});

// Кнопка «назад к аккаунту» на экране входа, когда добавляют ещё один
export function paintAuthCancel() {
  const btn = $('#auth-cancel');
  if (btn) btn.hidden = !linkedAccounts().length || Boolean(tab.get());
}
