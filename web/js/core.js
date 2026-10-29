// Общие помощники: DOM, хранилище, пружины, тема, тост, ripple, аватары,
// аккаунты и сессии (демо: всё хранится в браузере), «космические» галочки.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const root = document.documentElement;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export const store = {
  get(key) { try { return localStorage.getItem(`kosmo:${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`kosmo:${key}`, value); } catch { /* приватный режим */ } },
  remove(key) { try { localStorage.removeItem(`kosmo:${key}`); } catch { /* приватный режим */ } },
  getJSON(key, fallback) {
    try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; }
  },
  setJSON(key, value) { this.set(key, JSON.stringify(value)); },
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

export const easing = {
  intro: 'cubic-bezier(0.32, 0.72, 0, 1)',
  bouncy: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
};
if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
  const smooth = springEasing({ stiffness: 260, damping: 30 });
  const bouncy = springEasing({ stiffness: 380, damping: 22 });
  easing.intro = springEasing({ stiffness: 120, damping: 17 }).easing;
  easing.bouncy = bouncy.easing;
  root.style.setProperty('--spring', smooth.easing);
  root.style.setProperty('--spring-dur', `${smooth.duration}ms`);
  root.style.setProperty('--spring-bouncy', bouncy.easing);
  root.style.setProperty('--spring-bouncy-dur', `${bouncy.duration}ms`);
}

/* ---------------------------------------------------------------------------
   Тема
   --------------------------------------------------------------------------- */
export function refreshRefraction() {
  // В Material You стекла нет: data-rt заставляет refraction.js снять фильтры
  root.toggleAttribute('data-rt', root.dataset.theme !== 'glass');
  window.LiquidGlassRefraction?.refresh();
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  $$('[data-set-theme]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setTheme === theme)));
  store.set('theme', theme);
  document.dispatchEvent(new CustomEvent('kosmo:theme', { detail: theme }));
  refreshRefraction();
}

// Плавная смена через View Transitions: круг раскрывается из точки (x, y)
export function withTransition(fn, x = innerWidth / 2, y = innerHeight) {
  if (!document.startViewTransition || reducedMotion.matches) {
    fn();
    return;
  }
  root.style.setProperty('--vt-x', `${x}px`);
  root.style.setProperty('--vt-y', `${y}px`);
  root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  document.startViewTransition(fn);
}

export function initTheme() {
  applyTheme(store.get('theme') === 'material' ? 'material' : 'glass');
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-theme]');
    if (!btn || btn.dataset.setTheme === root.dataset.theme) return;
    const r = btn.getBoundingClientRect();
    withTransition(() => applyTheme(btn.dataset.setTheme), r.left + r.width / 2, r.top + r.height / 2);
  });
  document.addEventListener('pointerdown', (e) => e.target.closest('.seg')?.classList.add('is-pressing'));
  document.addEventListener('pointerup', () => $$('.seg.is-pressing').forEach((s) => s.classList.remove('is-pressing')));
  document.addEventListener('keydown', (e) => {
    const seg = e.target.closest?.('.seg');
    if (!seg || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const next = $(`[data-set-theme="${root.dataset.theme === 'glass' ? 'material' : 'glass'}"]`, seg);
    next.focus();
    next.click();
  });
}

/* ---------------------------------------------------------------------------
   Тост
   --------------------------------------------------------------------------- */
let toastTimer = null;
export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 2600);
}

export function shake(el, cls = 'is-error') {
  el.classList.remove(cls);
  void el.offsetWidth; // перезапуск анимации тряски
  el.classList.add(cls);
  navigator.vibrate?.(30);
}

/* ---------------------------------------------------------------------------
   Ripple (Material) и «проседание» кнопок
   --------------------------------------------------------------------------- */
export function initPress() {
  document.addEventListener('pointerdown', (e) => {
    const host = e.target.closest('.btn, .ripple-host');
    if (!host) return;
    host.classList.add('is-pressed');
    const release = () => {
      host.classList.remove('is-pressed');
      host.querySelectorAll('.ripple').forEach((r) => r.classList.add('is-out'));
      setTimeout(() => host.querySelectorAll('.ripple.is-out').forEach((r) => r.remove()), 600);
    };
    host.addEventListener('pointerup', release, { once: true });
    host.addEventListener('pointerleave', release, { once: true });

    if (root.dataset.theme !== 'material') return;
    const r = host.getBoundingClientRect();
    const size = Math.hypot(r.width, r.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - r.left - size / 2}px`;
    ripple.style.top = `${e.clientY - r.top - size / 2}px`;
    host.append(ripple);
  });
}

/* ---------------------------------------------------------------------------
   Аватары: инициалы на градиенте, цвет стабилен для имени
   --------------------------------------------------------------------------- */
