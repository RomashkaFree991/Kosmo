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
export const WALLPAPERS = { black: 'Black', shapes: 'Shapes', waves: 'Waves', glow: 'Glow' };
let wpCount = 0;

function wallpaperSvg(kind) {
  if (kind === 'black') return '';
  const n = ++wpCount;
  const anim = !reducedMotion.matches;
  const head = '<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="390" height="844" style="fill:var(--wp-bg)"/>';
  if (kind === 'shapes') {
    const line = 'M48 294C92 298 142 316 132 338S82 352 106 392 168 438 160 470 236 482 330 486 330 522 320 542 382 602 370 632 330 642 342 672 392 722 400 744';
    return `${head}
      <g class="wp-spin" style="transform-origin:290px 232px"><path d="${shapePath('cookie12', 290, 232, 128)}" style="fill:var(--wp-a)"/></g>
      <circle cx="122" cy="676" r="156" style="fill:var(--wp-b)"/>
      <path id="wp-line-${n}" d="${line}" fill="none" stroke-width="3.2" stroke-linecap="round" style="stroke:var(--wp-line);opacity:.75"/>
      <circle cx="48" cy="294" r="11" style="fill:var(--wp-dot)"/>
      <circle r="17" style="fill:var(--wp-dot2)" ${anim ? '' : 'cx="195" cy="443"'}>
        ${anim ? `<animateMotion dur="18s" repeatCount="indefinite" keyPoints="0.3;0.7;0.3" keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"><mpath href="#wp-line-${n}"/></animateMotion>` : ''}
      </circle>
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
