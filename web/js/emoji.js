// Эмодзи Kosmo — системные (Unicode): на iPhone и Mac это эмодзи Apple,
// на Android — Google, на Windows — Microsoft. Полный набор — в emoji-data.js
// (грузится, когда открывают выбор эмодзи). Старые id реакций (heart, like…)
// сопоставлены символам, новые реакции хранятся самим символом.

import { setPremiumIcon } from './core.js';

const E = (ch, label) => ({ ch, label });
export const EMOJI = {
  heart: E('❤️', 'Heart'),
  like: E('👍', 'Like'),
  fire: E('🔥', 'Fire'),
  laugh: E('😂', 'Laugh'),
  love: E('😍', 'Love'),
  wow: E('😮', 'Wow'),
  cry: E('😢', 'Cry'),
  cool: E('😎', 'Cool'),
  party: E('🎉', 'Party'),
  rocket: E('🚀', 'Rocket'),
  star: E('⭐', 'Star'),
  planet: E('🪐', 'Planet'),
};

export const REACTIONS = ['heart', 'like', 'fire', 'laugh', 'wow', 'cry', 'party', 'rocket'];
export const EMOJI_IDS = Object.keys(EMOJI);

const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
// Ключ реакции/эмодзи: старый id или сам символ
export const isEmojiChar = (s) => typeof s === 'string' && s.length <= 16 && PICTO.test(s);
export const emojiChar = (id) => EMOJI[id]?.ch ?? (isEmojiChar(id) ? id : '');
export const emojiLabel = (id) => EMOJI[id]?.label ?? (isEmojiChar(id) ? id : 'Emoji');

export function emojiSvg(id, cls = '') {
  const ch = emojiChar(id);
  if (!ch) return '';
  return `<span class="emoji ${cls}" role="img" aria-label="${emojiLabel(id)}"><i>${ch}</i></span>`;
}

// Значок Premium — планета-логотип Kosmo (градиенты общие, из спрайта в index.html)
const PLANET = `<svg class="emoji premium-planet" viewBox="0 0 64 64" role="img" aria-label="Premium">
  <g transform="rotate(-18 32 32)"><path d="M3 32A29 8 0 0 1 61 32" fill="none" stroke="url(#k-ring)" stroke-width="3.5" stroke-linecap="round"/></g>
  <circle cx="32" cy="32" r="16" fill="url(#k-fill)"/><circle cx="32" cy="32" r="16" fill="url(#k-shade)"/>
  <g transform="rotate(-18 32 32)"><path d="M3 32A29 8 0 0 0 61 32" fill="none" stroke="url(#k-ring)" stroke-width="3.5" stroke-linecap="round"/></g>
  <circle class="e-spark" cx="54" cy="12" r="2.4" fill="#fff"/><circle class="e-spark e-delay" cx="10" cy="52" r="1.8" fill="#fff"/></svg>`;

export function initEmoji() {}

setPremiumIcon(() => PLANET);
