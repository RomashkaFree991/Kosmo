// Ввод кода из SMS: одно настоящее поле поверх ячеек.
// Каждая новая цифра «всплывает» в своей ячейке, стёртая — улетает вверх.

import { wait } from './core.js';

// verify(code) → false, если код неверный: ячейки трясутся и очищаются
export function createOtp(el, { length = 6, onComplete, verify }) {
  el.innerHTML = `
    <input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="${length}" aria-label="${length}-digit code">
    <div class="otp-cells" aria-hidden="true">${'<span class="otp-cell"></span>'.repeat(length)}</div>`;
  const input = el.querySelector('.otp-input');
  const cells = [...el.querySelectorAll('.otp-cell')];
  let shown = '';
  cells.forEach((c, i) => c.style.setProperty('--i', i));

  function render() {
    const value = input.value.replace(/\D/g, '').slice(0, length);
    input.value = value;
    cells.forEach((cell, i) => {
      if (value[i] !== shown[i]) {
        cell.querySelectorAll('.digit:not(.is-out)').forEach((old) => {
          old.classList.add('is-out');
          old.addEventListener('animationend', () => old.remove(), { once: true });
        });
        if (value[i]) {
          const digit = document.createElement('span');
          digit.className = 'digit';
          digit.textContent = value[i];
          cell.append(digit);
        }
      }
      cell.classList.toggle('is-filled', Boolean(value[i]));
      cell.classList.toggle('is-active', i === Math.min(value.length, length - 1));
    });
    shown = value;
    if (value.length === length) finish(value);
  }

  async function finish(value) {
    input.disabled = true;
    if (verify) {
      el.classList.add('is-checking');
      const ok = await verify(value).catch(() => false);
      el.classList.remove('is-checking');
      if (ok === false) {
        el.classList.add('is-error');
        navigator.vibrate?.([30, 50, 30]);
        await wait(450);
        el.classList.remove('is-error');
        api.reset();
        input.focus({ preventScroll: true });
        return;
      }
    }
    el.classList.add('is-done');
    input.blur();
    navigator.vibrate?.([10, 40, 10]);
    await wait(750);
    onComplete(value);
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', () => el.classList.add('is-focused'));
  input.addEventListener('blur', () => el.classList.remove('is-focused'));
  // Курсор всегда в конце: стрелки и клики не двигают его внутрь кода
  input.addEventListener('click', () => requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length)));
  input.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
  });

  const api = {
    reset() {
      el.classList.remove('is-done');
      input.disabled = false;
      input.value = '';
      cells.forEach((c) => c.replaceChildren());
      shown = '';
      render();
    },
    focus: () => input.focus({ preventScroll: true }),
  };
  return api;
}
