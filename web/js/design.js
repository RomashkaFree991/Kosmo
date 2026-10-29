// Оформление: обои в цветах выбранной палитры (как в Material You),
// формы аватарок из библиотеки форм Material 3 и панель «Designs»
// с живым превью списка чатов и переписки.

import {
  $, $$, root, store, kosmoAvatar, userAvatarHtml, reducedMotion, refreshRefraction, initials, escapeHtml, avatarStyle,
} from './core.js';
import { KOSMO_NAME } from './chats.js';
import { state, openPanel, panelOpen } from './panels.js';
import { paintSwatches } from './color.js';

/* ---------------------------------------------------------------------------
   Формы Material 3 (cookie, clover, flower…): строим контур по полярной
   функции и кладём как <clipPath> в общий спрайт
   --------------------------------------------------------------------------- */
const wave = (n, a) => (t) => 1 + a * Math.cos(n * t);
const SHAPES = {
  circle: { label: 'Circle', r: () => 1 },
  squircle: { label: 'Square', squircle: 5 },
  cookie4: { label: '4-sided cookie', r: wave(4, 0.07) },
  cookie7: { label: '7-sided cookie', r: wave(7, 0.065) },
  cookie9: { label: '9-sided cookie', r: wave(9, 0.055) },
  cookie12: { label: '12-sided cookie', r: wave(12, 0.04) },
  clover: { label: '4-leaf clover', r: wave(4, 0.24) },
  flower: { label: 'Flower', r: wave(8, 0.12) },
};
export const SHAPE_IDS = Object.keys(SHAPES);

function shapePoints(shape, samples = 200) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2 - Math.PI / 2;
    if (shape.squircle) {
      const e = 2 / shape.squircle;
      pts.push([Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** e, Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** e]);
    } else {
      const r = shape.r(t);
      pts.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
  }
  const max = Math.max(...pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  return pts.map(([x, y]) => [x / max, y / max]);
}

// Контур в координатах (cx, cy, радиус)
function shapePath(id, cx = 0.5, cy = 0.5, rad = 0.5) {
  return `M${shapePoints(SHAPES[id]).map(([x, y]) => `${(cx + x * rad).toFixed(4)} ${(cy + y * rad).toFixed(4)}`).join('L')}Z`;
}

function injectShapes() {
  const defs = $('.sprite defs');
  defs.insertAdjacentHTML('beforeend', SHAPE_IDS.map((id) =>
    `<clipPath id="shape-${id}" clipPathUnits="objectBoundingBox"><path d="${shapePath(id)}"/></clipPath>`).join(''));
}

/* ---------------------------------------------------------------------------
   Обои: рисуются переменными --wp-*, которые считает color.js из палитры
   --------------------------------------------------------------------------- */
export const WALLPAPERS = { black: 'Black', shapes: 'Cosmos', waves: 'Waves', glow: 'Glow' };
let wpCount = 0;

