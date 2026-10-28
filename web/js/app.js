// Kosmo — экран входа: две темы (Liquid Glass / Material You), маска номера,
// выбор страны, вход по QR, экран кода и динамический цвет Material You.

const MCU_URL = 'https://cdn.jsdelivr.net/npm/@material/material-color-utilities@0.3.0/+esm';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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

if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
  const smooth = springEasing({ stiffness: 260, damping: 30 });
  const bouncy = springEasing({ stiffness: 380, damping: 22 });
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
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.style.setProperty('--vt-x', `${x}px`);
  root.style.setProperty('--vt-y', `${y}px`);
  root.style.setProperty('--vt-r', `${radius}px`);
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
   Страны и маска номера (# — цифра)
   --------------------------------------------------------------------------- */
const COUNTRIES = [
  { iso: 'ru', name: 'Россия', dial: '7', mask: '### ###-##-##' },
  { iso: 'kz', name: 'Казахстан', dial: '7', mask: '### ###-##-##' },
  { iso: 'by', name: 'Беларусь', dial: '375', mask: '## ###-##-##' },
  { iso: 'ua', name: 'Украина', dial: '380', mask: '## ###-##-##' },
  { iso: 'uz', name: 'Узбекистан', dial: '998', mask: '## ###-##-##' },
  { iso: 'kg', name: 'Кыргызстан', dial: '996', mask: '### ###-###' },
  { iso: 'tj', name: 'Таджикистан', dial: '992', mask: '## ###-####' },
  { iso: 'am', name: 'Армения', dial: '374', mask: '## ###-###' },
  { iso: 'az', name: 'Азербайджан', dial: '994', mask: '## ###-##-##' },
  { iso: 'ge', name: 'Грузия', dial: '995', mask: '### ##-##-##' },
  { iso: 'md', name: 'Молдова', dial: '373', mask: '#### ####' },
  { iso: 'tr', name: 'Турция', dial: '90', mask: '### ###-##-##' },
  { iso: 'ae', name: 'ОАЭ', dial: '971', mask: '## ###-####' },
  { iso: 'de', name: 'Германия', dial: '49', mask: '### ########' },
  { iso: 'us', name: 'США', dial: '1', mask: '(###) ###-####' },
  { iso: 'gb', name: 'Великобритания', dial: '44', mask: '#### ######' },
];

let country = COUNTRIES.find((c) => c.iso === store.get('country')) ?? COUNTRIES[0];

const field = $('#phone-field');
const phone = $('#phone');
const hint = $('#phone-hint');
const HINT_DEFAULT = hint.textContent;

const flagUrl = (iso) => `https://flagcdn.com/${iso}.svg`;
const maxDigits = () => country.mask.split('#').length - 1;

function formatDigits(digits) {
  let out = '';
  let i = 0;
  for (const ch of country.mask) {
    if (i >= digits.length) break;
    if (ch === '#') out += digits[i++];
    else out += ch;
  }
  return out;
}

function placeholderFor(mask) {
  return mask.replace(/#/g, '0');
}

function onPhoneInput() {
  let digits = phone.value.replace(/\D/g, '');
  // Вставили номер целиком: «+7 999…» или «8 999…»
  if (digits.length > maxDigits()) {
    if (digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    else if (country.dial === '7' && digits.startsWith('8')) digits = digits.slice(1);
  }
  digits = digits.slice(0, maxDigits());
  phone.value = formatDigits(digits);
  updateFieldState();
}

function updateFieldState() {
  const hasValue = phone.value.length > 0;
  field.classList.toggle('has-value', hasValue);
  field.classList.toggle('is-floated', hasValue || document.activeElement === phone);
  if (field.classList.contains('is-error') && isComplete()) setError(null);
}

const isComplete = () => phone.value.replace(/\D/g, '').length === maxDigits();

function setError(message) {
  field.classList.remove('is-error');
  hint.classList.toggle('is-error', Boolean(message));
  hint.textContent = message ?? HINT_DEFAULT;
  if (message) {
    void field.offsetWidth; // перезапуск анимации тряски
    field.classList.add('is-error');
    navigator.vibrate?.(30);
  }
}

function setCountry(next) {
  country = next;
  store.set('country', next.iso);
  const flag = $('#country-flag');
  flag.src = flagUrl(next.iso);
  $('#country-dial').textContent = `+${next.dial}`;
  $('#country-btn').setAttribute('aria-label', `Страна: ${next.name}, +${next.dial}`);
  phone.placeholder = placeholderFor(next.mask);
  onPhoneInput();
  // Маленький «прыжок» флага при смене страны
  flag.animate(
    [{ transform: 'scale(0.6) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 450, easing: getComputedStyle(root).getPropertyValue('--spring-bouncy').trim() || 'ease-out' },
  );
}

phone.addEventListener('input', onPhoneInput);
phone.addEventListener('focus', updateFieldState);
phone.addEventListener('blur', updateFieldState);
$('#clear-btn').addEventListener('click', () => {
  phone.value = '';
  updateFieldState();
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
  $('#sheet-title').textContent = kind === 'country' ? 'Выберите страну' : 'Вход по QR-коду';
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

const CHECK_SVG = '<svg class="country-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

function renderCountries(query) {
  const q = query.trim().toLowerCase().replace(/^\+/, '');
  const list = $('#country-list');
  const items = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q));
  list.innerHTML = items.length
    ? items.map((c, i) => `
      <li class="country-item" role="option" tabindex="-1" data-iso="${c.iso}" aria-selected="${c.iso === country.iso}" style="--i:${i}">
        <img class="flag" src="${flagUrl(c.iso)}" alt="" width="26" height="19" loading="lazy">
        <span class="country-name">${c.name}</span>
        <span class="country-dial">+${c.dial}</span>
        ${c.iso === country.iso ? CHECK_SVG : ''}
      </li>`).join('')
    : '<li class="country-empty">Ничего не найдено</li>';
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
  const eye = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  let cells = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (eye(x, y) || (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)) continue;
      if (rand() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" rx="0.3"/>`;
    }
  }
  const eyeSvg = (x, y) => `
    <rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1"/>
    <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9"/>`;
  $('#qr-box').innerHTML = `
    <svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR-код для входа" style="color:inherit">
      <g fill="currentColor">${cells}${eyeSvg(0, 0)}${eyeSvg(n - 7, 0)}${eyeSvg(0, n - 7)}</g>
    </svg>`;
  $('#qr-box').style.color = root.dataset.theme === 'glass' ? '#000' : '';
}

/* ---------------------------------------------------------------------------
   Переход между экранами
   --------------------------------------------------------------------------- */
function showScreen(nextId, direction) {
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
    next.querySelector(nextId === '#screen-code' ? '.otp-cell' : '#phone')?.focus({ preventScroll: true });
  });
}

/* ---------------------------------------------------------------------------
   Отправка номера → экран кода
   --------------------------------------------------------------------------- */
const submitBtn = $('#submit-btn');
let resendTimer = null;

$('#phone-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitBtn.classList.contains('is-loading')) return;
  if (!isComplete()) {
    setError(phone.value ? 'Номер введён не полностью' : 'Введите номер телефона');
    phone.focus();
    return;
  }
  setError(null);
  // В M3 кнопка морфится в круг: фиксируем ширину, чтобы переход был плавным
  submitBtn.style.width = `${submitBtn.offsetWidth}px`;
  requestAnimationFrame(() => submitBtn.classList.add('is-loading'));
  setTimeout(() => {
    $('#code-phone').textContent = `+${country.dial} ${phone.value}`;
    resetOtp();
    startResendTimer();
    showScreen('#screen-code', 'forward');
    submitBtn.classList.remove('is-loading');
    submitBtn.style.removeProperty('width');
  }, 1100);
});

$('#back-btn').addEventListener('click', () => {
  clearInterval(resendTimer);
  showScreen('#screen-phone', 'back');
});

function startResendTimer() {
  const btn = $('#resend-btn');
  let left = 59;
  btn.disabled = true;
  btn.innerHTML = 'Отправить снова через <span id="resend-timer">0:59</span>';
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = 'Отправить код снова';
      return;
    }
    $('#resend-timer').textContent = `0:${String(left).padStart(2, '0')}`;
  }, 1000);
}
$('#resend-btn').addEventListener('click', () => {
  toast('Новый код отправлен');
  startResendTimer();
});

