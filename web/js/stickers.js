// Стикерпаки на основе своих эмодзи: большая эмодзи + своя анимация,
// у некоторых — подпись-«облачко». Отрисовка одинаковая в чате и в выборе.

import { escapeHtml } from './core.js';
import { emojiSvg, EMOJI } from './emoji.js';

const s = (emoji, anim, text = '') => ({ emoji, anim, text });

export const PACKS = [
  {
    id: 'faces',
    name: 'Kosmo Faces',
    items: [
      s('laugh', 'jelly'), s('love', 'pulse'), s('wow', 'pop'), s('cry', 'shake'),
      s('cool', 'float'), s('party', 'spin'), s('heart', 'beat'), s('like', 'wave'),
    ],
  },
  {
    id: 'words',
    name: 'Say it',
    items: [
      s('like', 'wave', 'Hi!'), s('laugh', 'jelly', 'LOL'), s('heart', 'beat', 'Thanks!'), s('fire', 'float', 'Hot!'),
      s('party', 'pop', 'GG'), s('cool', 'float', 'OK'), s('wow', 'shake', 'Wow'), s('cry', 'shake', 'Sorry'),
    ],
  },
  {
    id: 'space',
    name: 'Deep Space',
    items: [
      s('rocket', 'launch'), s('planet', 'orbit'), s('star', 'twinkle'), s('fire', 'flicker'),
      s('rocket', 'launch', 'Let’s go'), s('planet', 'orbit', 'Kosmo'), s('star', 'twinkle', 'Nice'), s('love', 'float', 'Miss you'),
    ],
  },
];

export const stickerKey = (st) => `${st.emoji}:${st.anim}:${st.text}`;

export function stickerHtml(st, cls = '') {
  if (!EMOJI[st.emoji]) return '';
  return `<span class="sticker anim-${st.anim} ${cls}">${emojiSvg(st.emoji)}${st.text ? `<span class="sticker-text">${escapeHtml(st.text)}</span>` : ''}</span>`;
}

// Содержимое вкладки «Stickers» в выборе эмодзи
export function stickerPickerHtml() {
  return PACKS.map((p) => `
    <section class="sticker-pack">
      <h4>${escapeHtml(p.name)}</h4>
      <div class="sticker-grid">${p.items.map((st, i) => `
        <button class="sticker-opt" type="button" style="--i:${i}" data-send-sticker="${p.id}:${i}" aria-label="${escapeHtml(st.text || EMOJI[st.emoji].label)} sticker">${stickerHtml(st)}</button>`).join('')}
      </div>
    </section>`).join('');
}

export function stickerByRef(ref) {
  const [pack, i] = ref.split(':');
  return PACKS.find((p) => p.id === pack)?.items[Number(i)] ?? null;
}
