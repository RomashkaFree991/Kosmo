// Ввод кода из SMS: одно настоящее поле поверх ячеек.
// Каждая новая цифра «всплывает» в своей ячейке, стёртая — улетает вверх.

import { wait } from './core.js';

export function createOtp(el, { length = 6, onComplete }) {
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
    el.classList.add('is-done');
    input.disabled = true;
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

  return {
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
}
