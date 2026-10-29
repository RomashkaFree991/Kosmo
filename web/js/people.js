// Профиль собеседника: открывается из чата поверх него.
// Номер и био показываются, только если человек их не скрыл.

import { $, db, toast, escapeHtml, userAvatarHtml, cosmicBadge } from './core.js';
import { openOverlay, closeOverlay } from './panels.js';
import { formatPhone } from './phone.js';
import { hydrateMedia } from './media.js';

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  at: svg('<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/>'),
  hash: svg('<path d="M9.5 4l-2 16M16.5 4l-2 16M4.5 9h16M3.5 15h16"/>'),
  call: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  quote: svg('<path d="M5 6.5h14M5 11h14M5 15.5h9"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  chat: svg('<path d="M20 11.5a7.5 7 0 0 1-10.9 6.2L4 19l1.4-4A7 7 0 0 1 4.5 11.5 7.5 7 0 0 1 20 11.5z"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
};
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

const tile = (icon, label, value, attrs = '', wide = false) => `
  <${attrs ? 'button' : 'div'} class="tile${wide ? ' tile-wide' : ''}" ${attrs}${attrs ? ' type="button"' : ''}>
    <span class="tile-icon">${icon}</span><span class="tile-label">${label}</span><span class="tile-value">${value}</span>
  </${attrs ? 'button' : 'div'}>`;

let shown = null;

export function showUser(userId) {
  const u = db.get(userId);
  if (!u) { toast('This account was deleted'); return; }
  shown = u;
  const p = u.privacy ?? {};
  $('#user-profile').innerHTML = `
    <section class="profile-hero">
      <div class="hero-avatar">
        <span class="hero-orbit" aria-hidden="true"></span>
        ${userAvatarHtml(u, 'avatar-hero')}
      </div>
      <h2 class="profile-name"><span>${escapeHtml(u.name)}</span>${u.role === 'owner' ? cosmicBadge('owner') : ''}</h2>
      <button class="pill-btn" type="button" data-close-overlay>${ICON.chat}Message</button>
    </section>
    <section class="tiles" aria-label="Account">
      ${u.username ? tile(ICON.at, 'Username', `@${escapeHtml(u.username)}`, 'data-copy-user="username"') : ''}
      ${tile(ICON.hash, 'ID', escapeHtml(u.publicId), 'data-copy-user="id"')}
      ${p.hidePhone ? tile(ICON.lock, 'Phone', 'Hidden') : tile(ICON.call, 'Phone', escapeHtml(formatPhone(u.phone)), '', true)}
      ${u.bio && !p.hideBio ? tile(ICON.quote, 'Bio', escapeHtml(u.bio), '', true) : ''}
      ${tile(ICON.calendar, 'Joined', monthYear.format(u.createdAt))}
    </section>`;
  hydrateMedia($('#user-profile'));
  openOverlay('user');
}

document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy-user]');
  if (!c || !shown) return;
  const value = c.dataset.copyUser === 'id' ? shown.publicId : `@${shown.username}`;
  try {
    await navigator.clipboard.writeText(value);
    toast(c.dataset.copyUser === 'id' ? 'ID copied' : 'Username copied');
  } catch {
    toast(value);
  }
});

export { closeOverlay };
