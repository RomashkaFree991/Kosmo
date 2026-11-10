// Поле номера телефона с выбором страны и маской, нижняя панель (страна / QR).
// Поле используется и при входе, и при смене номера.

import { $, store, easing, refreshRefraction, shake } from './core.js';

// # — цифра
export const COUNTRIES = [
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
  // тестовые номера Kosmo: +000 …
  { iso: 'test', name: 'Test numbers', dial: '000', mask: '### ###-##-##' },
];

// у тестовых номеров вместо флага — маленькая планета Kosmo
const TEST_FLAG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 19"><rect width="26" height="19" rx="3" fill="#1b1340"/><ellipse cx="13" cy="9.5" rx="10" ry="2.6" fill="none" stroke="#bf5af2" stroke-width="1.4" transform="rotate(-16 13 9.5)"/><circle cx="13" cy="9.5" r="5" fill="#64d2ff"/></svg>')}`;
const flagUrl = (iso) => (iso === 'test' ? TEST_FLAG : `https://flagcdn.com/${iso}.svg`);
const maskDigits = (mask) => mask.split('#').length - 1;

function applyMask(mask, digits) {
  let out = '';
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    out += ch === '#' ? digits[i++] : ch;
  }
  return out;
}

// «+79991234567» → «+7 999 123-45-67» по маске подходящей страны
export function formatPhone(e164) {
  const digits = e164.replace(/\D/g, '');
  const c = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
    .find((x) => digits.startsWith(x.dial) && digits.length - x.dial.length === maskDigits(x.mask));
  return c ? `+${c.dial} ${applyMask(c.mask, digits.slice(c.dial.length))}` : e164;
}

const FIELD_HTML = `
  <button type="button" class="country-btn" aria-haspopup="dialog">
    <img class="flag" alt="" width="26" height="19">
    <span class="dial"></span>
    <svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>
  </button>
  <span class="field-divider" aria-hidden="true"></span>
  <input class="phone-input" type="tel" inputmode="tel" autocomplete="tel-national" aria-label="Phone number">
  <button type="button" class="clear-btn" aria-label="Clear">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" class="clear-bg"/><path class="clear-x" d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>
  </button>`;

