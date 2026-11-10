// Service worker Kosmo: push-уведомления, когда приложение закрыто.
// Кеша здесь нет — сайт всегда грузится свежим с сервера.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { d = { title: 'Kosmo', body: e.data?.text() ?? '' }; }
  const call = d.t === 'call';
  e.waitUntil((async () => {
    // приложение открыто и на экране — уведомление покажет оно само
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!call && wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'Kosmo', {
      body: d.body || '',
      tag: d.tag || undefined,
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: call ? [400, 200, 400, 200, 400] : [60],
      requireInteraction: call,
      data: { chat: d.chat || null, call, from: d.from || null },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { chat } = e.notification.data ?? {};
  const url = chat ? `/?chat=${encodeURIComponent(chat)}` : '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins[0];
    if (w) {
      await w.focus();
      if (chat) w.postMessage({ t: 'open-chat', chat });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
