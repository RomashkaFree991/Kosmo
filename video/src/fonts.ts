// Шрифты из public/fonts (@fontsource): Unbounded — заголовки, Inter — текст.
// Латиница и кириллица — отдельными файлами с unicode-range.
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD';
const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

export const DISPLAY = 'Kosmo Unbounded';
export const TEXT = 'Kosmo Inter';

const faces: [string, string, string][] = [
  [DISPLAY, 'unbounded', '800'],
  [TEXT, 'inter', '500'], [TEXT, 'inter', '600'], [TEXT, 'inter', '700'], [TEXT, 'inter', '800'],
];
for (const [family, file, weight] of faces) {
  for (const [subset, range] of [['latin', LATIN], ['cyrillic', CYRILLIC]]) {
    loadFont({ family, weight, unicodeRange: range, url: staticFile(`fonts/${file}-${subset}-${weight}-normal.woff2`) });
  }
}
