// Состояние вкладки и боковые панели приложения.
// Панели выезжают справа, основной экран и нижняя панель уходят.

import { $, current, refreshRefraction } from './core.js';

export const state = {
  acc: null,   // { user, session } этой вкладки
  reload() { this.acc = current(); return this.acc; },
};

const app = $('#app');
const tabbar = $('#tabbar');
let openId = null;
let opener = null;
const closeHooks = new Map();

export const panelOpen = () => openId;

export function onPanelClose(id, fn) { closeHooks.set(id, fn); }

export function openPanel(id) {
  if (openId === id) return;
  if (openId) closePanel({ instant: true });
  document.dispatchEvent(new CustomEvent('kosmo:panel-open', { detail: id }));
  const panel = $(`#panel-${id}`);
  opener = document.activeElement;
  openId = id;
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('is-open');
  app.classList.add('has-panel');
  $('#views').inert = true;
  tabbar.inert = true;
  refreshRefraction();
}

export function closePanel({ instant = false } = {}) {
  if (!openId) return;
  const id = openId;
  const panel = $(`#panel-${id}`);
  if (instant) {
    panel.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => panel.style.removeProperty('transition')));
  }
  panel.classList.remove('is-open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  openId = null;
  closeHooks.get(id)?.();
  if (!instant) {
    app.classList.remove('has-panel');
    $('#views').inert = false;
    tabbar.inert = false;
    opener?.focus?.({ preventScroll: true });
  }
}

export function resetPanels() {
  closePanel({ instant: true });
  app.classList.remove('has-panel');
  $('#views').inert = false;
  tabbar.inert = false;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-panel]')) closePanel();
});
