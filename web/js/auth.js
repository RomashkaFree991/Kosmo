// Вход и регистрация.
// Регистрация: номер → код из SMS → новый код-пароль (4 цифры) → имя и @username → описание → «Sign up».
// Вход: номер → код из SMS → код-пароль, заданный при регистрации.

import {
  $, $$, root, store, wait, easing, toast, refreshRefraction, paintAvatar, users, hashPasscode,
} from './core.js';

const auth = $('#auth');
const backBtn = $('#back-btn');

// Состояние текущей попытки входа/регистрации
const flow = { phone: null, user: null, passHash: null, mode: 'create' };
let onSignedIn = () => {};

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
  const flight = logo.animate([{ transform: from }, { transform: 'none' }], { duration: 1100, easing: easing.intro });
  logo.style.removeProperty('transform');
  await wait(220);
  root.classList.add('is-ready');
  await flight.finished;
  await wait(900);
  root.classList.remove('is-intro');   // дальше планета просто «парит»
}

/* ---------------------------------------------------------------------------
   Переходы между экранами регистрации
   --------------------------------------------------------------------------- */
// Куда ведёт «назад» с каждого экрана
const BACK = { 'screen-code': 'screen-phone', 'screen-pass': 'screen-phone', 'screen-name': 'screen-pass', 'screen-bio': 'screen-name' };
let switching = false;

function showScreen(nextId, direction, onShown) {
  const current = $('.auth .screen.is-active');
  const next = $(`#${nextId}`);
  if (current === next || switching) return;
  switching = true;
  backBtn.hidden = true;
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
    backBtn.hidden = !BACK[nextId];
    switching = false;
    refreshRefraction();
    onShown?.();
  });
}

backBtn.addEventListener('click', () => {
  const current = $('.auth .screen.is-active');
  const target = BACK[current.id];
  if (target === 'screen-pass') openPasscode('create');
  else if (target) showScreen(target, 'back', () => target === 'screen-phone' && phone.focus({ preventScroll: true }));
});

/* ---------------------------------------------------------------------------
   1. Номер телефона: страны и маска (# — цифра)
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

const phoneField = $('#phone-field');
const phone = $('#phone');

const flagUrl = (iso) => `https://flagcdn.com/${iso}.svg`;
const maxDigits = () => country.mask.split('#').length - 1;
const phoneDigits = () => phone.value.replace(/\D/g, '');
const isComplete = () => phoneDigits().length === maxDigits();

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
  let digits = phoneDigits();
  // Вставили номер целиком: «+7 999…» или «8 999…»
  if (digits.length > maxDigits()) {
    if (digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    else if (country.dial === '7' && digits.startsWith('8')) digits = digits.slice(1);
  }
  phone.value = formatDigits(digits.slice(0, maxDigits()));
  phoneField.classList.toggle('has-value', phone.value.length > 0);
  if (isComplete()) phoneField.classList.remove('is-error');
}

function shake(el, cls = 'is-error') {
  el.classList.remove(cls);
  void el.offsetWidth; // перезапуск анимации тряски
  el.classList.add(cls);
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
    { duration: 450, easing: easing.bouncy },
  );
}

phone.addEventListener('input', onPhoneInput);
$('#clear-btn').addEventListener('click', () => {
  phone.value = '';
  onPhoneInput();
  phone.focus();
});

const submitBtn = $('#submit-btn');
$('#phone-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitBtn.classList.contains('is-loading')) return;
  if (!isComplete()) {
    shake(phoneField);
    phone.focus();
    return;
  }
  flow.phone = `+${country.dial}${phoneDigits()}`;
  flow.user = users.get(flow.phone);
  // В M3 кнопка морфится в круг: фиксируем ширину, чтобы переход был плавным
  submitBtn.style.width = `${submitBtn.offsetWidth}px`;
  requestAnimationFrame(() => submitBtn.classList.add('is-loading'));
  setTimeout(() => {
    resetOtp();
    showScreen('screen-code', 'forward', () => otpInput.focus({ preventScroll: true }));
    submitBtn.classList.remove('is-loading');
    submitBtn.style.removeProperty('width');
  }, 1000);
});

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
  const items = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q));
  $('#country-list').innerHTML = items.length
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
   2. Код из SMS: одно настоящее поле поверх шести ячеек.
   Каждая новая цифра «всплывает» в своей ячейке, стёртая — улетает вверх.
   --------------------------------------------------------------------------- */