export const AVATAR_COLORS = [
  ['#ff885e', '#ff516a'], ['#ffcd6a', '#ffa85c'], ['#82b1ff', '#665fff'], ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'], ['#72d5fd', '#2a9ef1'], ['#e0a2f3', '#d669ed'],
];

export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const colorStyle = ([a1, a2]) => `--a1:${a1};--a2:${a2}`;

export function avatarStyle(seed) {
  // FNV-1a: равномерно раскладывает имена по цветам
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  h ^= h >>> 15;   // перемешивание, чтобы близкие имена не попадали в один цвет
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return colorStyle(AVATAR_COLORS[h % AVATAR_COLORS.length]);
}

// Аватар пользователя с его настройками: своё фото, цвет, свои буквы
export function userAvatarHtml(user, cls = '') {
  const a = user.avatar ?? {};
  const style = a.color != null ? colorStyle(AVATAR_COLORS[a.color]) : avatarStyle(user.name);
  const text = escapeHtml(a.text || initials(user.name));
  const photo = a.photo ? `<img data-media="${a.photo}" alt="">` : '';
  return `<span class="avatar ${cls}${a.photo ? ' has-photo' : ''}" style="${style}" aria-hidden="true">${photo}<span>${text}</span></span>`;
}

export const newPublicId = () => String(Math.floor(1e9 + Math.random() * 9e9));

const PERSON_SVG = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>';

// Обновить аватар-элемент; animate — «подпрыгнуть», если инициалы поменялись
export function paintAvatar(el, name, seed = name, animate = false) {
  const text = initials(name);
  const span = el.firstElementChild;
  el.classList.toggle('is-empty', !text);
  el.classList.toggle('avatar-icon', !text);
  if (text) el.style.cssText = avatarStyle(seed || name);
  else el.style.removeProperty('--a1');
  const next = text || PERSON_SVG;
  if (span.innerHTML === next) return;
  span.innerHTML = next;
  if (animate) {
    span.classList.remove('pop');
    void span.offsetWidth;
    span.classList.add('pop');
  }
}

// Аватар официального аккаунта: планета Kosmo на звёздном небе
export function kosmoAvatar(cls = '') {
  return `<span class="avatar avatar-kosmo ${cls}" aria-hidden="true">
    <svg viewBox="0 0 120 120">
      <circle cx="22" cy="28" r="1.6" fill="#fff" opacity=".8"/><circle cx="96" cy="22" r="1.2" fill="#fff" opacity=".6"/>
      <circle cx="100" cy="94" r="1.8" fill="#fff" opacity=".7"/><circle cx="18" cy="90" r="1.1" fill="#fff" opacity=".5"/>
      <g transform="rotate(-18 60 60)"><path d="M10 60 A50 13 0 0 1 110 60" fill="none" stroke="url(#k-ring)" stroke-width="5" stroke-linecap="round"/></g>
      <circle cx="60" cy="60" r="27" fill="url(#k-fill)"/><circle cx="60" cy="60" r="27" fill="url(#k-shade)"/>
      <g transform="rotate(-18 60 60)"><path d="M10 60 A50 13 0 0 0 110 60" fill="none" stroke="url(#k-ring)" stroke-width="5" stroke-linecap="round"/></g>
    </svg>
  </span>`;
}

