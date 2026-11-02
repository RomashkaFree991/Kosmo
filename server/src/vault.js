// Шифрование данных на сервере (at rest). Переписка, посты и истории лежат
// в базе зашифрованными (AES-256-GCM), файлы на диске — AES-256-CTR (чтобы
// видео можно было перематывать: CTR позволяет начать с любого байта).
// Ключ — DATA_DIR/data.key (создаётся при первом запуске, права 600) или
// переменная DATA_KEY (64 hex). Без ключа база и файлы не читаются: храните
// его вместе с резервной копией.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { config } from './config.js';

function loadKey() {
  if (/^[0-9a-f]{64}$/i.test(process.env.DATA_KEY ?? '')) return Buffer.from(process.env.DATA_KEY, 'hex');
  const file = path.join(config.dataDir, 'data.key');
  try {
    const hex = fs.readFileSync(file, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  } catch { /* нет файла — создадим */ }
  fs.mkdirSync(config.dataDir, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, `${key.toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
  return key;
}
const KEY = loadKey();
// отдельные подключи для документов и файлов
const sub = (label) => crypto.createHmac('sha256', KEY).update(label).digest();
const DOC_KEY = sub('kosmo-doc-v1');
const FILE_KEY = sub('kosmo-file-v1');

const PREFIX = 'enc1:';
export const isSealedDoc = (s) => typeof s === 'string' && s.startsWith(PREFIX);

export function sealDoc(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', DOC_KEY, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function openDoc(s) {
  if (!isSealedDoc(s)) return s;
  const b = Buffer.from(s.slice(PREFIX.length), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', DOC_KEY, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

// Файлы: IV из id файла, счётчик сдвигается на номер 16-байтного блока
function ctrIv(id, block) {
  const iv = Buffer.from(crypto.createHash('sha256').update(`iv|${id}`).digest().subarray(0, 16));
  let carry = BigInt(block);
  for (let i = 15; i >= 0 && carry > 0n; i--) {
    const v = BigInt(iv[i]) + (carry & 0xffn);
    iv[i] = Number(v & 0xffn);
    carry = (carry >> 8n) + (v >> 8n);
  }
  return iv;
}
export const fileCipher = (id) => crypto.createCipheriv('aes-256-ctr', FILE_KEY, ctrIv(id, 0));

// Чтение зашифрованного файла с байта start по end включительно
export function readSealedFile(id, file, start, end) {
  const block = Math.floor(start / 16);
  const d = crypto.createDecipheriv('aes-256-ctr', FILE_KEY, ctrIv(id, block));
  let skip = start - block * 16;
  return fs.createReadStream(file, { start: block * 16, end }).pipe(new Transform({
    transform(chunk, _enc, cb) {
      let out = d.update(chunk);
      if (skip) { const n = Math.min(skip, out.length); out = out.subarray(n); skip -= n; }
      cb(null, out);
    },
  }));
}

// Старый незашифрованный файл → зашифровать на месте
export async function sealFileInPlace(id, file) {
  const tmp = `${file}.enc`;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    fs.createReadStream(file).on('error', reject).pipe(fileCipher(id)).pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  fs.renameSync(tmp, file);
}