const otp = $('#otp');
const otpInput = $('#otp-input');
const otpCells = $$('.otp-cell');
const CODE_LENGTH = otpCells.length;
let shown = '';

otpCells.forEach((c, i) => c.style.setProperty('--i', i));

function renderOtp() {
  const value = otpInput.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
  otpInput.value = value;
  otpCells.forEach((cell, i) => {
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

async function finishOtp() {
  otp.classList.add('is-done');
  otpInput.disabled = true;
  otpInput.blur();
  navigator.vibrate?.([10, 40, 10]);
  await wait(750);
  // Есть аккаунт с этим номером — спрашиваем его код-пароль, иначе создаём новый
  openPasscode(flow.user ? 'enter' : 'create');
}

function resetOtp() {
  otp.classList.remove('is-done');
  otpInput.disabled = false;
  otpInput.value = '';
  otpCells.forEach((c) => c.replaceChildren());
  shown = '';
  renderOtp();
}

otpInput.addEventListener('input', renderOtp);
otpInput.addEventListener('focus', () => otp.classList.add('is-focused'));
otpInput.addEventListener('blur', () => otp.classList.remove('is-focused'));
// Курсор всегда в конце: стрелки и клики не двигают его внутрь кода
otpInput.addEventListener('click', () => requestAnimationFrame(() => otpInput.setSelectionRange(otpInput.value.length, otpInput.value.length)));
otpInput.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
});

/* ---------------------------------------------------------------------------
   3. Код-пароль: 4 ячейки и клавиатура как на iPhone
   --------------------------------------------------------------------------- */
const passCells = $('#pass-cells');
const passCellEls = $$('.pass-cell');
const keypad = $('#keypad');
const delKey = $('.key-del');
let pass = '';
let passBusy = false;
let attempts = 0;

passCellEls.forEach((c, i) => c.style.setProperty('--i', i));

function renderPass() {
  passCellEls.forEach((cell, i) => {
    cell.classList.toggle('is-filled', i < pass.length);
    cell.classList.toggle('is-active', i === pass.length);
  });
  passCells.setAttribute('aria-label', `${pass.length} of 4 digits entered`);
  delKey.classList.toggle('is-hidden', pass.length === 0);
}

function openPasscode(mode) {
  flow.mode = mode;
  pass = '';
  passBusy = false;
  attempts = 0;
  passCells.classList.remove('is-done', 'is-error');
  $('#pass-title').textContent = mode === 'create' ? 'Create passcode' : 'Enter passcode';
  renderPass();
  const fromBack = $('.auth .screen.is-active')?.id === 'screen-name';
  showScreen('screen-pass', fromBack ? 'back' : 'forward');
}

async function pressKey(key) {
  if (passBusy || $('#screen-pass').hidden) return;
  if (key === 'del') {
    pass = pass.slice(0, -1);
  } else if (pass.length < 4) {
    pass += key;
  }
  renderPass();
  if (pass.length === 4) await submitPass();
}

async function submitPass() {
  passBusy = true;
  await wait(180);   // дать точке «вспыхнуть»
  const hash = await hashPasscode(flow.phone, pass);
  if (flow.mode === 'enter' && hash !== flow.user.passHash) {
    attempts += 1;
    shake(passCells);
    await wait(500);
    passCells.classList.remove('is-error');
    pass = '';
    renderPass();
    passBusy = false;
    if (attempts >= 3) toast('Wrong passcode');
    return;
  }
  passCells.classList.add('is-done');
  navigator.vibrate?.([10, 40, 10]);
  await wait(650);
  if (flow.mode === 'enter') {
    signIn(flow.user);
    return;
  }
  flow.passHash = hash;
  prepareNameScreen();
  showScreen('screen-name', 'forward', () => nameInput.focus({ preventScroll: true }));
}

// Нажатие: подсветка сразу, гаснет медленно после отпускания (как на iOS)
keypad.addEventListener('pointerdown', (e) => {
  const key = e.target.closest('.key');
  if (!key) return;
  e.preventDefault();
  key.classList.add('is-down');
  const up = () => key.classList.remove('is-down');
  key.addEventListener('pointerup', up, { once: true });
  key.addEventListener('pointerleave', up, { once: true });
  key.addEventListener('pointercancel', up, { once: true });
  pressKey(key.dataset.key);
});
// Клавиатура тоже работает (и подсвечивает кнопку на экране)
document.addEventListener('keydown', (e) => {
  if ($('#screen-pass').hidden) return;
  const key = /^\d$/.test(e.key) ? e.key : e.key === 'Backspace' ? 'del' : null;
  if (!key) return;
  const btn = $(`.key[data-key="${key}"]`);
  btn.classList.add('is-down');
  setTimeout(() => btn.classList.remove('is-down'), 120);
  pressKey(key);
});

/* ---------------------------------------------------------------------------
   4. Имя и @username
   --------------------------------------------------------------------------- */
const nameInput = $('#name-input');
const usernameInput = $('#username-input');
const usernameField = $('#username-field');
const RESERVED = ['kosmo', 'admin', 'support', 'settings', 'username'];
const USERNAME_RE = /^[a-z][a-z0-9_]{4,31}$/;

function usernameOk(value) {
  return USERNAME_RE.test(value) && !RESERVED.includes(value) && !users.usernameTaken(value, flow.phone);
}

function prepareNameScreen() {
  paintAvatar($('#setup-avatar'), nameInput.value, usernameInput.value || nameInput.value);
  validateUsername();
}

function validateUsername() {
  const v = usernameInput.value;
  usernameField.classList.toggle('is-valid', usernameOk(v));
  usernameField.classList.toggle('is-invalid', v.length >= 5 && !usernameOk(v));
}

nameInput.addEventListener('input', () => {
  paintAvatar($('#setup-avatar'), nameInput.value, nameInput.value, true);
  $('#name-field').classList.remove('is-error');
});
usernameInput.addEventListener('input', () => {
  // только строчные латинские буквы, цифры и подчёркивания
  const clean = usernameInput.value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  if (clean !== usernameInput.value) usernameInput.value = clean;
  usernameField.classList.remove('is-error');
  validateUsername();
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); usernameInput.focus(); }
});

