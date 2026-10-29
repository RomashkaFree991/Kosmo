// Свои анимированные эмодзи Kosmo (как анимированные эмодзи в Telegram):
// векторные, с градиентами и лёгкой анимацией. Для реакций и отправки в чат.

import { $ } from './core.js';

// Градиенты общие для всех эмодзи — кладём один раз в спрайт
const DEFS = `
  <radialGradient id="e-face" cx="0.42" cy="0.32" r="0.75">
    <stop offset="0" stop-color="#fff3a6"/><stop offset="0.45" stop-color="#ffd84d"/><stop offset="1" stop-color="#f4a521"/>
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
    <stop offset="0" stop-color="#9be3ff"/><stop offset="1" stop-color="#2e95ff"/>
  </linearGradient>
  <linearGradient id="e-metal" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3cedd"/>
  </linearGradient>
  <linearGradient id="e-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#ffaf00"/>
  </linearGradient>
  <linearGradient id="e-cone" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#b57bff"/><stop offset="1" stop-color="#ff4fa3"/>
  </linearGradient>
  <linearGradient id="e-hand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#f6ab2a"/>
  </linearGradient>`;

const face = '<circle cx="32" cy="33" r="27" fill="url(#e-face)"/><circle cx="32" cy="33" r="27" fill="none" stroke="#e08e12" stroke-opacity=".35" stroke-width="1.5"/>';
const ink = '#5b3412';

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

const HEART = 'M32 56C11 43 5 31 5 21 5 12 12 6 20 6c5.5 0 9.5 3 12 7.5C34.5 9 38.5 6 44 6c8 0 15 6 15 15 0 10-6 22-27 35Z';

export const EMOJI = {
  heart: {
    label: 'Heart',
    svg: `<g class="e-beat"><path d="${HEART}" fill="url(#e-heart)"/><ellipse cx="20" cy="17" rx="6" ry="4" fill="#fff" opacity=".45" transform="rotate(-30 20 17)"/></g>`,
  },
  like: {
    label: 'Like',
    svg: `<g class="e-nod">
      <rect x="8" y="30" width="11" height="27" rx="3.5" fill="#4a8df8"/>
      <path d="M21 31c3-6 7-12 9-19 1-4 7-4 8 1 1 4-1 9-2 13h15c4 0 7 3 6 7l-3 17c-1 4-4 7-8 7H21z" fill="url(#e-hand)"/>
      <path d="M38 38h13M37 45h12M36 52h10" stroke="#d88a14" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    </g>`,
  },
  fire: {
    label: 'Fire',
    svg: `<g class="e-flicker">
      <path d="M32 60C16 60 8 49 8 38c0-12 10-18 12-30 6 6 8 12 8 16 4-6 8-12 8-20 10 8 20 20 20 34 0 12-9 22-24 22Z" fill="url(#e-flame)"/>
      <path class="e-flicker-in" d="M32 58c-8 0-13-6-13-13s6-10 8-17c3 4 4 7 4 10 3-3 5-6 6-11 5 5 8 12 8 18 0 7-5 13-13 13Z" fill="url(#e-flame-in)"/>
    </g>`,
  },
  laugh: {
    label: 'Laugh',
    svg: `<g class="e-shake">${face}
      <path d="M16 27q6-7 12 0M36 27q6-7 12 0" fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M16 36h32c0 11-7 17-16 17s-16-6-16-17Z" fill="#5a2410"/>
      <path d="M18 36h28v4H18z" fill="#fff"/>
      <ellipse cx="32" cy="48" rx="8" ry="4" fill="#ff6d7a"/>
      <path class="e-tear-l" d="M9 30c-3 4-4 7-2 9s5 0 5-3-1-4-3-6Z" fill="url(#e-tear)"/>
      <path class="e-tear-r" d="M55 30c3 4 4 7 2 9s-5 0-5-3 1-4 3-6Z" fill="url(#e-tear)"/>
    </g>`,
  },
  love: {
    label: 'In love',
    svg: `${face}
      <g class="e-beat"><path d="M22 34c-7-4-9-7-9-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-7 10Z" fill="url(#e-heart)"/></g>
      <g class="e-beat e-delay"><path d="M42 34c-7-4-9-7-9-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-7 10Z" fill="url(#e-heart)"/></g>
      <path d="M21 42q11 10 22 0" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`,
  },
  wow: {
    label: 'Wow',
    svg: `${face}
      <path d="M15 19q6-4 11-1M38 18q5-3 11 1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="22" cy="28" rx="4" ry="5.5" fill="${ink}"/><ellipse cx="42" cy="28" rx="4" ry="5.5" fill="${ink}"/>
      <ellipse class="e-gasp" cx="32" cy="45" rx="6" ry="8" fill="#5a2410"/>`,
  },
  cry: {
    label: 'Sad',
    svg: `${face}
      <path d="M15 23q5 2 10-2M39 21q5 4 10 2" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      <path d="M17 31q5 3 10 0M37 31q5 3 10 0" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M23 48q9-7 18 0" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>
      <path class="e-drop" d="M44 34c-3 5-4 8-2 10s6 1 6-2-2-5-4-8Z" fill="url(#e-tear)"/>`,
  },
  cool: {
    label: 'Cool',
    svg: `${face}
      <path d="M9 25h46v3c-1 7-6 11-12 11s-10-4-11-9h0c-1 5-5 9-11 9S10 35 9 28Z" fill="#1d1d24"/>
      <path class="e-glint" d="M16 28l5-4M19 32l8-7" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
      <path d="M24 46q9 5 17-2" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`,
  },
  party: {
    label: 'Party',
    svg: `<path d="M10 58l12-34 18 18Z" fill="url(#e-cone)"/>
      <path d="M14 47l12 5M18 36l15 13" stroke="#fff" stroke-width="3" opacity=".5"/>
      <g class="e-confetti">
        <rect x="40" y="10" width="5" height="9" rx="1.5" fill="#ffcc00" transform="rotate(25 42 14)"/>
        <rect x="50" y="24" width="5" height="9" rx="1.5" fill="#4ad7a6" transform="rotate(-30 52 28)"/>
        <circle cx="31" cy="12" r="3.2" fill="#ff5f7a"/><circle cx="54" cy="40" r="3" fill="#6aa8ff"/>
        <path d="M44 30q4-3 8 0t8 0" fill="none" stroke="#b57bff" stroke-width="2.4" stroke-linecap="round"/>
      </g>`,
  },
  rocket: {
    label: 'Rocket',
    svg: `<g class="e-hover"><g transform="rotate(45 32 32)">
      <path class="e-thrust" d="M26 44q6 20 12 0Z" fill="url(#e-flame)"/>
      <path d="M32 4c9 9 11 22 8 38H24c-3-16-1-29 8-38Z" fill="url(#e-metal)"/>
      <path d="M24 34l-8 11 9-1zM40 34l8 11-9-1z" fill="#ff4d6d"/>
      <circle cx="32" cy="22" r="5" fill="#4aa8ff" stroke="#2b4c7e" stroke-width="2"/>
    </g></g>`,
  },
  star: {
    label: 'Star',
    svg: `<g class="e-twinkle"><path d="${starPath(32, 34, 27, 12)}" fill="url(#e-gold)" stroke="#ffb000" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 26l4-5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>`,
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