function wallpaperSvg(kind) {
  if (kind === 'black') return '';
  const n = ++wpCount;
  const anim = !reducedMotion.matches;
  const head = '<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="390" height="844" style="fill:var(--wp-bg)"/>';
  if (kind === 'shapes') {
    // «Космос» в формах Material 3: планета с кольцом, орбита с луной,
    // клевер и пилюля, мерцающие звёзды-искры
    const star = (x, y, r, fill, delay) => `
      <path transform="translate(${x} ${y}) scale(${r / 10})" d="M0-10C1.4-1.4 1.4-1.4 10 0 1.4 1.4 1.4 1.4 0 10-1.4 1.4-1.4 1.4-10 0-1.4-1.4-1.4-1.4 0-10Z" style="fill:var(${fill})">
        ${anim ? `<animate attributeName="opacity" values="1;.25;1" dur="4s" begin="${delay}s" repeatCount="indefinite"/>` : ''}
      </path>`;
    const orbit = 'M-40 520C40 380 330 330 430 400';
    return `${head}
      <g transform="rotate(-32 70 120)"><rect x="-90" y="70" width="300" height="118" rx="59" style="fill:var(--wp-a)"/></g>
      <g class="wp-spin" style="transform-origin:318px 250px"><path d="${shapePath('clover', 318, 250, 74)}" style="fill:var(--wp-b)"/></g>
      <path d="${shapePath('cookie7', 74, 610, 40)}" style="fill:var(--wp-b);opacity:.75"/>
      <path id="wp-orbit-${n}" d="${orbit}" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 11" style="stroke:var(--wp-line);opacity:.55"/>
      <circle r="10" style="fill:var(--wp-dot2)" ${anim ? '' : 'cx="190" cy="392"'}>
        ${anim ? `<animateMotion dur="22s" repeatCount="indefinite" keyPoints="0.15;0.85;0.15" keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"><mpath href="#wp-orbit-${n}"/></animateMotion>` : ''}
      </circle>
      <g transform="rotate(-16 290 720)"><path d="M120 720A170 34 0 0 1 460 720" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--wp-line);opacity:.4"/></g>
      <circle cx="290" cy="720" r="118" style="fill:var(--wp-a)"/>
      <circle cx="252" cy="680" r="20" style="fill:var(--wp-bg);opacity:.35"/>
      <circle cx="318" cy="752" r="12" style="fill:var(--wp-bg);opacity:.3"/>
      <g transform="rotate(-16 290 720)"><path d="M120 720A170 34 0 0 0 460 720" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--wp-line);opacity:.65"/></g>
      ${star(196, 132, 11, '--wp-dot2', 0)}${star(58, 330, 7, '--wp-dot', 1.2)}${star(350, 470, 9, '--wp-dot2', 2.1)}
      ${star(150, 560, 6, '--wp-dot', 0.6)}${star(250, 40, 6, '--wp-dot', 2.8)}${star(40, 790, 8, '--wp-dot2', 1.7)}
    </svg>`;
  }
  if (kind === 'waves') {
    return `${head}
      <path d="M0 610C70 570 140 640 210 600S330 560 390 590V844H0Z" style="fill:var(--wp-a)"/>
      <path d="M0 700C80 660 150 730 230 690S340 660 390 690V844H0Z" style="fill:var(--wp-b);opacity:.9"/>
      <path d="M0 140C80 180 150 110 230 150S340 190 390 160V0H0Z" style="fill:var(--wp-a);opacity:.7"/>
      <circle cx="320" cy="300" r="7" style="fill:var(--wp-dot)"/><circle cx="70" cy="420" r="4" style="fill:var(--wp-dot2);opacity:.8"/>
    </svg>`;
  }
  // glow: мягкие пятна света
  return `${head}
    <defs>
      <radialGradient id="g1-${n}"><stop offset="0" style="stop-color:var(--wp-a)"/><stop offset="1" style="stop-color:var(--wp-a);stop-opacity:0"/></radialGradient>
      <radialGradient id="g2-${n}"><stop offset="0" style="stop-color:var(--wp-b)"/><stop offset="1" style="stop-color:var(--wp-b);stop-opacity:0"/></radialGradient>
    </defs>
    <circle class="wp-drift" cx="320" cy="180" r="260" fill="url(#g1-${n})"/>
    <circle class="wp-drift wp-drift-2" cx="60" cy="700" r="300" fill="url(#g2-${n})"/>
  </svg>`;
}

/* ---------------------------------------------------------------------------
   Настройки (отдельно для каждого стиля)
   --------------------------------------------------------------------------- */
const DEFAULTS = {
  glass: { wallpaper: 'black' },
  material: { wallpaper: 'shapes', chatShape: 'cookie9', profileShape: 'clover' },
};
const settings = (() => {
  const saved = store.getJSON('design', {});
  return {
    glass: { ...DEFAULTS.glass, ...saved.glass },
    material: { ...DEFAULTS.material, ...saved.material },
  };
})();
const theme = () => (root.dataset.theme === 'material' ? 'material' : 'glass');

function save() { store.setJSON('design', settings); }

export function applyDesign() {
  const s = settings[theme()];
  root.dataset.wallpaper = s.wallpaper;
  root.style.setProperty('--shape-chat', `url(#shape-${settings.material.chatShape})`);
  root.style.setProperty('--shape-profile', `url(#shape-${settings.material.profileShape})`);
  $$('.wallpaper').forEach((el) => {
    el.innerHTML = wallpaperSvg(el.dataset.wp ?? s.wallpaper);
  });
}

/* ---------------------------------------------------------------------------
   Панель «Designs»
   --------------------------------------------------------------------------- */
