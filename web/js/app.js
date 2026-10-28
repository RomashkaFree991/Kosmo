// Kosmo — экран входа: заставка с планетой, две темы (Liquid Glass / Material You),
// маска номера, выбор страны, вход по QR, ввод 6-значного кода и динамический цвет.

const MCU_URL = 'https://cdn.jsdelivr.net/npm/@material/material-color-utilities@0.3.0/+esm';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get(key) { try { return localStorage.getItem(`kosmo:${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`kosmo:${key}`, value); } catch { /* приватный режим */ } },
};

/* ---------------------------------------------------------------------------
   Пружины: считаем затухающее колебание и отдаём его CSS через linear()
   --------------------------------------------------------------------------- */
function springEasing({ stiffness, damping, mass = 1 }) {
  const dt = 1 / 240;
  let x = 0, v = 0, t = 0;
  const samples = [];
  while (t < 3) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    samples.push(x);
    if (Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  const points = 48;
  const stops = [];
  for (let i = 0; i <= points; i++) {
    const s = samples[Math.min(samples.length - 1, Math.round((i / points) * (samples.length - 1)))];
    stops.push(+s.toFixed(4));
  }
  stops[stops.length - 1] = 1;
  return { easing: `linear(0, ${stops.slice(1).join(', ')})`, duration: Math.round(t * 1000) };
}

let introEasing = 'cubic-bezier(0.32, 0.72, 0, 1)';
let bouncyEasing = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
  const smooth = springEasing({ stiffness: 260, damping: 30 });
  const bouncy = springEasing({ stiffness: 380, damping: 22 });
  introEasing = springEasing({ stiffness: 120, damping: 17 }).easing;
  bouncyEasing = bouncy.easing;
  root.style.setProperty('--spring', smooth.easing);
  root.style.setProperty('--spring-dur', `${smooth.duration}ms`);
  root.style.setProperty('--spring-bouncy', bouncy.easing);
  root.style.setProperty('--spring-bouncy-dur', `${bouncy.duration}ms`);
}

/* ---------------------------------------------------------------------------
   Тема
   --------------------------------------------------------------------------- */
function refreshRefraction() {
  // В Material You стекла нет: data-rt заставляет refraction.js снять фильтры
  root.toggleAttribute('data-rt', root.dataset.theme !== 'glass');
  window.LiquidGlassRefraction?.refresh();
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  $$('[data-set-theme]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setTheme === theme)));
  store.set('theme', theme);
  refreshRefraction();
}

function switchTheme(theme, origin) {
  if (theme === root.dataset.theme) return;
  if (!document.startViewTransition || reducedMotion.matches) {
    applyTheme(theme);
    return;
  }
  // Круговое раскрытие новой темы из точки нажатия
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  root.style.setProperty('--vt-x', `${x}px`);
  root.style.setProperty('--vt-y', `${y}px`);
  root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  document.startViewTransition(() => applyTheme(theme));
}

const seg = $('.seg');
$$('[data-set-theme]').forEach((btn) => {
  btn.addEventListener('click', () => switchTheme(btn.dataset.setTheme, btn));
});
seg.addEventListener('pointerdown', () => seg.classList.add('is-pressing'));
['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => seg.addEventListener(e, () => seg.classList.remove('is-pressing')));
seg.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const next = root.dataset.theme === 'glass' ? 'material' : 'glass';
  const btn = $(`[data-set-theme="${next}"]`);
  btn.focus();
  switchTheme(next, btn);
});

applyTheme(store.get('theme') === 'material' ? 'material' : 'glass');

/* ---------------------------------------------------------------------------
   Заставка: планета появляется в центре экрана, рисуются кольца,
   затем она уменьшается и улетает на своё место, а интерфейс проявляется
   --------------------------------------------------------------------------- */
async function playIntro() {
  if (!root.classList.contains('is-intro')) {
    root.classList.add('is-ready');
    return;
  }
  const logo = $('#logo');
  const r = logo.getBoundingClientRect();
  const dx = innerWidth / 2 - (r.left + r.width / 2);
  const dy = innerHeight / 2 - (r.top + r.height / 2);
  const scale = Math.min(2.4, (Math.min(innerWidth, innerHeight) * 0.6) / r.width);
  const from = `translate(${dx}px, ${dy}px) scale(${scale})`;
  logo.style.transform = from;

  await wait(1750);   // планета + оба кольца
  const flight = logo.animate([{ transform: from }, { transform: 'none' }], { duration: 1100, easing: introEasing });
  logo.style.removeProperty('transform');
  await wait(220);
  root.classList.add('is-ready');
  await flight.finished;
  await wait(900);
  root.classList.remove('is-intro');   // дальше планета просто «парит»
}
playIntro();

/* ---------------------------------------------------------------------------
   Страны и маска номера (# — цифра)
   --------------------------------------------------------------------------- */
const COUNTRIES = [
  { iso: 'ru', name: 'Russia', dial: '7', mask: '### ###-##-##' },
  { iso: 'kz', name: 'Kazakhstan', dial: '7', mask: '### ###-##-##' },
  { iso: 'by', name: 'Belarus', dial: '375', mask: '## ###-##-##' },
  { iso: 'ua', name: 'Ukraine', dial: '380', mask: '## ###-##-##' },
  { iso: 'uz', name: 'Uzbekistan', dial: '998', mask: '## ###-##-##' },
  { iso: 'kg', name: 'Kyrgyzstan', dial: '996', mask: '### ###-###' },
  { iso: 'tj', name: 'Tajikistan', dial: '992', mask: '## ###-####' },
  { iso: 'am', name: 'Armenia', dial: '374', mask: '## ###-###' },
  { iso: 'az', name: 'Azerbaijan', dial: '994', mask: '## ###-##-##' },
  { iso: 'ge', name: 'Georgia', dial: '995', mask: '### ##-##-##' },
  { iso: 'md', name: 'Moldova', dial: '373', mask: '#### ####' },
  { iso: 'tr', name: 'Turkey', dial: '90', mask: '### ###-##-##' },
  { iso: 'ae', name: 'United Arab Emirates', dial: '971', mask: '## ###-####' },
  { iso: 'de', name: 'Germany', dial: '49', mask: '### ########' },
  { iso: 'us', name: 'United States', dial: '1', mask: '(###) ###-####' },
  { iso: 'gb', name: 'United Kingdom', dial: '44', mask: '#### ######' },
];

let country = COUNTRIES.find((c) => c.iso === store.get('country')) ?? COUNTRIES[0];

const field = $('#phone-field');
const phone = $('#phone');

const flagUrl = (iso) => `https://flagcdn.com/${iso}.svg`;
const maxDigits = () => country.mask.split('#').length - 1;
const isComplete = () => phone.value.replace(/\D/g, '').length === maxDigits();

function formatDigits(digits) {
  let out = '';
  let i = 0;
  for (const ch of country.mask) {
    if (i >= digits.length) break;
    out += ch === '#' ? digits[i++] : ch;
  }
  return out;
}

function onPhoneInput() {
  let digits = phone.value.replace(/\D/g, '');
  // Вставили номер целиком: «+7 999…» или «8 999…»
  if (digits.length > maxDigits()) {
    if (digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    else if (country.dial === '7' && digits.startsWith('8')) digits = digits.slice(1);
  }
  phone.value = formatDigits(digits.slice(0, maxDigits()));
  field.classList.toggle('has-value', phone.value.length > 0);
  if (isComplete()) field.classList.remove('is-error');
}

function shakeField() {
  field.classList.remove('is-error');
  void field.offsetWidth; // перезапуск анимации тряски
  field.classList.add('is-error');
  navigator.vibrate?.(30);
}

function setCountry(next) {
  country = next;
  store.set('country', next.iso);
  const flag = $('#country-flag');
  flag.src = flagUrl(next.iso);
  $('#country-dial').textContent = `+${next.dial}`;
  $('#country-btn').setAttribute('aria-label', `Country: ${next.name}, +${next.dial}`);
  phone.placeholder = next.mask.replace(/#/g, '0');
  onPhoneInput();
  flag.animate(
    [{ transform: 'scale(0.6) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 450, easing: bouncyEasing },
  );
}

phone.addEventListener('input', onPhoneInput);
$('#clear-btn').addEventListener('click', () => {
  phone.value = '';
  onPhoneInput();
  phone.focus();
});
setCountry(country);

/* ---------------------------------------------------------------------------
   Нижняя панель (страна / QR) с закрытием свайпом вниз
   --------------------------------------------------------------------------- */
const sheet = $('#sheet');
const scrim = $('#scrim');
let lastFocus = null;

function openSheet(kind) {
  lastFocus = document.activeElement;
  $('#sheet-country').hidden = kind !== 'country';
  $('#sheet-qr').hidden = kind !== 'qr';
  $('#sheet-title').textContent = kind === 'country' ? 'Choose country' : 'Log in with QR code';
  sheet.hidden = false;
  scrim.hidden = false;
  if (kind === 'country') renderCountries('');
  if (kind === 'qr') renderQr();
  requestAnimationFrame(() => {
    sheet.classList.add('is-open');
    scrim.classList.add('is-open');
    refreshRefraction();
    if (kind === 'country') setTimeout(() => $('#country-search').focus({ preventScroll: true }), 250);
    else $('#sheet-close').focus({ preventScroll: true });
  });
}

function closeSheet() {
  if (sheet.hidden) return;
  sheet.classList.remove('is-open');
  scrim.classList.remove('is-open');
  sheet.style.removeProperty('transform');
  const done = () => {
    if (sheet.classList.contains('is-open')) return;
    sheet.hidden = true;
    scrim.hidden = true;
    $('#country-search').value = '';
  };
  sheet.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 700);
  lastFocus?.focus({ preventScroll: true });
}

$('#country-btn').addEventListener('click', () => openSheet('country'));
$('#qr-btn').addEventListener('click', () => openSheet('qr'));
$('#sheet-close').addEventListener('click', closeSheet);
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// Свайп вниз за ручку или заголовок
(() => {
  let startY = 0, dy = 0, dragging = false;
  const grab = (e) => e.target.closest('.sheet-handle, .sheet-head') && !e.target.closest('button');
  sheet.addEventListener('pointerdown', (e) => {
    if (!grab(e)) return;
    dragging = true;
    startY = e.clientY;
    dy = 0;
    sheet.classList.add('is-dragging');
    sheet.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = e.clientY - startY;
    // Вверх тянется с сопротивлением, как резинка
    const offset = dy > 0 ? dy : -Math.sqrt(-dy) * 3;
    sheet.style.transform = `translate(-50%, ${offset}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    sheet.style.removeProperty('transform');
    if (dy > 110) closeSheet();
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
})();

const CHECK_SVG = '<svg class="i country-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function renderCountries(query) {
  const q = query.trim().toLowerCase().replace(/^\+/, '');
  const list = $('#country-list');
  const items = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q));
  list.innerHTML = items.length
    ? items.map((c, i) => `
      <li class="country-item" role="option" data-iso="${c.iso}" aria-selected="${c.iso === country.iso}" style="--i:${i}">
        <img class="flag" src="${flagUrl(c.iso)}" alt="" width="26" height="19" loading="lazy">
        <span class="country-name">${c.name}</span>
        <span class="country-dial">+${c.dial}</span>
        ${c.iso === country.iso ? CHECK_SVG : ''}
      </li>`).join('')
    : '<li class="country-empty">Nothing found</li>';
}

$('#country-search').addEventListener('input', (e) => renderCountries(e.target.value));
$('#country-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = $('.country-item');
    if (first) pickCountry(first.dataset.iso);
  }
});
$('#country-list').addEventListener('click', (e) => {
  const item = e.target.closest('.country-item');
  if (item) pickCountry(item.dataset.iso);
});

function pickCountry(iso) {
  setCountry(COUNTRIES.find((c) => c.iso === iso));
  closeSheet();
  setTimeout(() => phone.focus(), 300);
}

// Декоративный QR: детерминированный узор с тремя «глазками» по углам
function renderQr() {
  const n = 25;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const nearEye = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  let cells = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!nearEye(x, y) && rand() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" rx="0.3"/>`;
    }
  }
  const eye = (x, y) => `
    <rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1"/>
    <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9"/>`;
  $('#qr-box').innerHTML = `
    <svg viewBox="0 0 ${n} ${n}" role="img" aria-label="Login QR code">
      <g fill="currentColor">${cells}${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}</g>
    </svg>`;
}

/* ---------------------------------------------------------------------------
   Переход между экранами
   --------------------------------------------------------------------------- */
function showScreen(nextId, direction, onShown) {
  const current = $('.screen.is-active');
  const next = $(nextId);
  if (current === next) return;
  const enter = `enter-${direction}`;
  const leave = `leave-${direction}`;
  current.classList.add(leave);
  current.addEventListener('animationend', function onEnd(e) {
    if (e.target !== current) return;
    current.removeEventListener('animationend', onEnd);
    current.classList.remove('is-active', leave);
    current.hidden = true;
    next.hidden = false;
    next.classList.add('is-active', enter);
    next.addEventListener('animationend', function onIn(ev) {
      if (ev.target !== next) return;
      next.removeEventListener('animationend', onIn);
      next.classList.remove(enter);
    });
    refreshRefraction();
    onShown?.();
  });
}

/* ---------------------------------------------------------------------------
   Отправка номера → экран кода
   --------------------------------------------------------------------------- */
const submitBtn = $('#submit-btn');

$('#phone-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitBtn.classList.contains('is-loading')) return;
  if (!isComplete()) {
    shakeField();
    phone.focus();
    return;
  }
  // В M3 кнопка морфится в круг: фиксируем ширину, чтобы переход был плавным
  submitBtn.style.width = `${submitBtn.offsetWidth}px`;
  requestAnimationFrame(() => submitBtn.classList.add('is-loading'));
  setTimeout(() => {
    resetOtp();
    showScreen('#screen-code', 'forward', () => otpInput.focus({ preventScroll: true }));
    submitBtn.classList.remove('is-loading');
    submitBtn.style.removeProperty('width');
  }, 1100);
});

$('#back-btn').addEventListener('click', () => {
  showScreen('#screen-phone', 'back', () => phone.focus({ preventScroll: true }));
});

/* ---------------------------------------------------------------------------
   Ввод кода: одно настоящее поле поверх шести ячеек.
   Каждая новая цифра «всплывает» в своей ячейке, стёртая — улетает вверх.
   --------------------------------------------------------------------------- */
const otp = $('#otp');
const otpInput = $('#otp-input');
const cells = $$('.otp-cell');
const CODE_LENGTH = cells.length;
let shown = '';

cells.forEach((c, i) => c.style.setProperty('--i', i));

function renderOtp() {
  const value = otpInput.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
  otpInput.value = value;
  cells.forEach((cell, i) => {
    if (value[i] !== shown[i]) {
      cell.querySelectorAll('.digit:not(.is-out)').forEach((old) => {
        old.classList.add('is-out');
        old.addEventListener('animationend', () => old.remove(), { once: true });
      });
      if (value[i]) {
        const digit = document.createElement('span');
        digit.className = 'digit';
        digit.textContent = value[i];
        cell.append(digit);
      }
    }
    cell.classList.toggle('is-filled', Boolean(value[i]));
    cell.classList.toggle('is-active', i === Math.min(value.length, CODE_LENGTH - 1));
  });
  shown = value;
  if (value.length === CODE_LENGTH) finishOtp();
}

function finishOtp() {
  otp.classList.add('is-done');
  otpInput.disabled = true;
  otpInput.blur();
  navigator.vibrate?.([10, 40, 10]);
  toast('Signed in — demo, the code is not checked');
}

function resetOtp() {
  otp.classList.remove('is-done');
  otpInput.disabled = false;
  otpInput.value = '';
  cells.forEach((c) => c.replaceChildren());
  shown = '';
  renderOtp();
}

otpInput.addEventListener('input', renderOtp);
otpInput.addEventListener('focus', () => otp.classList.add('is-focused'));
otpInput.addEventListener('blur', () => otp.classList.remove('is-focused'));
// Курсор всегда в конце: стрелки и клики не двигают его внутрь кода
const caretToEnd = () => requestAnimationFrame(() => otpInput.setSelectionRange(otpInput.value.length, otpInput.value.length));
otpInput.addEventListener('click', caretToEnd);
otpInput.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
});

/* ---------------------------------------------------------------------------
   Ripple (Material) и «проседание» кнопок
   --------------------------------------------------------------------------- */
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  btn.classList.add('is-pressed');
  const release = () => {
    btn.classList.remove('is-pressed');
    btn.querySelectorAll('.ripple').forEach((r) => r.classList.add('is-out'));
    setTimeout(() => btn.querySelectorAll('.ripple.is-out').forEach((r) => r.remove()), 600);
  };
  btn.addEventListener('pointerup', release, { once: true });
  btn.addEventListener('pointerleave', release, { once: true });

  if (root.dataset.theme !== 'material') return;
  const r = btn.getBoundingClientRect();
  const size = Math.hypot(r.width, r.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - r.left - size / 2}px`;
  ripple.style.top = `${e.clientY - r.top - size / 2}px`;
  btn.append(ripple);
});

/* ---------------------------------------------------------------------------
   Тост
   --------------------------------------------------------------------------- */
let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 2600);
}

/* ---------------------------------------------------------------------------
   Динамический цвет Material You (material-color-utilities)
   --------------------------------------------------------------------------- */
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

function renderSwatches(extra) {
  const seeds = extra && !SEEDS.includes(extra) ? [extra, ...SEEDS.slice(0, -1)] : SEEDS;
  $('#palette-row').innerHTML = seeds.map((s) => `
    <button class="swatch" type="button" role="radio" data-seed="${s}" style="--sw:${s}" aria-label="Color ${s}" aria-checked="false"></button>`).join('');
}

$('#palette-row').addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (sw) withTransition(() => applySeed(sw.dataset.seed));
});

// Плавная смена палитры: раскрытие снизу вверх через View Transitions
function withTransition(fn) {
  if (document.startViewTransition && !reducedMotion.matches) {
    root.style.setProperty('--vt-x', '50%');
    root.style.setProperty('--vt-y', '100%');
    root.style.setProperty('--vt-r', '150vmax');
    document.startViewTransition(fn);
  } else fn();
}

// Цвет из фото — как Material You берёт цвета из обоев
$('#photo-input').addEventListener('change', async (e) => {
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

const savedSeed = store.get('seed');
renderSwatches(savedSeed);
applySeed(savedSeed ?? SEEDS[0]);
mcuReady.then(() => applySeed(store.get('seed') ?? SEEDS[0]));
