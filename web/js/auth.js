// Вход и регистрация.
// Регистрация: номер → код из SMS → новый код-пароль (4 цифры) → имя и @username → описание → «Sign up».
// Вход: номер → код из SMS → код-пароль, заданный при регистрации.

import {
  $, $$, root, wait, easing, toast, shake, refreshRefraction, paintAvatar, tab, networkInfo, deviceInfo,
} from './core.js';
import { api, boot } from './api.js';
import { createPhoneField, openSheet, closeSheet } from './phone.js';
import { showLoginQr, stopLoginQr } from './qrlogin.js';
import { createOtp } from './otp.js';

const auth = $('#auth');
const backBtn = $('#back-btn');

// Состояние текущей попытки входа/регистрации
const flow = { phone: null, ticket: null, exists: false, pass: null, mode: 'create' };
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
  // Планета в центре рисуется в настоящем большом размере (а не растянутой
  // картинкой через scale), поэтому остаётся чёткой. Отрицательные отступы
  // сохраняют место в раскладке прежним.
  const big = Math.round(Math.min(288, Math.min(innerWidth, innerHeight) * 0.6));
  const m = `${-(big - r.width) / 2}px`;
  const from = { transform: `translate(${dx}px, ${dy}px)`, width: `${big}px`, height: `${big}px`, margin: `${m} ${m} calc(${m} + 8px)` };
  const to = { transform: 'none', width: `${r.width}px`, height: `${r.height}px`, margin: '0 0 8px' };
  Object.assign(logo.style, from);

  await wait(1750);   // планета + оба кольца
  const flight = logo.animate([from, to], { duration: 1100, easing: easing.intro });
  ['transform', 'width', 'height', 'margin'].forEach((p) => logo.style.removeProperty(p));
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
  else if (target) showScreen(target, 'back', () => target === 'screen-phone' && phoneField.focus());
});

/* ---------------------------------------------------------------------------
   1. Номер телефона
   --------------------------------------------------------------------------- */
const phoneField = createPhoneField($('#phone-field'));
const submitBtn = $('#submit-btn');

$('#phone-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitBtn.classList.contains('is-loading')) return;
  if (!phoneField.isComplete()) {
    phoneField.shake();
    return;
  }
  flow.phone = phoneField.e164;
  networkInfo();   // заранее узнаём город для будущей сессии
  // В M3 кнопка морфится в круг: фиксируем ширину, чтобы переход был плавным
  submitBtn.style.width = `${submitBtn.offsetWidth}px`;
  requestAnimationFrame(() => submitBtn.classList.add('is-loading'));
  const stop = () => { submitBtn.classList.remove('is-loading'); submitBtn.style.removeProperty('width'); };
  // код отправляет сервер: SMS, Telegram или (в тестовом режиме) лог
  Promise.all([api('POST', '/api/auth/code', { phone: flow.phone }, { auth: false }), wait(600)])
    .then(([r]) => {
      paintHint(r);
      otp.reset();
      resendTimer();
      showScreen('screen-code', 'forward', () => otp.focus());
      stop();
    })
    .catch((err) => { stop(); phoneField.shake(); toast(err.message); });
});

// Вход по QR: другая вкладка, где уже вошли, сканирует код и подтверждает
$('#qr-btn').addEventListener('click', () => openSheet('qr', {
  renderQr: () => showLoginQr((session) => { closeSheet(); finish(session); }),
  onClose: stopLoginQr,
}));

/* ---------------------------------------------------------------------------
   2. Код из SMS
   --------------------------------------------------------------------------- */
// Подсказка, куда пришёл код. Telegram-бот: если номер ещё не привязан —
// кнопка открыть бота и поделиться номером, код придёт туда же
function paintHint(r) {
  const tg = $('#code-tg');
  tg.hidden = !(r.channel === 'tgbot' && r.bot);
  if (r.bot) tg.href = `https://t.me/${r.bot}`;
  tg.textContent = r.bot ? `Open @${r.bot}` : '';
  $('#code-hint').textContent = r.channel === 'tgbot'
    ? (r.linked ? `Code sent to Telegram · @${r.bot}` : 'Open our Telegram bot and share your number — the code will arrive there')
    : r.channel === 'telegram' ? `Code sent to Telegram · ${phoneField.e164}`
    : r.channel === 'log' ? 'Test mode: the code is in the server log' : `Code sent by SMS to ${phoneField.e164}`;
}

