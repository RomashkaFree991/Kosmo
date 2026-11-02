// Оформление: обои в цветах выбранной палитры (как в Material You),
// формы аватарок из библиотеки форм Material 3 и панель «Designs»
// с живым превью списка чатов и переписки.

import {
  $, $$, root, store, kosmoAvatar, userAvatarHtml, reducedMotion, refreshRefraction, initials, escapeHtml, avatarStyle, schemeMode, setScheme,
} from './core.js';
import { KOSMO_NAME } from './chats.js';
import { state, openPanel, panelOpen } from './panels.js';
import { paintSwatches, SCHEME_STYLES, schemeStyle, setSchemeStyle, reapplyColor } from './color.js';

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
export const WALLPAPERS = { black: 'Black', shapes: 'Cosmos', aurora: 'Aurora', dunes: 'Dunes', bubbles: 'Bubbles', nebula: 'Nebula', waves: 'Waves', glow: 'Glow', halloween: 'Halloween' };
const STAR = 'M0-10C1.4-1.4 1.4-1.4 10 0 1.4 1.4 1.4 1.4 0 10-1.4 1.4-1.4 1.4-10 0-1.4-1.4-1.4-1.4 0-10Z';
const ORBIT = 'M-40 520C40 380 330 330 430 400';

// Обои рисуются на «сцене» 390×844 (масштабируется под экран). Неподвижное —
// одним SVG, а всё, что движется, — отдельными слоями с анимацией transform
// и opacity: их считает видеокарта, поэтому фон не дёргается и не замирает.
const layer = (cls, x, y, w, h, inner = '', style = '') =>
  `<div class="wp-layer ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${style}">${inner}</div>`;

const starLayer = (x, y, r, color, delay) => layer('wp-star', x - r, y - r, r * 2, r * 2,
  `<svg viewBox="-10 -10 20 20" width="100%" height="100%"><path d="${STAR}" style="fill:var(${color})"/></svg>`, `--d:${delay}s`);

