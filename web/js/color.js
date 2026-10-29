// Динамический цвет Material You (material-color-utilities):
// тёмная схема из исходного цвета или из фото, как Android берёт цвета из обоев.

import { $$, root, store, toast, withTransition } from './core.js';

const MCU_URL = 'https://cdn.jsdelivr.net/npm/@material/material-color-utilities@0.3.0/+esm';
const SEEDS = ['#6750A4', '#1A73E8', '#00897B', '#2E7D32', '#E8710A', '#D93F87', '#B3261E'];
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondaryContainer', 'onSecondaryContainer', 'tertiary',
  'onSurface', 'onSurfaceVariant',
  'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'error', 'inverseSurface', 'inverseOnSurface',
];
const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

let mcu = null;
const mcuReady = import(MCU_URL).then((m) => { mcu = m; }).catch(() => { mcu = null; });

function applySeed(hex) {
  const vars = {};
  if (mcu) {
    const { Hct, SchemeTonalSpot, MaterialDynamicColors, argbFromHex, hexFromArgb } = mcu;
    const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(hex)), true, 0);
    for (const role of ROLES) vars[`--md-sys-color-${kebab(role)}`] = hexFromArgb(MaterialDynamicColors[role].getArgb(scheme));
    // Кнопка остаётся белой, лишь с лёгким оттенком исходного цвета (тон 98)
    vars['--md-btn-bg'] = hexFromArgb(scheme.primaryPalette.tone(98));
    vars['--md-btn-fg'] = hexFromArgb(scheme.primaryPalette.tone(10));
  } else {
    // Запасной вариант без библиотеки: тот же оттенок, грубые тона через HSL
    const h = hueOf(hex);
    Object.assign(vars, {
      '--md-sys-color-primary': `hsl(${h} 70% 82%)`,
      '--md-sys-color-on-primary': `hsl(${h} 60% 18%)`,
      '--md-sys-color-primary-container': `hsl(${h} 40% 30%)`,
      '--md-sys-color-on-primary-container': `hsl(${h} 80% 92%)`,
      '--md-sys-color-secondary-container': `hsl(${h} 18% 28%)`,
      '--md-sys-color-on-secondary-container': `hsl(${h} 40% 90%)`,
      '--md-sys-color-tertiary': `hsl(${(h + 60) % 360} 50% 80%)`,
      '--md-sys-color-surface-container': `hsl(${h} 8% 12%)`,
      '--md-sys-color-surface-container-high': `hsl(${h} 8% 17%)`,
      '--md-btn-bg': `hsl(${h} 90% 98%)`,
      '--md-btn-fg': `hsl(${h} 70% 12%)`,
    });
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  store.set('seed', hex);
  $$('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.seed === hex)));
}

function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60 + 360) % 360;
}

// Палитра есть и на экране входа, и в профиле — рисуем во все
let lastExtra = null;
function renderSwatches(extra) {
  lastExtra = extra;
  const seeds = extra && !SEEDS.includes(extra) ? [extra, ...SEEDS.slice(0, -1)] : SEEDS;
  const html = seeds.map((s) => `
    <button class="swatch" type="button" role="radio" data-seed="${s}" style="--sw:${s}" aria-label="Color ${s}" aria-checked="false"></button>`).join('');
  $$('.palette-row').forEach((row) => { row.innerHTML = html; });
}

// Перерисовать палитру (например, после того как профиль собрали заново)
export function paintSwatches() {
  renderSwatches(lastExtra);
  const seed = store.get('seed') ?? SEEDS[0];
  $$('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.seed === seed)));
}

export function initColor() {
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (sw) withTransition(() => applySeed(sw.dataset.seed));
  });

  document.getElementById('photo-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await mcuReady;
    if (!mcu) { toast('Color library failed to load'); return; }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    try {
      await img.decode();
      const hex = mcu.hexFromArgb(await mcu.sourceColorFromImage(img)).toUpperCase();
      renderSwatches(hex);
      withTransition(() => applySeed(hex));
    } catch {
      toast('Could not read this image');
    } finally {
      URL.revokeObjectURL(img.src);
    }
  });

  const saved = store.get('seed');
  renderSwatches(saved);
  applySeed(saved ?? SEEDS[0]);
  mcuReady.then(() => applySeed(store.get('seed') ?? SEEDS[0]));
}