// «Космическая» галочка: планета с кольцом и галочкой.
// official — официальные аккаунты (фиолетовая), owner — владелец (золотая)
export function cosmicBadge(kind = 'official') {
  const label = kind === 'owner' ? 'Owner' : 'Official';
  return `<svg class="cosmic-badge cosmic-${kind}" viewBox="0 0 24 24" role="img" aria-label="${label}">
    <title>${label}</title>
    <g transform="rotate(-24 12 12)"><path d="M0.9 12 A11.1 3.3 0 0 1 23.1 12" fill="none" stroke="url(#cb-ring)" stroke-width="1.3" stroke-linecap="round"/></g>
    <circle cx="12" cy="12" r="8.4" fill="url(#cb-${kind})"/>
    <g transform="rotate(-24 12 12)"><path d="M0.9 12 A11.1 3.3 0 0 0 23.1 12" fill="none" stroke="url(#cb-ring)" stroke-width="1.3" stroke-linecap="round"/></g>
    <path d="M8.5 12.1l2.4 2.4 4.6-4.9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="20.4" cy="4" r="1.05" fill="#fff"/><circle cx="3.4" cy="19.6" r="0.75" fill="#fff" opacity=".7"/>
  </svg>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------------------
   Устройство, IP и местоположение
   --------------------------------------------------------------------------- */
export function deviceInfo(ua = navigator.userAgent) {
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /YaBrowser/.test(ua) ? 'Yandex Browser'
    : /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const type = /iPhone|Android.+Mobile/.test(ua) ? 'phone' : /iPad|Android/.test(ua) ? 'tablet' : 'desktop';
  return { browser, os, type, name: `${browser} on ${os}` };
}

// IP и город узнаём у ipwho.is (без ключа); если не вышло — «Unknown»
let networkPromise = null;
export function networkInfo() {
  networkPromise ??= (async () => {
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
      const j = await res.json();
      if (j.success === false || !j.ip) throw new Error('lookup failed');
      return { ip: j.ip, location: [j.city, j.country].filter(Boolean).join(', ') || 'Unknown' };
    } catch {
      try {
        const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        return { ip: (await res.json()).ip, location: 'Unknown' };
      } catch {
        return { ip: 'Unknown', location: 'Unknown' };
      }
    }
  })();
  return networkPromise;
}

/* ---------------------------------------------------------------------------
   Аккаунты и сессии (демо: localStorage этого браузера)
   Каждая вкладка — отдельная сессия (sessionStorage), как отдельное устройство.
   --------------------------------------------------------------------------- */
export const db = {
  all() { return store.getJSON('accounts', {}); },
  get(id) { return this.all()[id] ?? null; },
  byPhone(phone) { return Object.values(this.all()).find((u) => u.phone === phone) ?? null; },
  save(user) {
    const all = this.all();
    all[user.id] = user;
    store.setJSON('accounts', all);
    return user;
  },
  update(id, fn) {
    const user = this.get(id);
    if (!user) return null;
    fn(user);
    return this.save(user);
  },
  usernameTaken(username, exceptId) {
    return Object.values(this.all()).some((u) => u.username === username && u.id !== exceptId);
  },
  isEmpty() { return Object.keys(this.all()).length === 0; },
};

// Аккаунты из прошлой версии (ключ — номер телефона, без сессий)
(function migrate() {
  const old = store.getJSON('users', null);
  if (!old) return;
  for (const u of Object.values(old)) {
    if (db.byPhone(u.phone)) continue;
    db.save({ ...u, id: uid(), passSalt: u.phone, sessions: [], messages: [], role: db.isEmpty() ? 'owner' : 'user' });
  }
  store.remove('users');
  store.remove('session');
})();

// Поля, появившиеся позже: публичный ID, аватар, настройки чатов
(function upgrade() {
  const all = db.all();
  let changed = false;
  for (const u of Object.values(all)) {
    if (!u.publicId) { u.publicId = newPublicId(); changed = true; }
    if (!u.avatar) { u.avatar = { color: null, text: '', photo: null }; changed = true; }
    if (!u.chatPrefs) { u.chatPrefs = {}; changed = true; }
  }
  if (changed) store.setJSON('accounts', all);
})();

export const tab = {
  get() { try { return JSON.parse(sessionStorage.getItem('kosmo:auth')); } catch { return null; } },
  set(value) { try { sessionStorage.setItem('kosmo:auth', JSON.stringify(value)); } catch { /* приватный режим */ } },
  clear() { try { sessionStorage.removeItem('kosmo:auth'); } catch { /* приватный режим */ } },
};

// Текущий вошедший аккаунт этой вкладки, если его сессия ещё жива
export function current() {
  const t = tab.get();
  if (!t) return null;
  const user = db.get(t.uid);
  const session = user?.sessions.find((s) => s.id === t.sid);
  return session ? { user, session } : null;
}

// Новая сессия: при регистрации — «Welcome», при входе — «New login» в чате Kosmo
export async function startSession(user, { isNew }) {
  const net = await networkInfo();
  const dev = deviceInfo();
  const now = Date.now();
  const session = {
    id: uid(),
    ...dev,
    ip: net.ip,
    location: net.location,
    createdAt: now,
    lastActive: now,
    first: isNew,
    // владелец при создании аккаунта сразу доверенный; если доверенных не осталось — тоже
    trusted: isNew || !user.sessions.some((s) => s.trusted),
  };
  user.sessions.push(session);
  user.messages.push({
    id: uid(),
    kind: isNew ? 'welcome' : 'login',
    at: now,
    sid: session.id,
    device: session.name,
    type: session.type,
    ip: session.ip,
    location: session.location,
  });
  db.save(user);
  tab.set({ uid: user.id, sid: session.id });
  return session;
}

// Код-пароль храним только в виде SHA-256 (где доступен WebCrypto)
export async function hashPasscode(salt, code) {
  if (!crypto.subtle) return `plain:${code}`;
  const data = new TextEncoder().encode(`kosmo:${salt}:${code}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------------------------------------------------------------------
   Даты
   --------------------------------------------------------------------------- */
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
export const formatDate = (t) => dateFmt.format(t);
export const formatTime = (t) => timeFmt.format(t);
export function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return formatDate(t);
}
