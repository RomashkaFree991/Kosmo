// Свои анимированные эмодзи Kosmo: векторные, с градиентами и лёгкой
// анимацией. Для реакций и отправки в чат.

import { $ } from './core.js';

// Градиенты и маски общие для всех эмодзи — кладём один раз в спрайт
const DEFS = `
  <radialGradient id="e-face" cx="0.45" cy="0.35" r="0.72">
    <stop offset="0" stop-color="#fff59d"/><stop offset="0.5" stop-color="#ffd43b"/><stop offset="1" stop-color="#f7a21b"/>
  </radialGradient>
  <linearGradient id="e-heart" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ff7a93"/><stop offset="1" stop-color="#e3123e"/>
  </linearGradient>
  <linearGradient id="e-flame" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffb22e"/><stop offset="1" stop-color="#ff3d1f"/>
  </linearGradient>
  <linearGradient id="e-flame-in" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#ffc533"/>
  </linearGradient>
  <linearGradient id="e-tear" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b6ecff"/><stop offset="1" stop-color="#3a9bff"/>
  </linearGradient>
  <linearGradient id="e-metal" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c8d2e0"/>
  </linearGradient>
  <linearGradient id="e-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#ffaf00"/>
  </linearGradient>
  <linearGradient id="e-cone" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#8f5bff"/><stop offset="1" stop-color="#ff4fa3"/>
  </linearGradient>
  <linearGradient id="e-hand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f5a623"/>
  </linearGradient>
  <clipPath id="e-cone-clip"><path d="M8 57L19 26 39 46Z"/></clipPath>`;

const INK = '#4a2a0e';
const MOUTH = '#4a1c0a';
// Общая основа лица: круг, лёгкая тень снизу и блик сверху
const FACE = `
  <circle cx="32" cy="32" r="28" fill="url(#e-face)"/>
  <path d="M8.5 38A24 24 0 0 0 55.5 38 28 28 0 0 1 8.5 38Z" fill="#e8860f" opacity=".22"/>
  <ellipse cx="22" cy="14" rx="9" ry="4.5" fill="#fff" opacity=".4" transform="rotate(-24 22 14)"/>`;
const line = (d, w = 3.4) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const tear = (x, y, rot = 0, cls = '', s = 1) =>
  `<g class="${cls}"><path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0-7C2.6-3 5 0 5 2.6A5 5 0 0 1-5 2.6C-5 0-2.6-3 0-7Z" fill="url(#e-tear)"/></g>`;

const HEART = 'M32 56C11 43 5 31 5 21 5 12 12 6 20 6c5.5 0 9.5 3 12 7.5C34.5 9 38.5 6 44 6c8 0 15 6 15 15 0 10-6 22-27 35Z';
const smallHeart = (x, y, s, cls = '') =>
  `<g class="${cls}"><path transform="translate(${x - 32 * s} ${y - 31 * s}) scale(${s})" d="${HEART}" fill="url(#e-heart)"/></g>`;

