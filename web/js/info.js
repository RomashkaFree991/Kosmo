// Блок сведений профиля (свой и чужой): значение крупно, подпись под ним

import { escapeHtml } from './core.js';
import { chats, chatAvatar, chatTitle } from './chats.js';

// Один блок «как в Telegram»: значение крупно, подпись под ним
export function infoRow(value, label, attrs = '', multi = false) {
  const tag = attrs ? 'button' : 'div';
  return `<${tag} class="info-row${multi ? ' is-multi' : ''}${attrs ? ' ripple-host' : ''}" ${attrs}${attrs ? ' type="button"' : ''}>
    <span class="info-value">${value}</span><span class="info-label">${label}</span>
  </${tag}>`;
}

// Канал или группа в профиле: только публичная, где человек владелец
export function profileChannelRow(u) {
  const c = u.profileChannel ? chats.get(u.profileChannel) : null;
  if (!c || !c.username) return '';
  const n = (c.members ?? []).length;
  return `<button class="info-row info-channel ripple-host" type="button" data-open-profile-channel="${c.id}">
    ${chatAvatar(c, 'avatar-sm')}
    <span class="info-ch-text"><span class="info-value">${escapeHtml(chatTitle(c))}</span>
    <span class="info-label">${c.type === 'channel' ? 'Channel' : 'Group'} · ${n} ${c.type === 'channel' ? (n === 1 ? 'subscriber' : 'subscribers') : (n === 1 ? 'member' : 'members')}</span></span>
  </button>`;
}

