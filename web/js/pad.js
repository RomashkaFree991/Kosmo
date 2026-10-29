// Код-пароль: 4 ячейки и клавиатура как на iPhone — переиспользуемый блок
// (экран блокировки, смена кода-пароля, удаление аккаунта).

import { wait, shake } from './core.js';

const KEYS = [
  ['1', ' '], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
];
const DEL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>';

export function createPad(el, { length = 4, onComplete }) {
  el.innerHTML = `
    <div class="pass-cells" role="img" aria-label="0 of ${length} digits entered">${'<span class="pass-cell"></span>'.repeat(length)}</div>
    <div class="keypad">
      ${KEYS.map(([n, s]) => `<button type="button" class="key" data-k="${n}"><span class="key-num">${n}</span><span class="key-sub">${s.trim() || '&nbsp;'}</span></button>`).join('')}
      <span class="key-spacer" aria-hidden="true"></span>
      <button type="button" class="key" data-k="0"><span class="key-num">0</span></button>
      <button type="button" class="key key-del is-hidden" data-k="del" aria-label="Delete">${DEL}</button>
    </div>`;
  const cellsBox = el.querySelector('.pass-cells');
  const cells = [...el.querySelectorAll('.pass-cell')];
  const del = el.querySelector('.key-del');
  cells.forEach((c, i) => c.style.setProperty('--i', i));
  let code = '';
  let busy = false;

  function render() {
    cells.forEach((c, i) => {
      c.classList.toggle('is-filled', i < code.length);
      c.classList.toggle('is-active', i === code.length);
    });
    cellsBox.setAttribute('aria-label', `${code.length} of ${length} digits entered`);
    del.classList.toggle('is-hidden', !code.length);
  }

  async function press(k) {
    if (busy) return;
    if (k === 'del') code = code.slice(0, -1);
    else if (code.length < length) code += k;
    render();
    if (code.length === length) {
      busy = true;
      await wait(180);
      await onComplete(code, api);
    }
  }

  el.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    key.classList.add('is-down');
    const up = () => key.classList.remove('is-down');
    key.addEventListener('pointerup', up, { once: true });
    key.addEventListener('pointerleave', up, { once: true });
    press(key.dataset.k);
  });
  document.addEventListener('keydown', (e) => {
    // блок не на экране (скрыт, в закрытой панели) или печатают в поле ввода
    if (!el.offsetParent || el.closest('[inert]') || !(el.checkVisibility?.({ visibilityProperty: true }) ?? true)) return;
    if (e.target.closest?.('input, textarea')) return;
    const k = /^\d$/.test(e.key) ? e.key : e.key === 'Backspace' ? 'del' : null;
    if (!k) return;
    const btn = el.querySelector(`.key[data-k="${k}"]`);
    btn.classList.add('is-down');
    setTimeout(() => btn.classList.remove('is-down'), 120);
    press(k);
  });

  const api = {
    reset() { code = ''; busy = false; cellsBox.classList.remove('is-done', 'is-error'); render(); },
    async error() {
      shake(cellsBox);
      await wait(500);
      api.reset();
    },
    async success() {
      cellsBox.classList.add('is-done');
      navigator.vibrate?.([10, 40, 10]);
      await wait(600);
    },
  };
  render();
  return api;
}
