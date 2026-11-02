// Material You: значки Material Symbols (Rounded) вместо своих SVG в строках
// настроек и профиля. В Liquid Glass значки остаются прежними (.ms скрыт).

const ICONS = {
  'data-open-saved': 'bookmark', 'data-open-bookmarks': 'star', 'data-open-dnd': 'do_not_disturb_on',
  'data-open-stats': 'bar_chart', 'data-open-edit': 'edit', 'data-open-design': 'palette',
  'data-open-email': 'mail', 'data-open-sessions': 'devices', 'data-open-backup': 'cloud_download',
  'data-open-bots': 'smart_toy', 'data-clear-cache': 'delete_sweep', 'data-add-account': 'person_add',
  'data-open-settings=privacy': 'lock', 'data-open-settings=security': 'shield',
  'data-open-settings=notifications': 'notifications', 'data-open-settings=storage': 'database',
  'data-open-settings=about': 'info', 'data-sec=passcode': 'password', 'data-sec=forgot': 'lock_reset',
  'data-sec=delete': 'delete_forever', 'logout-btn': 'logout',
};

// Liquid Glass: Phosphor (заливка), белые на цветных квадратах, как в iOS
const GLASS = {
  'data-open-saved': 'bookmark-simple', 'data-open-bookmarks': 'star', 'data-open-dnd': 'moon',
  'data-open-stats': 'chart-bar', 'data-open-edit': 'pencil-simple', 'data-open-design': 'palette',
  'data-open-email': 'envelope-simple', 'data-open-sessions': 'devices', 'data-open-backup': 'cloud-arrow-down',
  'data-open-bots': 'robot', 'data-clear-cache': 'broom', 'data-add-account': 'user-plus',
  'data-open-settings=privacy': 'lock-simple', 'data-open-settings=security': 'shield-check',
  'data-open-settings=notifications': 'bell-simple', 'data-open-settings=storage': 'database',
  'data-open-settings=about': 'info', 'data-sec=passcode': 'password', 'data-sec=forgot': 'key',
  'data-sec=delete': 'trash', 'logout-btn': 'sign-out',
};

function symbolFor(el, map = ICONS) {
  if (el.id && map[el.id]) return map[el.id];
  for (const a of el.attributes) {
    if (!a.name.startsWith('data-')) continue;
    const hit = map[`${a.name}=${a.value}`] ?? map[a.name];
    if (hit) return hit;
  }
  return null;
}


function decorate(root) {
  root.querySelectorAll?.('.group-row .row-icon:not([data-ms])').forEach((ic) => {
    ic.dataset.ms = '';
    const row = ic.closest('.group-row');
    const sym = symbolFor(row);
    const gl = symbolFor(row, GLASS);
    if (gl) ic.insertAdjacentHTML('afterbegin', `<i class="gi ph-fill ph-${gl}" aria-hidden="true"></i>`);
    if (sym) ic.insertAdjacentHTML('afterbegin', `<span class="ms" aria-hidden="true">${sym}</span>`);
  });
}

export function initM3() {
  decorate(document);
  new MutationObserver((recs) => {
    for (const r of recs) r.addedNodes.forEach((n) => { if (n.nodeType === 1) decorate(n.parentElement ?? n); });
  }).observe(document.body, { childList: true, subtree: true });
}
