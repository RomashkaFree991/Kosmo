// Kosmo: точка входа. Если эта вкладка уже вошла — сразу приложение,
// иначе заставка и вход/регистрация.

import { $, initTheme, initPress, initGuards, tab, toast } from './core.js';
import { boot } from './api.js';
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
initPress();
initGuards();
initColor();

initHome({ logout: showAuth });
initAuth({ signedIn: () => showApp() });

// Уже входили в этом браузере: сразу показываем кеш, затем свежие данные с сервера
const saved = tab.get();
if (saved?.token) {
  $('#auth').hidden = true;
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
