// Kosmo: точка входа. Если пользователь уже вошёл — сразу приложение,
// иначе заставка и вход/регистрация.

import { $, initTheme, initPress, users, store } from './core.js';
import { initColor } from './color.js';
import { initAuth, showAuth } from './auth.js';
import { initHome, showApp } from './home.js';

initTheme();
initPress();
initColor();

initHome({ logout: showAuth });
initAuth({ signedIn: (user) => showApp(user) });

const current = users.current();
if (current) {
  $('#auth').hidden = true;
  showApp(current);
} else if (store.get('session')) {
  // сессия указывает на удалённый аккаунт — начинаем заново
  store.remove('session');
  showAuth();
}
