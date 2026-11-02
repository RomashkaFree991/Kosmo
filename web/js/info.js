// Канал/группа в профиле (свой и чужой) — плитка над остальными

import { escapeHtml } from './core.js';
import { mediaUrl } from './media.js';
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
  return `<button class="tile tile-wide profile-channel ripple-host" type="button" data-open-profile-channel="${c.id}">
    ${chatAvatar(c, 'avatar-sm')}
    <span class="info-ch-text"><span class="info-value">${escapeHtml(chatTitle(c))}</span>
    <span class="info-label">${c.type === 'channel' ? 'Channel' : 'Group'} · ${n} ${c.type === 'channel' ? (n === 1 ? 'subscriber' : 'subscribers') : (n === 1 ? 'member' : 'members')}</span></span>
  </button>`;
}


/* ---------- Музыка в профиле: плитка-плеер рядом с каналом ---------- */
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function profileMusicTile(u) {
  const m = u.music;
  if (!m?.media) return '';
  return `<div class="tile profile-music" data-music="${m.media}">
    <button class="pm-play" type="button" data-music-play="${m.media}" aria-label="Play"><span class="ms">play_arrow</span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>
    <span class="pm-text"><span class="info-value">${escapeHtml(m.title || 'Track')}</span><span class="info-label">${escapeHtml(m.artist || 'Music')}${m.dur ? ` · ${fmt(m.dur)}` : ''}</span></span>
    <span class="pm-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="pm-bar"><i></i></span>
  </div>`;
}
// Канал и музыка — в одну строку (плитки делят её пополам), если есть оба
export function profileExtras(u) {
  const ch = profileChannelRow(u);
  const mu = profileMusicTile(u);
  if (!ch && !mu) return '';
  return `<div class="profile-extras${ch && mu ? ' is-two' : ''}">${ch}${mu}</div>`;
}

let audio = null;
let playing = '';
function paintPlayer() {
  document.querySelectorAll('.profile-music').forEach((t) => {
    const on = t.dataset.music === playing && audio && !audio.paused;
    t.classList.toggle('is-playing', on);
    const ms = t.querySelector('.pm-play .ms');
    if (ms) ms.textContent = on ? 'pause' : 'play_arrow';
    const svg = t.querySelector('.pm-play svg path');
    if (svg) svg.setAttribute('d', on ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5.5v13l11-6.5z');
  });
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-music-play]');
  if (!b) return;
  const id = b.dataset.musicPlay;
  if (playing === id && audio) { if (audio.paused) audio.play(); else audio.pause(); paintPlayer(); return; }
  audio?.pause();
  audio = new Audio(await mediaUrl(id));
  playing = id;
  audio.addEventListener('timeupdate', () => {
    const bar = document.querySelector(`.profile-music[data-music="${id}"] .pm-bar i`);
    if (bar && audio.duration) bar.style.transform = `scaleX(${audio.currentTime / audio.duration})`;
  });
  audio.addEventListener('ended', () => { playing = ''; paintPlayer(); });
  audio.addEventListener('pause', paintPlayer);
  audio.addEventListener('play', paintPlayer);
  audio.play().catch(() => {});
});
