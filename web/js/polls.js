// Опросы и викторины в группах и каналах: создание, голосование,
// результаты с полосками; в викторине — правильный ответ и пояснение.

import { $, $$, toast, shake, escapeHtml, uid, refreshRefraction } from './core.js';
import { state } from './panels.js';
import { chats } from './chats.js';

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  cross: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
};

/* ---------------------------------------------------------------------------
   Отрисовка в сообщении
   --------------------------------------------------------------------------- */
export function pollHtml(m, chatId) {
  const p = m.poll;
  const me = state.acc.user.id;
  const total = new Set(Object.values(p.votes).flat()).size;
  const mine = Object.entries(p.votes).filter(([, u]) => u.includes(me)).map(([k]) => k);
  const showResults = mine.length > 0 || p.closed;
  const type = p.quiz ? 'Quiz' : p.anonymous ? 'Anonymous poll' : 'Public poll';
  const opts = p.options.map((o) => {
    const n = p.votes[o.id]?.length ?? 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    const chosen = mine.includes(o.id);
    const right = p.quiz && showResults && o.id === p.correct;
    const wrong = p.quiz && chosen && o.id !== p.correct;
    if (!showResults) {
      return `<button class="poll-opt" type="button" data-poll-vote="${o.id}" data-chat="${chatId}" data-msg="${m.id}">
        <span class="poll-radio${p.multiple ? ' is-box' : ''}"></span><span class="poll-label">${escapeHtml(o.text)}</span></button>`;
    }
    return `<div class="poll-res${chosen ? ' is-chosen' : ''}${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}" style="--w:${pct}%">
      <span class="poll-pct">${pct}%</span>
      <span class="poll-label">${escapeHtml(o.text)}${right ? I.check : wrong ? I.cross : chosen ? I.check : ''}</span>
      <span class="poll-bar"></span>
    </div>`;
  }).join('');
  const multiPending = p.multiple && !showResults;
  return `
    <div class="poll${p.quiz ? ' is-quiz' : ''}" data-poll="${m.id}">
      <p class="poll-q">${escapeHtml(p.question)}</p>
      <span class="poll-type">${type}${p.multiple ? ' · multiple answers' : ''}${p.closed ? ' · final results' : ''}</span>
      <div class="poll-opts">${opts}</div>
      ${p.quiz && showResults && p.explanation ? `<p class="poll-expl">${I.bulb}<span>${escapeHtml(p.explanation)}</span></p>` : ''}
      <div class="poll-foot">
        <span>${total ? `${total} vote${total === 1 ? '' : 's'}` : 'No votes yet'}</span>
        ${multiPending ? `<button class="poll-submit" type="button" data-poll-submit data-chat="${chatId}" data-msg="${m.id}" disabled>Vote</button>` : ''}
        ${!p.anonymous && total && showResults ? `<span class="poll-voters">${voterNames(p)}</span>` : ''}
      </div>
    </div>`;
}

function voterNames(p) {
  const ids = [...new Set(Object.values(p.votes).flat())].slice(0, 3);
  const db = JSON.parse(localStorage.getItem('kosmo:accounts') || '{}');
  return ids.map((id) => escapeHtml(db[id]?.name.split(/\s+/)[0] ?? '')).join(', ');
}

/* ---------- Голосование ---------- */
function vote(chatId, msgId, optionIds) {
  const me = state.acc.user.id;
  let quiz = null;
  chats.update(chatId, (c) => {
    const m = c.messages.find((x) => x.id === msgId);
    if (!m || m.poll.closed) return;
    if (Object.values(m.poll.votes).some((u) => u.includes(me))) return;   // голос один раз
    optionIds.forEach((id) => { (m.poll.votes[id] ??= []).push(me); });
    if (m.poll.quiz) quiz = { ok: optionIds[0] === m.poll.correct };
  });
  navigator.vibrate?.(quiz && !quiz.ok ? [20, 40, 20] : 10);
  if (quiz) toast(quiz.ok ? 'Correct!' : 'Wrong answer');
  document.dispatchEvent(new CustomEvent('kosmo:chat-updated', { detail: chatId }));
}

export function retractVote(chatId, msgId) {
  const me = state.acc.user.id;
  chats.update(chatId, (c) => {
    const m = c.messages.find((x) => x.id === msgId);
    if (!m || m.poll.quiz || m.poll.closed) return;
    for (const k of Object.keys(m.poll.votes)) m.poll.votes[k] = m.poll.votes[k].filter((u) => u !== me);
  });
  document.dispatchEvent(new CustomEvent('kosmo:chat-updated', { detail: chatId }));
}

export function closePoll(chatId, msgId) {
  chats.update(chatId, (c) => {
    const m = c.messages.find((x) => x.id === msgId);
    if (m?.poll) m.poll.closed = true;
  });
  toast('Poll stopped');
  document.dispatchEvent(new CustomEvent('kosmo:chat-updated', { detail: chatId }));
}

