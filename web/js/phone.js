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
];

const flagUrl = (iso) => `https://flagcdn.com/${iso}.svg`;
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