$('#name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    shake($('#name-field'));
    nameInput.focus();
    return;
  }
  if (!usernameOk(usernameInput.value)) {
    shake(usernameField);
    usernameField.classList.add('is-invalid');
    usernameInput.focus();
    if (users.usernameTaken(usernameInput.value, flow.phone) || RESERVED.includes(usernameInput.value)) toast('This username is taken');
    else toast('5–32 characters: a–z, 0–9, _');
    return;
  }
  paintAvatar($('#bio-avatar'), name, name);
  $('#bio-name').textContent = name;
  $('#bio-username').textContent = `@${usernameInput.value}`;
  showScreen('screen-bio', 'forward', () => bioInput.focus({ preventScroll: true }));
});

/* ---------------------------------------------------------------------------
   5. Описание и «Sign up»
   --------------------------------------------------------------------------- */
const bioInput = $('#bio-input');
const counter = $('#bio-counter');
const signupBtn = $('#signup-btn');

bioInput.addEventListener('input', () => {
  const left = 70 - bioInput.value.length;
  counter.textContent = left;
  counter.classList.toggle('is-low', left <= 10);
});

$('#bio-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (signupBtn.classList.contains('is-loading')) return;
  signupBtn.style.width = `${signupBtn.offsetWidth}px`;
  requestAnimationFrame(() => signupBtn.classList.add('is-loading'));
  const user = {
    phone: flow.phone,
    passHash: flow.passHash,
    name: nameInput.value.trim(),
    username: usernameInput.value,
    bio: bioInput.value.trim(),
    createdAt: Date.now(),
  };
  users.save(user);
  await wait(900);
  signupBtn.classList.remove('is-loading');
  signupBtn.style.removeProperty('width');
  signIn(user, true);
});

/* ---------------------------------------------------------------------------
   Вход в приложение и выход из него
   --------------------------------------------------------------------------- */
async function signIn(user, isNew = false) {
  store.set('session', user.phone);
  auth.classList.add('is-leaving');
  await wait(380);
  auth.hidden = true;
  auth.classList.remove('is-leaving');
  onSignedIn(user, { isNew });
}

// После выхода: чистый экран номера телефона
export function showAuth() {
  root.classList.remove('has-session');
  root.classList.add('is-ready');
  $$('.auth .screen').forEach((s) => {
    s.hidden = s.id !== 'screen-phone';
    s.classList.toggle('is-active', s.id === 'screen-phone');
  });
  backBtn.hidden = true;
  [nameInput, usernameInput, bioInput].forEach((i) => { i.value = ''; });
  counter.textContent = '70';
  phone.value = '';
  onPhoneInput();
  auth.hidden = false;
  auth.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: easing.intro });
  refreshRefraction();
}

export function initAuth({ signedIn }) {
  onSignedIn = signedIn;
  setCountry(country);
  playIntro();
}
