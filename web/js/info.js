// Канал/группа в профиле (свой и чужой) — плитка над остальными

import { escapeHtml, db } from './core.js';
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


/* ---------- Музыка в профиле: плитка рядом с каналом и полноэкранный плеер ---------- */
export const tracksOf = (u) => (Array.isArray(u?.music) ? u.music : u?.music?.media ? [u.music] : []);
const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const NOTE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>';
const PLAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4a1 1 0 0 0 1.5.86l10-6.2a1 1 0 0 0 0-1.72l-10-6.2A1 1 0 0 0 8 5.8z" fill="currentColor" stroke="none"/></svg>';
const PAUSE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/></svg>';
const PREV = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12" stroke-width="2.4"/><path d="M19 6.5v11a.8.8 0 0 1-1.2.7l-9-5.5a.8.8 0 0 1 0-1.4l9-5.5a.8.8 0 0 1 1.2.7z" fill="currentColor" stroke="none"/></svg>';
const NEXT = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12" stroke-width="2.4"/><path d="M5 6.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 5 6.5z" fill="currentColor" stroke="none"/></svg>';

export function profileMusicTile(u) {
  const list = tracksOf(u);
  if (!list.length) return '';
  const m = list[0];
  return `<div class="tile profile-music" data-music-owner="${u.id}" data-music="${m.media}" role="button" tabindex="0" aria-label="Open player">
    <button class="pm-play" type="button" data-music-play="${u.id}" aria-label="Play"><span class="ms">play_arrow</span>${PLAY}</button>
    <span class="pm-text"><span class="info-value">${escapeHtml(m.title || 'Track')}</span><span class="info-label">${escapeHtml(m.artist || 'Music')}${list.length > 1 ? ` · ${list.length} tracks` : m.dur ? ` · ${fmt(m.dur)}` : ''}</span></span>
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

// Один плеер на всё приложение
const P = { audio: null, owner: null, list: [], i: 0, sheet: null };
const cur = () => P.list[P.i];
const playing = () => P.audio && !P.audio.paused;

function paintAll() {
  const on = playing();
  document.querySelectorAll('.profile-music').forEach((t) => {
    const mine = t.dataset.musicOwner === P.owner;
    t.classList.toggle('is-playing', mine && on);
    const ms = t.querySelector('.pm-play .ms');
    if (ms) ms.textContent = mine && on ? 'pause' : 'play_arrow';
    const b = t.querySelector('.pm-play');
    if (b) b.querySelector('svg').outerHTML = mine && on ? PAUSE : PLAY;
    if (mine && cur()) {
      t.querySelector('.pm-text .info-value').textContent = cur().title || 'Track';
    }
  });
  const sh = P.sheet;
  if (!sh) return;
  const t = cur();
  sh.querySelector('.mp-title').textContent = t?.title || 'Track';
  sh.querySelector('.mp-artist').textContent = t?.artist || 'Music';
  sh.querySelector('[data-mp="toggle"]').innerHTML = on ? PAUSE : PLAY;
  sh.classList.toggle('is-playing', on);
  sh.querySelectorAll('.mp-item').forEach((el, i) => el.classList.toggle('is-on', i === P.i));
  sh.querySelector('[data-mp="prev"]').disabled = P.list.length < 2;
  sh.querySelector('[data-mp="next"]').disabled = P.list.length < 2;
}
function paintTime() {
  const a = P.audio;
  if (!a) return;
  const d = a.duration || cur()?.dur || 0;
  document.querySelectorAll(`.profile-music[data-music-owner="${P.owner}"] .pm-bar i`).forEach((b) => { b.style.transform = `scaleX(${d ? a.currentTime / d : 0})`; });
  const sh = P.sheet;
  if (!sh || sh.dataset.seeking) return;
  sh.querySelector('.mp-seek').value = d ? String((a.currentTime / d) * 1000) : '0';
  sh.querySelector('.mp-seek').style.setProperty('--p', `${d ? (a.currentTime / d) * 100 : 0}%`);
  sh.querySelector('.mp-now').textContent = fmt(a.currentTime);
  sh.querySelector('.mp-dur').textContent = fmt(d);
}

async function playIndex(i) {
  if (!P.list.length) return;
  P.i = (i + P.list.length) % P.list.length;
  P.audio?.pause();
  const a = new Audio(await mediaUrl(cur().media));
  P.audio = a;
  a.addEventListener('timeupdate', paintTime);
  a.addEventListener('loadedmetadata', paintTime);
  a.addEventListener('play', paintAll);
  a.addEventListener('pause', paintAll);
  a.addEventListener('ended', () => { if (P.list.length > 1) playIndex(P.i + 1); else { a.currentTime = 0; paintAll(); } });
  a.play().catch(() => {});
  paintAll();
  paintTime();
}
function load(owner, list) {
  if (P.owner === owner && P.list.length) return false;
  P.audio?.pause();
  P.audio = null;
  P.owner = owner;
  P.list = list;
  P.i = 0;
  return true;
}
function toggle() {
  if (!P.audio) { playIndex(P.i); return; }
  if (P.audio.paused) P.audio.play(); else P.audio.pause();
}

// Почти полноэкранный плеер: обложка, перемотка, назад/пауза/вперёд, список треков
function openPlayer(owner, list, name) {
  if (load(owner, list)) playIndex(0);
  P.sheet?.remove();
  const el = document.createElement('div');
  el.className = 'mp-wrap';
  el.innerHTML = `
    <div class="mp-scrim" data-mp="close"></div>
    <section class="mp-sheet" role="dialog" aria-label="Music player">
      <span class="mp-grab" data-mp="close"></span>
      <p class="mp-owner">${escapeHtml(name || '')}</p>
      <div class="mp-art">${NOTE}<span class="mp-eq"><i></i><i></i><i></i><i></i><i></i></span></div>
      <div class="mp-meta"><b class="mp-title"></b><span class="mp-artist"></span></div>
      <input class="mp-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
      <div class="mp-times"><span class="mp-now">0:00</span><span class="mp-dur">0:00</span></div>
      <div class="mp-ctrl">
        <button class="mp-btn" type="button" data-mp="prev" aria-label="Previous">${PREV}</button>
        <button class="mp-btn mp-main" type="button" data-mp="toggle" aria-label="Play">${PLAY}</button>
        <button class="mp-btn" type="button" data-mp="next" aria-label="Next">${NEXT}</button>
      </div>
      ${list.length > 1 ? `<div class="mp-list">${list.map((t, i) => `<button class="mp-item" type="button" data-mp-i="${i}"><span class="mp-n">${i + 1}</span><span class="mp-it"><b>${escapeHtml(t.title || 'Track')}</b><small>${escapeHtml(t.artist || '')}</small></span><span class="mp-d">${t.dur ? fmt(t.dur) : ''}</span></button>`).join('')}</div>` : ''}
    </section>`;
  document.body.append(el);
  P.sheet = el;
  const seek = el.querySelector('.mp-seek');
  seek.addEventListener('input', () => {
    el.dataset.seeking = '1';
    const d = P.audio?.duration || cur()?.dur || 0;
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    el.querySelector('.mp-now').textContent = fmt((seek.value / 1000) * d);
  });
  seek.addEventListener('change', () => {
    const d = P.audio?.duration || 0;
    if (P.audio && d) P.audio.currentTime = (seek.value / 1000) * d;
    delete el.dataset.seeking;
  });
  el.addEventListener('click', (e) => {
    const it = e.target.closest('[data-mp-i]');
    if (it) { playIndex(Number(it.dataset.mpI)); return; }
    const a = e.target.closest('[data-mp]')?.dataset.mp;
    if (a === 'close') { el.classList.add('is-closing'); setTimeout(() => { el.remove(); if (P.sheet === el) P.sheet = null; }, 260); }
    if (a === 'toggle') toggle();
    if (a === 'prev') playIndex(P.audio && P.audio.currentTime > 3 ? P.i : P.i - 1);
    if (a === 'next') playIndex(P.i + 1);
  });
  // свайп вниз — закрыть
  let y0 = null;
  const sheet = el.querySelector('.mp-sheet');
  sheet.addEventListener('pointerdown', (e) => { if (!e.target.closest('input, button')) y0 = e.clientY; });
  sheet.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 90) el.querySelector('.mp-grab').click(); y0 = null; });
  paintAll();
  paintTime();
}

document.addEventListener('click', (e) => {
  const tile = e.target.closest('.profile-music');
  if (!tile) return;
  const owner = tile.dataset.musicOwner;
  const u = db.get(owner);
  const list = tracksOf(u);
  if (!list.length) return;
  if (e.target.closest('[data-music-play]')) {
    if (load(owner, list)) playIndex(0); else toggle();
    return;
  }
  openPlayer(owner, list, u?.name);
});

/* ---------- Баннер профиля: фото или видео сверху ---------- */
export function bannerHtml(u) {
  const b = u?.banner;
  if (!b?.media) return '';
  return `<div class="hero-banner" aria-hidden="true">${b.type === 'video'
    ? `<video data-media="${b.media}" muted autoplay loop playsinline disablepictureinpicture${b.poster ? '' : ''}></video>`
    : `<img data-media="${b.media}" alt="">`}</div>`;
}