export function createPhoneField(el) {
  el.innerHTML = FIELD_HTML;
  const input = $('.phone-input', el);
  const countryBtn = $('.country-btn', el);
  const flag = $('.flag', el);
  let country = COUNTRIES.find((c) => c.iso === store.get('country')) ?? COUNTRIES[0];

  const digits = () => input.value.replace(/\D/g, '');
  const field = {
    input,
    get e164() { return `+${country.dial}${digits()}`; },
    isComplete: () => digits().length === maskDigits(country.mask),
    focus: () => input.focus({ preventScroll: true }),
    shake: () => { shake(el); input.focus(); },
    clear() { input.value = ''; onInput(); },
    setCountry(next, animate = true) {
      country = next;
      store.set('country', next.iso);
      flag.src = flagUrl(next.iso);
      $('.dial', el).textContent = `+${next.dial}`;
      countryBtn.setAttribute('aria-label', `Country: ${next.name}, +${next.dial}`);
      input.placeholder = next.mask.replace(/#/g, '0');
      onInput();
      if (animate) {
        flag.animate(
          [{ transform: 'scale(0.6) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 450, easing: easing.bouncy },
        );
      }
    },
  };

  function onInput() {
    let d = digits();
    const max = maskDigits(country.mask);
    // Вставили номер целиком: «+7 999…» или «8 999…»
    if (d.length > max) {
      if (d.startsWith(country.dial)) d = d.slice(country.dial.length);
      else if (country.dial === '7' && d.startsWith('8')) d = d.slice(1);
    }
    input.value = applyMask(country.mask, d.slice(0, max));
    el.classList.toggle('has-value', input.value.length > 0);
    if (field.isComplete()) el.classList.remove('is-error');
  }

  input.addEventListener('input', onInput);
  $('.clear-btn', el).addEventListener('click', () => { field.clear(); field.focus(); });
  countryBtn.addEventListener('click', () => openSheet('country', {
    selected: country.iso,
    onPick: (c) => { field.setCountry(c); setTimeout(field.focus, 300); },
  }));
  field.setCountry(country, false);
  return field;
}

/* ---------------------------------------------------------------------------
   Нижняя панель (страна / QR) с закрытием свайпом вниз
   --------------------------------------------------------------------------- */
const sheet = $('#sheet');
const scrim = $('#scrim');
let lastFocus = null;
let sheetOpts = {};

export function openSheet(kind, opts = {}) {
  sheetOpts = opts;
  lastFocus = document.activeElement;
  $('#sheet-country').hidden = kind !== 'country';
  $('#sheet-qr').hidden = kind !== 'qr';
  $('#sheet-code').hidden = kind !== 'code';
  $('#sheet-media').hidden = kind !== 'media';
  $('#sheet-forward').hidden = kind !== 'forward';
  $('#sheet-title').textContent = opts.title ?? { country: 'Choose country', qr: 'Log in with QR code', code: 'Code', media: 'Send', forward: 'Forward to' }[kind];
  sheet.hidden = false;
  scrim.hidden = false;
  if (kind === 'country') renderCountries('');
  if (kind === 'qr') (opts.renderQr ?? renderQr)();
  if (kind === 'code') renderCode();
  if (kind === 'media') renderMedia(opts.files ?? []);
  if (kind === 'forward') $('#forward-list').innerHTML = opts.items ?? '';
  requestAnimationFrame(() => {
    sheet.classList.add('is-open');
    scrim.classList.add('is-open');
    refreshRefraction();
    if (kind === 'country') setTimeout(() => $('#country-search').focus({ preventScroll: true }), 250);
    else if (kind === 'code') setTimeout(() => $('#code-input').focus({ preventScroll: true }), 250);
    else if (kind === 'media') setTimeout(() => $('#media-caption').focus({ preventScroll: true }), 250);
    else $('#sheet-close').focus({ preventScroll: true });
  });
}

export function closeSheet() {
  if (sheet.hidden) return;
  sheet.classList.remove('is-open');
  scrim.classList.remove('is-open');
  sheet.style.removeProperty('transform');
  sheetOpts.onClose?.();
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
  const items = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q));
  $('#country-list').innerHTML = items.length
    ? items.map((c, i) => `
      <li class="country-item" role="option" data-iso="${c.iso}" aria-selected="${c.iso === sheetOpts.selected}" style="--i:${i}">
        <img class="flag" src="${flagUrl(c.iso)}" alt="" width="26" height="19" loading="lazy">
        <span class="country-name">${c.name}</span>
        <span class="country-dial">+${c.dial}</span>
        ${c.iso === sheetOpts.selected ? CHECK_SVG : ''}
      </li>`).join('')
    : '<li class="country-empty">Nothing found</li>';
}

function pickCountry(iso) {
  sheetOpts.onPick?.(COUNTRIES.find((c) => c.iso === iso));
  closeSheet();
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

/* ---------- Отправка кода ---------- */
const LANGS = ['JavaScript', 'Kotlin', 'Python', 'HTML', 'CSS', 'JSON', 'Other'];
let codeLang = LANGS[0];

function renderCode() {
  $('#code-input').value = '';
  $('#code-caption').value = '';
  $('#code-langs').innerHTML = LANGS.map((l) => `<button class="lang-chip" type="button" role="radio" data-lang="${l}" aria-checked="${l === codeLang}">${l}</button>`).join('');
}

$('#code-langs').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-lang]');
  if (!chip) return;
  codeLang = chip.dataset.lang;
  document.querySelectorAll('.lang-chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
});
$('#code-input').addEventListener('keydown', (e) => {
  // Tab вставляет отступ, а не уводит фокус
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const t = e.target;
  t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end');
});
$('#sheet-code').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#code-input').value.replace(/\s+$/, '');
  if (!text.trim()) { shake($('.code-field')); return; }
  sheetOpts.onSend?.(text, codeLang, $('#code-caption').value.trim());
  closeSheet();
});

/* ---------- Фото / видео с подписью ---------- */
let previewUrls = [];
function renderMedia(files) {
  previewUrls.forEach((u) => URL.revokeObjectURL(u));
  previewUrls = files.map((f) => URL.createObjectURL(f));
  $('#media-caption').value = '';
  $('#media-preview').innerHTML = files.map((f, i) => (f.type.startsWith('video/')
    ? `<div class="mp-item"><video src="${previewUrls[i]}" muted playsinline preload="metadata"></video><span class="mp-badge">Video</span></div>`
    : `<div class="mp-item"><img src="${previewUrls[i]}" alt=""></div>`)).join('');
  $('#media-preview').dataset.count = files.length;
}
$('#sheet-media').addEventListener('submit', (e) => {
  e.preventDefault();
  sheetOpts.onSend?.($('#media-caption').value.trim());
  closeSheet();
});
$('#media-caption').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) {
    e.preventDefault();
    $('#sheet-media').requestSubmit();
  }
});

/* ---------- Переслать: выбор чата ---------- */
$('#forward-list').addEventListener('click', (e) => {
  const item = e.target.closest('[data-forward]');
  if (!item) return;
  sheetOpts.onPick?.(item.dataset.forward);
  closeSheet();
});

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
