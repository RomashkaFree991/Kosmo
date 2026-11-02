// Kosmo: точка входа. Если эта вкладка уже вошла — сразу приложение,
// иначе заставка и вход/регистрация.

import { $, initTheme, initPress, initGuards, initKeyboard, tab, toast } from './core.js';
import { boot } from './api.js';
import { initGlisse } from './glisse.js';
import { initM3 } from './m3.js';
import { initColor } from './color.js';
import { initDesign } from './design.js';
import { initEmoji } from './emoji.js';
import { applyLang } from './i18n.js';
import { initAuth, showAuth } from './auth.js';
import { initHome, showApp } from './home.js';

initEmoji();
applyLang();
initDesign();
initTheme();
initGlisse();
initM3();
initPress();
initGuards();
initKeyboard();
initColor();

initHome({ logout: showAuth });

// Заставка при запуске (уже вошли): планета рисуется, кольца, затем экран растворяется
function showSplash() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const logo = $('#logo')?.cloneNode(true);
  if (!logo) return;
  logo.removeAttribute('id');
  // экран входа скрыт, а Chrome не рисует градиенты из скрытого SVG — берём общие из спрайта
  logo.querySelector('defs')?.remove();
  logo.querySelectorAll('[fill="url(#planet-fill)"]').forEach((n) => n.setAttribute('fill', 'url(#k-fill)'));
  logo.querySelectorAll('[fill="url(#planet-shade)"]').forEach((n) => n.setAttribute('fill', 'url(#k-shade)'));
  logo.querySelectorAll('.ring').forEach((n) => { n.style.stroke = 'url(#k-ring)'; });
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.append(logo);
  document.body.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 800);
  }, 1500);
}
initAuth({ signedIn: () => showApp() });

// Уже входили в этом браузере: сразу показываем кеш, затем свежие данные с сервера
const saved = tab.get();
if (saved?.token) {
  $('#auth').hidden = true;
  showSplash();
  const fromCache = showApp();
  boot()
    .then(() => {
      if (fromCache) document.dispatchEvent(new CustomEvent('kosmo:remote'));
      else if (!showApp()) { tab.clear(); showAuth(); }
    })
    .catch((err) => {
      if (err.status === 401) return;            // сессия завершена — home.js выйдет сам
      if (!fromCache) { showAuth(); toast(err.message); }
    });
} else if (saved) {
  tab.clear();
}