document.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-poll-vote]');
  if (opt) {
    const poll = opt.closest('.poll');
    const multiple = opt.querySelector('.poll-radio.is-box');
    if (multiple) {
      opt.classList.toggle('is-picked');
      poll.querySelector('[data-poll-submit]').disabled = !poll.querySelector('.poll-opt.is-picked');
      return;
    }
    opt.classList.add('is-picked');
    vote(opt.dataset.chat, opt.dataset.msg, [opt.dataset.pollVote]);
    return;
  }
  const sub = e.target.closest('[data-poll-submit]');
  if (sub) {
    const ids = $$('.poll-opt.is-picked', sub.closest('.poll')).map((b) => b.dataset.pollVote);
    if (ids.length) vote(sub.dataset.chat, sub.dataset.msg, ids);
  }
});

/* ---------------------------------------------------------------------------
   Создание опроса
   --------------------------------------------------------------------------- */
let dlg = null;

export function openPollCreator(onSend) {
  closeCreator();
  dlg = document.createElement('div');
  dlg.className = 'modal-wrap';
  dlg.innerHTML = `
    <div class="modal-scrim" data-poll-close></div>
    <form class="modal poll-form glass glass-text" role="dialog" aria-label="New poll" novalidate>
      <header class="modal-head"><h2>New poll</h2><button class="icon-btn" type="button" data-poll-close aria-label="Close">${I.cross}</button></header>
      <label class="modal-field"><span>Question</span><textarea id="poll-q" rows="2" maxlength="255" placeholder="Ask a question"></textarea></label>
      <span class="modal-label">Options</span>
      <div class="poll-edit-opts" id="poll-opts"></div>
      <button class="link-btn poll-add" type="button" data-poll-add>${I.plus}Add an option</button>
      <div class="modal-switches">
        <label class="switch-row"><span>Anonymous voting</span><input type="checkbox" class="switch" id="poll-anon" checked></label>
        <label class="switch-row"><span>Multiple answers</span><input type="checkbox" class="switch" id="poll-multi"></label>
        <label class="switch-row"><span class="sw-text">Quiz mode<small>One correct answer. Tap the circle to mark it.</small></span><input type="checkbox" class="switch" id="poll-quiz"></label>
      </div>
      <label class="modal-field" id="poll-expl-field" hidden><span>Explanation (shown after answering)</span><textarea id="poll-expl" rows="2" maxlength="200" placeholder="Why is this the right answer?"></textarea></label>
      <button class="btn btn-primary" type="submit">Create</button>
    </form>`;
  document.body.append(dlg);
  const state2 = { options: [{ id: uid(), text: '' }, { id: uid(), text: '' }], correct: null };
  const paint = () => {
    const quiz = $('#poll-quiz').checked;
    $('#poll-opts').innerHTML = state2.options.map((o, i) => `
      <div class="poll-edit-row${quiz && state2.correct === o.id ? ' is-correct' : ''}">
        ${quiz ? `<button class="poll-mark" type="button" data-poll-correct="${o.id}" aria-label="Mark as correct">${I.check}</button>` : ''}
        <input type="text" maxlength="100" placeholder="Option ${i + 1}" value="${escapeHtml(o.text)}" data-poll-opt="${o.id}">
        ${state2.options.length > 2 ? `<button class="icon-btn" type="button" data-poll-del="${o.id}" aria-label="Remove option">${I.cross}</button>` : ''}
      </div>`).join('');
    $('[data-poll-add]', dlg).hidden = state2.options.length >= 10;
    $('#poll-expl-field').hidden = !quiz;
    $('#poll-multi').disabled = quiz;
    if (quiz) $('#poll-multi').checked = false;
  };
  paint();
  dlg.addEventListener('input', (e) => {
    const o = state2.options.find((x) => x.id === e.target.dataset.pollOpt);
    if (o) o.text = e.target.value;
  });
  dlg.addEventListener('change', (e) => { if (e.target.id === 'poll-quiz') paint(); });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-poll-close]')) closeCreator();
    if (e.target.closest('[data-poll-add]')) {
      state2.options.push({ id: uid(), text: '' });
      paint();
      $$('[data-poll-opt]', dlg).at(-1).focus();
    }
    const del = e.target.closest('[data-poll-del]');
    if (del) { state2.options = state2.options.filter((o) => o.id !== del.dataset.pollDel); paint(); }
    const mark = e.target.closest('[data-poll-correct]');
    if (mark) { state2.correct = mark.dataset.pollCorrect; paint(); }
  });
  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const question = $('#poll-q').value.trim();
    const options = state2.options.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text);
    const quiz = $('#poll-quiz').checked;
    if (!question) { shake($('#poll-q').parentElement); toast('Write a question'); return; }
    if (options.length < 2) { toast('Add at least 2 options'); return; }
    if (quiz && !options.some((o) => o.id === state2.correct)) { toast('Mark the correct answer'); return; }
    onSend({
      kind: 'poll',
      poll: {
        question, options, quiz, correct: quiz ? state2.correct : null,
        explanation: quiz ? $('#poll-expl').value.trim() : '',
        anonymous: $('#poll-anon').checked, multiple: !quiz && $('#poll-multi').checked,
        votes: {}, closed: false,
      },
    });
    closeCreator();
  });
  refreshRefraction();
  setTimeout(() => $('#poll-q')?.focus(), 200);
}

function closeCreator() {
  if (!dlg) return;
  const el = dlg;
  dlg = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 200);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dlg) { e.stopImmediatePropagation(); closeCreator(); }
}, true);
