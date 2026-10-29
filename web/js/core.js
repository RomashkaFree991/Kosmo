// Общие помощники: DOM, хранилище, пружины, тема, тост, ripple, аватары.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const root = document.documentElement;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  $$('.seg').forEach((seg) => {
    seg.addEventListener('pointerdown', () => seg.classList.add('is-pressing'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => seg.addEventListener(e, () => seg.classList.remove('is-pressing')));
    seg.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const next = $(`[data-set-theme="${root.dataset.theme === 'glass' ? 'material' : 'glass'}"]`, seg);
      next.focus();
      next.click();
    });
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
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 2400);
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
const AVATAR_COLORS = [
  ['#ff885e', '#ff516a'], ['#ffcd6a', '#ffa85c'], ['#82b1ff', '#665fff'], ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'], ['#72d5fd', '#2a9ef1'], ['#e0a2f3', '#d669ed'],
];

export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function avatarStyle(seed) {
  // FNV-1a: равномерно раскладывает имена по цветам
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  h ^= h >>> 15;   // перемешивание, чтобы близкие имена не попадали в один цвет
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  const [a1, a2] = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return `--a1:${a1};--a2:${a2}`;
}

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

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------------------
   Пользователи (демо: хранятся в localStorage этого браузера)
   --------------------------------------------------------------------------- */
export const users = {
  all() { return store.getJSON('users', {}); },
  get(phone) { return this.all()[phone] ?? null; },
  save(user) {
    const all = this.all();
    all[user.phone] = user;
    store.setJSON('users', all);
  },
  usernameTaken(username, exceptPhone) {
    return Object.values(this.all()).some((u) => u.username === username && u.phone !== exceptPhone);
  },
  current() {
    const phone = store.get('session');
    return phone ? this.get(phone) : null;
  },
};

// Код-пароль храним только в виде SHA-256 (где доступен WebCrypto)
export async function hashPasscode(phone, code) {
  if (!crypto.subtle) return `plain:${code}`;
  const data = new TextEncoder().encode(`kosmo:${phone}:${code}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
