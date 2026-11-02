// Push-уведомления: сообщения и звонки, когда Kosmo закрыт (sw.js показывает их).
// На iPhone push работает только у сайта, добавленного на экран «Домой» (iOS 16.4+).

import { api } from './api.js';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let reg = null;
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  reg ??= await navigator.serviceWorker.register('/sw.js').catch(() => null);
  return reg;
}

// granted | denied | default | install (iPhone: сначала «На экран Домой») | unsupported
export function pushState() {
  if (isIOS() && !standalone()) return 'install';
  if (!supported()) return 'unsupported';
  return Notification.permission;
}

const b64ToBytes = (s) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function subscribeNow() {
  const r = await registerSW();
  if (!r) return false;
  await navigator.serviceWorker.ready;
  const { key } = await api('GET', '/api/push/key');
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api('POST', '/api/push/subscribe', { sub: sub.toJSON() });
  return true;
}

// Кнопка «Включить уведомления»: спросить разрешение и подписаться
export async function enablePush() {
  if (pushState() === 'install' || pushState() === 'unsupported') return pushState();
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  try { await subscribeNow(); } catch (e) { console.error('push', e); return 'error'; }
  return 'granted';
}

// После входа: разрешение уже есть — обновить подписку этого устройства
export function syncPush() {
  registerSW();
  if (pushState() === 'granted') subscribeNow().catch(() => {});
}

// Нажали на уведомление, когда Kosmo уже открыт
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.t === 'open-chat') document.dispatchEvent(new CustomEvent('kosmo:open-chat', { detail: e.data.chat }));
});