function wallpaperHtml(kind) {
  if (kind === 'black') return '';
  const bg = '<rect width="390" height="844" style="fill:var(--wp-bg)"/>';
  let still = '';
  let layers = '';
  if (kind === 'shapes') {
    // «Космос» в формах Material 3: планета с кольцом, орбита с луной,
    // клевер, пилюля, «печенька» и мерцающие звёзды
    still = `${bg}
      <g transform="rotate(-32 70 120)"><rect x="-90" y="70" width="300" height="118" rx="59" style="fill:var(--wp-a)"/></g>
      <path d="${shapePath('cookie7', 74, 610, 40)}" style="fill:var(--wp-b);opacity:.75"/>
      <path class="wp-orbit" d="${ORBIT}" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 11" style="stroke:var(--wp-line);opacity:.55"/>
      <g transform="rotate(-16 290 720)"><path d="M120 720A170 34 0 0 1 460 720" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--wp-line);opacity:.4"/></g>
      <circle cx="290" cy="720" r="118" style="fill:var(--wp-a)"/>
      <circle cx="252" cy="680" r="20" style="fill:var(--wp-bg);opacity:.35"/>
      <circle cx="318" cy="752" r="12" style="fill:var(--wp-bg);opacity:.3"/>
      <g transform="rotate(-16 290 720)"><path d="M120 720A170 34 0 0 0 460 720" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--wp-line);opacity:.65"/></g>`;
    layers = layer('wp-spin', 244, 176, 148, 148,
      `<svg viewBox="0 0 148 148" width="100%" height="100%"><path d="${shapePath('clover', 74, 74, 74)}" style="fill:var(--wp-b)"/></svg>`)
      + layer('wp-moon', 0, 0, 20, 20)
      + starLayer(196, 132, 11, '--wp-dot2', 0) + starLayer(58, 330, 7, '--wp-dot', 1.2) + starLayer(350, 470, 9, '--wp-dot2', 2.1)
      + starLayer(150, 560, 6, '--wp-dot', 0.6) + starLayer(250, 40, 6, '--wp-dot', 2.8) + starLayer(40, 790, 8, '--wp-dot2', 1.7);
  } else if (kind === 'halloween') {
    // Хэллоуин: ночное небо, луна, холмы, тыквы-фонари, паутина; летают летучие мыши
    const pumpkin = (x, y, r, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M-2 ${-r * 0.95}q4 -${r * 0.35} 10 -${r * 0.4}" stroke="#3f6b2a" stroke-width="${r * 0.14}" fill="none" stroke-linecap="round"/>
      <ellipse rx="${r * 0.62}" ry="${r * 0.9}" cx="${-r * 0.45}" fill="#e8590c"/><ellipse rx="${r * 0.62}" ry="${r * 0.9}" cx="${r * 0.45}" fill="#e8590c"/>
      <ellipse rx="${r * 0.6}" ry="${r * 0.95}" fill="#ff7a1a"/>
      <path d="M${-r * 0.5} ${-r * 0.2}l${r * 0.22} ${-r * 0.28}l${r * 0.22} ${r * 0.28}zM${r * 0.06} ${-r * 0.2}l${r * 0.22} ${-r * 0.28}l${r * 0.22} ${r * 0.28}z" fill="#ffd43b"/>
      <path d="M${-r * 0.55} ${r * 0.2}q${r * 0.55} ${r * 0.5} ${r * 1.1} 0l${-r * 0.18} ${r * 0.1}l${-r * 0.12} ${-r * 0.1}l${-r * 0.14} ${r * 0.12}l${-r * 0.14} ${-r * 0.12}l${-r * 0.14} ${r * 0.1}z" fill="#ffd43b"/></g>`;
    const bat = '<svg viewBox="-30 -14 60 28" width="100%" height="100%"><path d="M0 -4c3 0 4 3 4 5c4-6 10-8 16-6c-3 2-4 5-3 8c-4-2-8-1-10 2c-2-2-4-2-7-1c-3-1-5-1-7 1c-2-3-6-4-10-2c1-3 0-6-3-8c6-2 12 0 16 6c0-2 1-5 4-5z" fill="#1b0f24"/></svg>';
    still = `<defs><linearGradient id="hw-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0b2e"/><stop offset=".6" stop-color="#3b1450"/><stop offset="1" stop-color="#6a1f3a"/></linearGradient>
      <radialGradient id="hw-moon" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#fff6d5"/><stop offset="1" stop-color="#ffd76a"/></radialGradient></defs>
      <rect width="390" height="844" fill="url(#hw-sky)"/>
      <circle cx="292" cy="150" r="74" fill="#ffd76a" opacity=".18"/><circle cx="292" cy="150" r="56" fill="url(#hw-moon)"/>
      <circle cx="272" cy="136" r="9" fill="#e9c35a" opacity=".6"/><circle cx="306" cy="172" r="6" fill="#e9c35a" opacity=".55"/>
      <g stroke="#cbb6e6" stroke-width="1" fill="none" opacity=".35"><path d="M0 0L120 110M0 0L60 130M0 0L130 50M0 0L10 140"/>
      <path d="M38 35q12-14 24 -6q-4 14 6 24q-14 4 -18 22q-10-12 -24 -8q4-16 -8 -24q12-2 20-8z"/><path d="M72 64q20-24 40 -10q-6 24 10 40q-24 8 -30 36q-16-20 -40 -14q6-26 -14 -40q20-4 34-12z"/></g>
      <path d="M0 700C70 660 150 690 220 668S340 640 390 660V844H0Z" fill="#2a0f30"/>
      <path d="M0 760C90 720 170 760 250 735S350 715 390 728V844H0Z" fill="#160818"/>
      ${pumpkin(88, 712, 34, -6)}${pumpkin(300, 744, 26, 8)}${pumpkin(190, 790, 20, 0)}`;
    layers = layer('wp-bat', 40, 260, 54, 26, bat) + layer('wp-bat wp-bat-2', 230, 330, 40, 20, bat) + layer('wp-bat wp-bat-3', 140, 420, 32, 16, bat)
      + starLayer(60, 90, 5, '--hw-star', 0) + starLayer(170, 60, 4, '--hw-star', 1.1) + starLayer(360, 300, 5, '--hw-star', 2) + starLayer(30, 520, 4, '--hw-star', 0.6);
  } else if (kind === 'aurora') {
    // Северное сияние: мягкие полосы света переливаются над тёмным небом
    still = `${bg}<defs><linearGradient id="au-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
      <path d="M0 780C90 760 160 790 240 770S350 750 390 760V844H0Z" style="fill:var(--wp-a);opacity:.5"/>
      <rect width="390" height="844" fill="url(#au-fade)"/>`;
    layers = layer('wp-aurora', -120, 60, 640, 360, '', 'background:radial-gradient(60% 40% at 50% 50%,var(--wp-b),transparent 70%)')
      + layer('wp-aurora wp-aurora-2', -160, 180, 700, 320, '', 'background:radial-gradient(55% 35% at 50% 50%,var(--wp-dot),transparent 70%)')
      + layer('wp-aurora wp-aurora-3', -100, 300, 600, 300, '', 'background:radial-gradient(50% 30% at 50% 50%,var(--wp-a),transparent 70%)')
      + starLayer(60, 60, 4, '--wp-dot2', 0) + starLayer(320, 110, 5, '--wp-dot2', 1.4) + starLayer(200, 30, 3, '--wp-dot2', 2.2) + starLayer(350, 640, 4, '--wp-dot2', 0.8);
  } else if (kind === 'dunes') {
    // Дюны: плавные слои холмов разных оттенков палитры
    still = `${bg}
      <circle cx="300" cy="190" r="54" style="fill:var(--wp-dot);opacity:.55"/>
      <path d="M0 470C80 420 170 450 240 430S360 400 390 420V844H0Z" style="fill:var(--wp-a);opacity:.55"/>
      <path d="M0 560C70 520 150 560 220 535S340 500 390 520V844H0Z" style="fill:var(--wp-b);opacity:.7"/>
      <path d="M0 650C90 610 160 660 250 630S350 600 390 615V844H0Z" style="fill:var(--wp-a);opacity:.85"/>
      <path d="M0 740C80 700 180 760 260 725S360 700 390 712V844H0Z" style="fill:var(--wp-b)"/>`;
    layers = starLayer(80, 120, 5, '--wp-dot2', 0.3) + starLayer(180, 70, 4, '--wp-dot2', 1.6);
  } else if (kind === 'bubbles') {
    // Пузыри: полупрозрачные круги медленно всплывают
    still = bg;
    const bub = (x, y, r, c, d) => layer('wp-bubble', x - r, y - r, r * 2, r * 2, '', `border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(${c}) 55%,#fff 45%),var(${c}) 60%);opacity:.55;--d:${d}s`);
    layers = bub(70, 700, 46, '--wp-a', 0) + bub(300, 620, 62, '--wp-b', -6) + bub(190, 420, 30, '--wp-dot', -3) + bub(330, 260, 24, '--wp-a', -9)
      + bub(50, 300, 34, '--wp-b', -12) + bub(230, 150, 18, '--wp-dot', -4) + bub(120, 520, 14, '--wp-dot', -8);
  } else if (kind === 'nebula') {
    // Туманность: цветные облака и рассыпанные звёзды
    const dots = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 390}" cy="${(i * 211) % 844}" r="${(i % 3) * 0.6 + 0.6}" style="fill:var(--wp-dot2);opacity:${0.3 + (i % 5) * 0.12}"/>`).join('');
    still = `${bg}${dots}`;
    layers = layer('wp-glow wp-drift', -120, 120, 520, 520, '', 'background:radial-gradient(closest-side,var(--wp-b),transparent)')
      + layer('wp-glow wp-drift wp-drift-2', 60, 420, 480, 480, '', 'background:radial-gradient(closest-side,var(--wp-dot),transparent)')
      + layer('wp-glow wp-drift', 160, -80, 360, 360, '', 'background:radial-gradient(closest-side,var(--wp-a),transparent)')
      + starLayer(90, 200, 7, '--wp-dot2', 0) + starLayer(300, 520, 6, '--wp-dot2', 1.3) + starLayer(220, 760, 5, '--wp-dot2', 2.4);
  } else if (kind === 'waves') {
    still = `${bg}
      <path d="M0 610C70 570 140 640 210 600S330 560 390 590V844H0Z" style="fill:var(--wp-a)"/>
      <path d="M0 700C80 660 150 730 230 690S340 660 390 690V844H0Z" style="fill:var(--wp-b);opacity:.9"/>
      <path d="M0 140C80 180 150 110 230 150S340 190 390 160V0H0Z" style="fill:var(--wp-a);opacity:.7"/>`;
    layers = starLayer(320, 300, 8, '--wp-dot', 0) + starLayer(70, 420, 5, '--wp-dot2', 1.5) + starLayer(200, 250, 5, '--wp-dot2', 2.6);
  } else {
    // glow: мягкие пятна света
    still = bg;
    layers = layer('wp-glow wp-drift', 60, -80, 520, 520, '', 'background:radial-gradient(closest-side,var(--wp-a),transparent)')
      + layer('wp-glow wp-drift wp-drift-2', -240, 400, 600, 600, '', 'background:radial-gradient(closest-side,var(--wp-b),transparent)');
  }
  return `<div class="wp-stage"><svg class="wp-still" viewBox="0 0 390 844" width="390" height="844" aria-hidden="true">${still}</svg>${layers}</div>`;
}