// 5-конечная звезда
function starPath(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export const EMOJI = {
  heart: {
    label: 'Heart',
    svg: `<g class="e-beat"><path d="${HEART}" fill="url(#e-heart)"/>
      <ellipse cx="19" cy="17" rx="6.5" ry="4" fill="#fff" opacity=".45" transform="rotate(-32 19 17)"/></g>`,
  },
  like: {
    label: 'Like',
    svg: `<g class="e-nod">
      <rect x="7" y="29" width="12" height="28" rx="3.5" fill="#3d7bf2"/>
      <rect x="9.5" y="31.5" width="3" height="23" rx="1.5" fill="#fff" opacity=".3"/>
      <path d="M21 32H28C30.5 26 33 20 33 13 33 8.5 39.5 7.5 40.5 13 41.5 18.5 39.5 25 38.5 30H52C55.5 30 58 33 57 36.5L53 52C52.2 55 49.6 57 46.5 57H21Z" fill="url(#e-hand)" stroke="#d98e14" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M39 37.5H55M39 44.5H53.5M39 51H51" stroke="#d98e14" stroke-width="1.7" stroke-linecap="round" opacity=".55"/>
      <path d="M36.5 12.5C36.5 18 35 22.5 33 26.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    </g>`,
  },
  fire: {
    label: 'Fire',
    svg: `<ellipse cx="32" cy="58" rx="16" ry="3" fill="#ff7a1f" opacity=".25"/>
      <g class="e-flicker">
      <path d="M32 60C16 60 8 49 8 38c0-12 10-18 12-30 6 6 8 12 8 16 4-6 8-12 8-20 10 8 20 20 20 34 0 12-9 22-24 22Z" fill="url(#e-flame)"/>
      <path class="e-flicker-in" d="M32 58c-8 0-13-6-13-13s6-10 8-17c3 4 4 7 4 10 3-3 5-6 6-11 5 5 8 12 8 18 0 7-5 13-13 13Z" fill="url(#e-flame-in)"/>
    </g>`,
  },
  laugh: {
    label: 'Laugh',
    svg: `<g class="e-shake">${FACE}
      ${line('M16 26Q21 20 26 26')}${line('M38 26Q43 20 48 26')}
      <path d="M15 34H49C49 46 41 53 32 53S15 46 15 34Z" fill="${MOUTH}"/>
      <path d="M17.5 34H46.5C46.3 36.6 45.6 38.2 44.8 39H19.2C18.4 38.2 17.7 36.6 17.5 34Z" fill="#fff"/>
      <path d="M24 48.5C27 44.5 37 44.5 40 48.5 37 51.8 27 51.8 24 48.5Z" fill="#ff5f6d"/>
      ${tear(10.5, 30, 38, 'e-tear-l')}${tear(53.5, 30, -38, 'e-tear-r')}
    </g>`,
  },
  love: {
    label: 'In love',
    svg: `${FACE}
      ${smallHeart(21.5, 27, 0.3, 'e-beat')}${smallHeart(42.5, 27, 0.3, 'e-beat e-delay')}
      <path d="M19 39C23.5 50.5 40.5 50.5 45 39Z" fill="${MOUTH}"/>
      <path d="M22 39.5H42C41.6 41 41 42 40.3 42.5H23.7C23 42 22.4 41 22 39.5Z" fill="#fff"/>`,
  },
  wow: {
    label: 'Wow',
    svg: `${FACE}
      ${line('M15.5 18Q21 13.5 27 16.5', 3)}${line('M37 16.5Q43 13.5 48.5 18', 3)}
      <ellipse cx="22" cy="28" rx="3.8" ry="5" fill="${INK}"/><ellipse cx="42" cy="28" rx="3.8" ry="5" fill="${INK}"/>
      <circle cx="23.2" cy="26.2" r="1.3" fill="#fff"/><circle cx="43.2" cy="26.2" r="1.3" fill="#fff"/>
      <ellipse class="e-gasp" cx="32" cy="44.5" rx="6.5" ry="8" fill="${MOUTH}"/>`,
  },
  cry: {
    label: 'Sad',
    svg: `${FACE}
      ${line('M15 21Q20.5 21.5 26 17', 3)}${line('M38 17Q43.5 21.5 49 21', 3)}
      ${line('M17 30Q22 34 27 30')}${line('M37 30Q42 34 47 30')}
      ${line('M23 47.5Q32 40.5 41 47.5')}
      <path d="M19.5 33V45" stroke="#7fcbff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
      ${tear(19.5, 47, 0, 'e-drop', 0.9)}`,
  },
  cool: {
    label: 'Cool',
    svg: `${FACE}
      <path d="M9 24.5H55" stroke="#1d1d26" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M12 24.5H29.5V30C29.5 35 26 38.5 21 38.5S12 35 12 30Z" fill="#1d1d26"/>
      <path d="M34.5 24.5H52V30C52 35 48.5 38.5 43.5 38.5S34.5 35 34.5 30Z" fill="#1d1d26"/>
      <g class="e-glint"><path d="M16 29.5L20.5 26M18.5 33.5L25 27.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></g>
      ${line('M24 46.5Q33.5 51 41.5 44')}`,
  },
  party: {
    label: 'Party',
    svg: `<path d="M8 57L19 26 39 46Z" fill="url(#e-cone)" stroke="#7a3ff0" stroke-width="1.5" stroke-linejoin="round"/>
      <g clip-path="url(#e-cone-clip)" opacity=".55">
        <path d="M5 44L30 56M10 33L37 47" stroke="#fff" stroke-width="3.2"/>
      </g>
      <ellipse cx="29" cy="36" rx="14" ry="3.6" fill="#ffd166" transform="rotate(45 29 36)"/>
      <g class="e-confetti">
        <rect x="38" y="8" width="5" height="9" rx="1.5" fill="#ffcc00" transform="rotate(25 40 12)"/>
        <rect x="50" y="22" width="5" height="9" rx="1.5" fill="#4ad7a6" transform="rotate(-30 52 26)"/>
        <circle cx="29" cy="12" r="3.2" fill="#ff5f7a"/><circle cx="55" cy="40" r="3" fill="#6aa8ff"/>
        <circle cx="46" cy="14" r="2.2" fill="#b57bff"/>
        <path d="M30 22C34 14 39 20 43 12" fill="none" stroke="#ffcc00" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M41 32C49 30 47 24 56 22" fill="none" stroke="#4ad7a6" stroke-width="2.4" stroke-linecap="round"/>
      </g>`,
  },
  rocket: {
    label: 'Rocket',
    svg: `<g class="e-hover"><g transform="translate(32 32) rotate(45) scale(1.02) translate(-32 -32)">
      <path class="e-thrust" d="M27 44Q32 63 37 44Z" fill="url(#e-flame)"/>
      <rect x="26" y="40" width="12" height="4.5" rx="1.5" fill="#8a96a8"/>
      <path d="M32 4C41 12 43 24 41 40H23C21 24 23 12 32 4Z" fill="url(#e-metal)"/>
      <path d="M32 4C36 7.5 38.6 11.5 39.8 16H24.2C25.4 11.5 28 7.5 32 4Z" fill="#ff4d6d"/>
      <path d="M23 31L14 43 23 41ZM41 31L50 43 41 41Z" fill="#ff4d6d" stroke-linejoin="round"/>
      <circle cx="32" cy="25" r="5.5" fill="#4aa8ff" stroke="#2b4c7e" stroke-width="2.2"/>
      <circle cx="30.3" cy="23.3" r="1.6" fill="#fff" opacity=".8"/>
    </g></g>`,
  },
  star: {
    label: 'Star',
    svg: `<g class="e-twinkle"><path d="${starPath(32, 34, 27, 12)}" fill="url(#e-gold)" stroke="#ffb000" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22.5 25.5l4-5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>`,
  },
  planet: {
    label: 'Kosmo',
    svg: `<g transform="rotate(-18 32 32)"><path d="M3 32A29 8 0 0 1 61 32" fill="none" stroke="url(#k-ring)" stroke-width="3.5" stroke-linecap="round"/></g>
      <circle cx="32" cy="32" r="16" fill="url(#k-fill)"/><circle cx="32" cy="32" r="16" fill="url(#k-shade)"/>
      <g transform="rotate(-18 32 32)"><path d="M3 32A29 8 0 0 0 61 32" fill="none" stroke="url(#k-ring)" stroke-width="3.5" stroke-linecap="round"/></g>
      <circle class="e-spark" cx="54" cy="12" r="2.4" fill="#fff"/><circle class="e-spark e-delay" cx="10" cy="52" r="1.8" fill="#fff"/>`,
  },
};

export const REACTIONS = ['heart', 'like', 'fire', 'laugh', 'wow', 'cry', 'party', 'rocket'];
export const EMOJI_IDS = Object.keys(EMOJI);

export function emojiSvg(id, cls = '') {
  const e = EMOJI[id];
  if (!e) return '';
  return `<svg class="emoji ${cls}" viewBox="0 0 64 64" role="img" aria-label="${e.label}">${e.svg}</svg>`;
}

export function initEmoji() {
  $('.sprite defs').insertAdjacentHTML('beforeend', DEFS);
}