function preview() {
  return `
    <div class="design-preview" aria-label="Preview">
      <div class="wallpaper" aria-hidden="true"></div>
      <ul class="chat-list pv-list" aria-hidden="true">
        <li class="chat">${kosmoAvatar()}
          <div class="chat-top"><span class="chat-name">${KOSMO_NAME}</span></div>
          <div class="chat-meta"><span class="chat-time">now</span><span class="badge">1</span></div>
          <div class="chat-bottom"><span class="chat-text">Welcome to Kosmo!</span></div>
        </li>
        <li class="chat">${userAvatarHtml({ name: 'Emma Wilson' })}
          <div class="chat-top"><span class="chat-name">Emma Wilson</span></div>
          <div class="chat-meta"><span class="chat-time">21:42</span></div>
          <div class="chat-bottom"><span class="chat-text">See you tonight?</span></div>
        </li>
      </ul>
      <div class="pv-chat" aria-hidden="true">
        <div class="bubble-row theirs"><div class="bubble"><p class="b-text">Hey! Did you try the new design?</p><span class="b-meta">21:40</span></div></div>
        <div class="bubble-row mine"><div class="bubble"><p class="b-text">Yes, the colors look amazing</p><span class="b-meta">21:41</span></div></div>
        <div class="bubble-row theirs"><div class="bubble"><p class="b-text">Told you</p><span class="b-meta">21:42</span></div></div>
      </div>
    </div>`;
}

function seg() {
  const t = theme();
  const item = (id, label) => `
    <button class="seg-item" type="button" role="radio" data-set-theme="${id}" aria-checked="${t === id}">
      <svg class="i seg-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${label}
    </button>`;
  return `<div class="seg glass" data-refract="0.8" role="radiogroup" aria-label="Design style">
    <span class="seg-thumb" aria-hidden="true"></span>${item('glass', 'Liquid Glass')}${item('material', 'Material You')}</div>`;
}

function shapeOptions(target) {
  const current = settings.material[target === 'chat' ? 'chatShape' : 'profileShape'];
  const name = state.acc?.user.name ?? 'You';
  return SHAPE_IDS.map((id) => `
    <button class="shape-option" type="button" role="radio" data-shape="${id}" data-target="${target}" aria-checked="${id === current}" aria-label="${SHAPES[id].label}" title="${SHAPES[id].label}">
      <span class="avatar shape-demo" style="clip-path:url(#shape-${id});${avatarStyle(name)}"><span>${escapeHtml(initials(name)) || 'Aa'}</span></span>
    </button>`).join('');
}

export function renderDesign() {
  const s = settings[theme()];
  $('#design').innerHTML = `
    ${preview()}
    <section class="group group-pad"><span class="group-label">Style</span>${seg()}</section>
    <section class="group group-pad">
      <span class="group-label">Color</span>
      <div class="palette palette-design" role="radiogroup" aria-label="Color">
        <div class="palette-row"></div>
        <label class="photo-btn" for="photo-input" aria-label="Color from photo" title="Color from photo">
          <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l4.8-4.3 3.4 3 3.3-3.4 4.5 4.2"/></svg>
        </label>
      </div>
    </section>
    <section class="group group-pad">
      <span class="group-label">Background</span>
      <div class="wp-options" role="radiogroup" aria-label="Background">
        ${Object.entries(WALLPAPERS).map(([id, label]) => `
          <button class="wp-option" type="button" role="radio" data-wallpaper="${id}" aria-checked="${s.wallpaper === id}">
            <span class="wp-thumb"><span class="wallpaper" data-wp="${id}"></span></span>
            <span class="wp-label">${label}</span>
          </button>`).join('')}
      </div>
    </section>
    <section class="group group-pad material-only">
      <span class="group-label">Chat avatars</span>
      <div class="shape-options" role="radiogroup" aria-label="Chat avatar shape">${shapeOptions('chat')}</div>
      <span class="group-label">Profile avatar</span>
      <div class="shape-options" role="radiogroup" aria-label="Profile avatar shape">${shapeOptions('profile')}</div>
    </section>`;
  paintSwatches();
  applyDesign();
  refreshRefraction();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-design]')) {
    renderDesign();
    openPanel('design');
    return;
  }
  const wp = e.target.closest('[data-wallpaper]');
  if (wp) {
    settings[theme()].wallpaper = wp.dataset.wallpaper;
    save();
    $$('[data-wallpaper]').forEach((b) => b.setAttribute('aria-checked', String(b === wp)));
    applyDesign();
  }
  const sh = e.target.closest('[data-shape]');
  if (sh) {
    settings.material[sh.dataset.target === 'chat' ? 'chatShape' : 'profileShape'] = sh.dataset.shape;
    save();
    $$(`[data-shape][data-target="${sh.dataset.target}"]`).forEach((b) => b.setAttribute('aria-checked', String(b === sh)));
    applyDesign();
  }
});

// Смена стиля: у каждого стиля свои обои
document.addEventListener('kosmo:theme', () => {
  if (panelOpen() === 'design') renderDesign();
  else applyDesign();
});

export function initDesign() {
  injectShapes();
  applyDesign();
}