/* ---------------------------------------------------------------------------
   Ввод кода
   --------------------------------------------------------------------------- */
const otp = $('#otp');
const cells = $$('.otp-cell');

function resetOtp() {
  otp.classList.remove('is-done');
  cells.forEach((c) => { c.value = ''; c.classList.remove('is-filled'); c.disabled = false; });
}

function fillFrom(index, digits) {
  [...digits].forEach((d, k) => {
    const cell = cells[index + k];
    if (!cell) return;
    cell.value = d;
    cell.classList.remove('is-filled');
    void cell.offsetWidth;
    cell.classList.add('is-filled');
  });
  const nextEmpty = cells.find((c) => !c.value);
  (nextEmpty ?? cells[cells.length - 1]).focus();
  if (cells.every((c) => c.value)) {
    otp.classList.add('is-done');
    cells.forEach((c) => { c.disabled = true; });
    navigator.vibrate?.([10, 40, 10]);
    toast('Готово! Это демо — код не проверяется');
  }
}

cells.forEach((cell, i) => {
  cell.addEventListener('input', () => {
    const digits = cell.value.replace(/\D/g, '');
    cell.value = '';
    if (digits) fillFrom(i, digits);
  });
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !cell.value && i > 0) {
      cells[i - 1].value = '';
      cells[i - 1].focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) cells[i - 1].focus();
    else if (e.key === 'ArrowRight' && i < cells.length - 1) cells[i + 1].focus();
  });
  cell.addEventListener('paste', (e) => {
    e.preventDefault();
    const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (digits) fillFrom(i, digits.slice(0, cells.length - i));
  });
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
      '--md-btn-bg': `hsl(${h} 90% 97%)`,
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
  const seeds = extra && !SEEDS.includes(extra) ? [extra, ...SEEDS] : SEEDS;
  $('#palette-row').innerHTML = seeds.map((s) => `
    <button class="swatch" type="button" role="radio" data-seed="${s}" style="--sw:${s}" aria-label="Цвет ${s}" aria-checked="false"></button>`).join('');
}

$('#palette-row').addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (sw) withTransition(() => applySeed(sw.dataset.seed));
});

// Плавная смена палитры через View Transitions (обычный кроссфейд)
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
  if (!mcu) { toast('Не удалось загрузить библиотеку цветов'); return; }
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try {
    await img.decode();
    const argb = await mcu.sourceColorFromImage(img);
    const hex = mcu.hexFromArgb(argb).toUpperCase();
    renderSwatches(hex);
    withTransition(() => applySeed(hex));
    toast(`Цвет из фото: ${hex}`);
  } catch {
    toast('Не получилось прочитать изображение');
  } finally {
    URL.revokeObjectURL(img.src);
  }
});

const savedSeed = store.get('seed');
renderSwatches(savedSeed);
applySeed(savedSeed ?? SEEDS[0]);
mcuReady.then(() => applySeed(store.get('seed') ?? SEEDS[0]));
