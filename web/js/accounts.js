// Несколько аккаунтов в этом браузере (до 5): список внизу профиля,
// переключение в одно касание, «Add account» ведёт на вход, не выходя
// из текущих. Входы (токены) хранятся в localStorage.

import { $, db, tab, escapeHtml, userAvatarHtml, toast } from './core.js';
import { formatPhone } from './phone.js';

export const MAX_ACCOUNTS = 5;
const KEY = 'kosmo:tab-accounts';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* приватный режим */ } };

// Входы этого браузера; завершённые сессии отсеиваются при переключении
export function linkedAccounts() {
  return read().filter((a) => a.token);
}

// имя и номер другого аккаунта запоминаем при входе — его данных в кеше нет
function remember(t) {
  const u = db.get(t.uid);
  return u ? { ...t, name: u.name, phone: u.phone, avatar: u.avatar } : t;
}

export function rememberAccount() {
  const t = tab.get();
  if (!t) return;
  const list = linkedAccounts().filter((a) => a.uid !== t.uid);
  list.unshift(remember(t));
  write(list.slice(0, MAX_ACCOUNTS));
}

export function forgetAccount(uid) {
  write(read().filter((a) => a.uid !== uid));
}


export function accountsHtml(currentUid) {
  const list = linkedAccounts();
  const rows = list.map((a) => {
    const u = a.uid === currentUid ? db.get(a.uid) : { name: a.name ?? 'Account', phone: a.phone ?? '', avatar: a.avatar ?? {} };
    const me = a.uid === currentUid;
    const n = 0;
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
