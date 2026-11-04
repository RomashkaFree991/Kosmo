// До первого кадра: тема, вошла ли эта вкладка, нужна ли заставка
// (отдельный файл, а не встроенный скрипт: политика безопасности запрещает inline-скрипты)
(function () {
      var root = document.documentElement;
      try { if (localStorage.getItem('kosmo:theme') === 'material') root.dataset.theme = 'material'; } catch (e) {}
      // светлая или тёмная схема: dark | light | auto (как в системе)
      var mode = 'dark';
      try { mode = localStorage.getItem('kosmo:scheme') || 'dark'; } catch (e) {}
      root.dataset.scheme = mode === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
      var signedIn = false;
      try { signedIn = Boolean(sessionStorage.getItem('kosmo:auth') || localStorage.getItem('kosmo:auth')); } catch (e) {}
      if (signedIn) root.classList.add('has-session');
      else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('is-intro');
    })();
try { localStorage.removeItem('kosmo:holiday'); } catch (e) {}