// «Отправить ещё раз» — через минуту
const resendBtn = $('#code-resend');
let resendTick = null;
function resendTimer() {
  clearInterval(resendTick);
  let left = 60;
  resendBtn.disabled = true;
  const paint = () => { resendBtn.textContent = left > 0 ? `Send again in ${left} s` : 'Send again'; };
  paint();
  resendTick = setInterval(() => {
    left -= 1;
    paint();
    if (left <= 0) { clearInterval(resendTick); resendBtn.disabled = false; }
  }, 1000);
}
resendBtn.addEventListener('click', async () => {
  resendBtn.disabled = true;
  try {
    paintHint(await api('POST', '/api/auth/code', { phone: flow.phone }, { auth: false }));
    toast('Code sent again');
    resendTimer();
  } catch (err) {
    toast(err.message);
    resendBtn.disabled = false;
  }
});
// Есть аккаунт с этим номером — спрашиваем его код-пароль, иначе создаём новый
const otp = createOtp($('#otp'), {
  verify: async (code) => {
    try {
      const r = await api('POST', '/api/auth/verify', { phone: flow.phone, code }, { auth: false });
      flow.ticket = r.ticket;
      flow.exists = r.exists;
      return true;
    } catch (err) {
      toast(err.message);
      return false;
    }
  },
  onComplete: () => openPasscode(flow.exists ? 'enter' : 'create'),
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
  if (key === 'del') pass = pass.slice(0, -1);
  else if (pass.length < 4) pass += key;
  renderPass();
  if (pass.length === 4) await submitPass();
}

async function submitPass() {
  passBusy = true;
  await wait(180);   // дать точке «вспыхнуть»
  let session = null;
  if (flow.mode === 'enter') {
    try {
      session = await api('POST', '/api/auth/login', { ticket: flow.ticket, passcode: pass, ...(await deviceAndPlace()) }, { auth: false });
    } catch (err) {
      attempts += 1;
      shake(passCells);
      await wait(500);
      passCells.classList.remove('is-error');
      pass = '';
      renderPass();
      passBusy = false;
      if (err.code !== 'wrong_passcode' || attempts >= 3) toast(err.message);
      if (err.code === 'bad_ticket') showScreen('screen-phone', 'back');
      return;
    }
  } else {
    flow.pass = pass;
  }
  passCells.classList.add('is-done');
  navigator.vibrate?.([10, 40, 10]);
  await wait(650);
  if (session) {
    finish(session);
    return;
  }
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
  if ($('#screen-pass').hidden || auth.hidden) return;
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
const RESERVED = ['kosmo', 'admin', 'support', 'settings', 'official'];
// 3–32 английские буквы или цифры, хотя бы одна буква
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9]{3,32}$/;

// @username можно оставить пустым
function usernameOk(value) {
  if (!value) return true;
  return USERNAME_RE.test(value) && !RESERVED.includes(value);
}

function prepareNameScreen() {
  paintAvatar($('#setup-avatar'), nameInput.value, nameInput.value);
  validateUsername();
}

function validateUsername() {
  const v = usernameInput.value;
  usernameField.classList.toggle('is-valid', Boolean(v) && usernameOk(v));
  usernameField.classList.toggle('is-invalid', v.length >= 3 && !usernameOk(v));
}

nameInput.addEventListener('input', () => {
  paintAvatar($('#setup-avatar'), nameInput.value, nameInput.value, true);
  $('#name-field').classList.remove('is-error');
});
usernameInput.addEventListener('input', () => {
  // только английские буквы и цифры
  const clean = usernameInput.value.toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const username = usernameInput.value;
  if (!name) {
    shake($('#name-field'));
    nameInput.focus();
    return;
  }
  if (!usernameOk(username)) {
    shake(usernameField);
    usernameField.classList.add('is-invalid');
    usernameInput.focus();
    if (USERNAME_RE.test(username)) toast('This username is taken');
    else if (username.length < 3) toast('At least 3 characters');
    else toast('Add at least one letter');
    return;
  }
  paintAvatar($('#bio-avatar'), name, name);
  $('#bio-name').textContent = name;
  $('#bio-username').textContent = username ? `@${username}` : '';
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
  try {
    const [session] = await Promise.all([api('POST', '/api/auth/register', {
      ticket: flow.ticket, passcode: flow.pass,
      name: nameInput.value.trim(), username: usernameInput.value, bio: bioInput.value.trim(),
      ...(await deviceAndPlace()),
    }, { auth: false }), wait(700)]);
    await finish(session);
  } catch (err) {
    toast(err.message);
    if (err.code === 'username_taken') showScreen('screen-name', 'back', () => usernameInput.focus());
    if (err.code === 'bad_ticket') showScreen('screen-phone', 'back');
  }
  signupBtn.classList.remove('is-loading');
  signupBtn.style.removeProperty('width');
});

/* ---------------------------------------------------------------------------
   Вход в приложение и выход из него
   --------------------------------------------------------------------------- */
async function deviceAndPlace() {
  const d = deviceInfo();
  const net = await networkInfo();
  return { device: { name: d.name, type: d.type }, location: net.location };
}

// Сессия получена: сохраняем вход, загружаем данные с сервера, открываем приложение
async function finish({ token, uid, sid }) {
  tab.set({ uid, sid, token });
  try {
    await boot();
  } catch (err) {
    tab.clear();
    toast(err.message);
    return;
  }
  root.classList.add('has-session');
  auth.classList.add('is-leaving');
  await wait(380);
  auth.hidden = true;
  auth.classList.remove('is-leaving');
  onSignedIn();
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
  phoneField.clear();
  auth.hidden = false;
  auth.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: easing.intro });
  refreshRefraction();
}

export function initAuth({ signedIn }) {
  onSignedIn = signedIn;
  playIntro();
}