// Сцена 390×844 «покрывает» элемент целиком, как background-size: cover
const scaleObserver = new ResizeObserver((entries) => {
  for (const { target, contentRect: r } of entries) {
    target.style.setProperty('--wp-scale', Math.max(r.width / 390, r.height / 844));
  }
});

function animateMoon(el) {
  const moon = el.querySelector('.wp-moon');
  const orbit = el.querySelector('.wp-orbit');
  if (!moon || !orbit) return;
  const len = orbit.getTotalLength();
  const at = (t) => {
    const p = orbit.getPointAtLength(len * t);
    return { transform: `translate(${p.x - 10}px, ${p.y - 10}px)` };
  };
  if (reducedMotion.matches) {
    Object.assign(moon.style, at(0.5));
    return;
  }
  const frames = Array.from({ length: 25 }, (_, i) => at(0.15 + (0.7 * i) / 24));
  moon.animate(frames, { duration: 22000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
}

function renderWallpaper(el, kind) {
  if (el.dataset.kind === kind) return;   // уже нарисовано — не трогаем, анимация идёт дальше
  el.dataset.kind = kind;
  el.innerHTML = wallpaperHtml(kind);
  scaleObserver.observe(el);
  animateMoon(el);
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

export const holiday = () => (store.get('holiday') === 'halloween' ? 'halloween' : '');
export function applyDesign() {
  const s = settings[theme()];
  const hw = holiday();
  if (hw) root.dataset.holiday = hw; else delete root.dataset.holiday;
  const wpKind = hw || s.wallpaper;
  root.dataset.wallpaper = wpKind;
  root.style.setProperty('--shape-chat', `url(#shape-${settings.material.chatShape})`);
  root.style.setProperty('--shape-profile', `url(#shape-${settings.material.profileShape})`);
  $$('.wallpaper').forEach((el) => renderWallpaper(el, el.dataset.wp ?? wpKind));
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
    <section class="group group-pad"><span class="group-label">Theme</span>
      <div class="segs scheme-segs" role="radiogroup" aria-label="Theme">
        ${[['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']].map(([v, l]) => `<button type="button" class="seg-btn" role="radio" data-scheme-pick="${v}" aria-checked="${schemeMode() === v}">${l}</button>`).join('')}
      </div>
    </section>
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
    ${theme() === 'material' ? `<section class="group group-pad">
      <span class="group-label">Color style</span>
      <div class="segs segs-wrap" role="radiogroup" aria-label="Color style">
        ${Object.entries(SCHEME_STYLES).map(([id, [, label]]) => `<button type="button" class="seg-btn" role="radio" data-scheme-style="${id}" aria-checked="${schemeStyle() === id}">${label}</button>`).join('')}
      </div>
    </section>` : ''}
    <section class="group group-pad">
      <span class="group-label">Holiday theme</span>
      <div class="segs" role="radiogroup" aria-label="Holiday theme">
        <button type="button" class="seg-btn" role="radio" data-holiday-pick="" aria-checked="${!holiday()}">Off</button>
        <button type="button" class="seg-btn" role="radio" data-holiday-pick="halloween" aria-checked="${holiday() === 'halloween'}">🎃 Halloween</button>
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
  const sp = e.target.closest('[data-scheme-pick]');
  if (sp && sp.dataset.schemePick !== schemeMode()) {
    const r = sp.getBoundingClientRect();
    setScheme(sp.dataset.schemePick, r.left + r.width / 2, r.top + r.height / 2);
  }
  const st = e.target.closest('[data-scheme-style]');
  if (st) {
    $$('[data-scheme-style]').forEach((b) => b.setAttribute('aria-checked', String(b === st)));
    setSchemeStyle(st.dataset.schemeStyle);
  }
  const hp = e.target.closest('[data-holiday-pick]');
  if (hp) {
    store.set('holiday', hp.dataset.holidayPick);
    $$('[data-holiday-pick]').forEach((b) => b.setAttribute('aria-checked', String(b === hp)));
    reapplyColor();
    applyDesign();
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
document.addEventListener('kosmo:scheme', () => applyDesign());
document.addEventListener('kosmo:theme', () => {
  if (panelOpen() === 'design') renderDesign();
  else applyDesign();
});

export function initDesign() {
  injectShapes();
  applyDesign();
}
