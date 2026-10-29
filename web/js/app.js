// Kosmo: точка входа. Если эта вкладка уже вошла — сразу приложение,
// иначе заставка и вход/регистрация.

import { $, initTheme, initPress, initGuards, tab } from './core.js';
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

if (tab.get()) {
  $('#auth').hidden = true;
  // сессию могли завершить с другого устройства, пока вкладка была закрыта
  if (!showApp()) {
    tab.clear();
    showAuth();
  }
}
