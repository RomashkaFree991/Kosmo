// Медиа (фото, видео, музыка, голосовые, аватарки) загружаются на сервер,
// сообщения хранят лишь id файла. Свои файлы ещё и кешируются в IndexedDB,
// чтобы показываться сразу, без скачивания.

import { $$, tab } from './core.js';

let dbPromise = null;
function idb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('kosmo-media', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return idb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('blobs', mode);
    const req = fn(t.objectStore('blobs'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  }));
}

export async function putBlob(blob) {
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream', Authorization: `Bearer ${tab.get()?.token ?? ''}` },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  await tx('readwrite', (s) => s.put(blob, data.id)).catch(() => {});
  return data.id;
}

const urls = new Map();
export async function mediaUrl(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const blob = await tx('readonly', (s) => s.get(id)).catch(() => null);
  // своё — из кеша, чужое — прямо с сервера
  const url = blob ? URL.createObjectURL(blob) : /^[a-f0-9]{32}$/.test(id) ? `/media/${id}` : null;
  if (url) urls.set(id, url);
  return url;
}

// Подставить адреса во все <img|video|audio data-media="id"> внутри root
export function hydrateMedia(root = document) {
  $$('[data-media]:not([src])', root).forEach(async (el) => {
    // уже загруженный файл подставляем сразу — без мигания пустой картинки
    if (urls.has(el.dataset.media)) { el.src = urls.get(el.dataset.media); return; }
    const url = await mediaUrl(el.dataset.media);
    if (url) el.src = url;
    else el.closest('.avatar')?.classList.remove('has-photo');
  });
}

// Фото ужимаем до 1600 px по большей стороне (JPEG), чтобы чат летал
export async function compressImage(file, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return { blob, w, h };
}

// Квадратная аватарка 512×512 из центра фото
export async function squareAvatar(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
}

export function mediaDuration(blob, kind = 'audio') {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      resolve(Number.isFinite(el.duration) ? el.duration : 0);
      URL.revokeObjectURL(el.src);
    };
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(blob);
  });
}

// Волна и точная длительность голосового: декодируем запись и берём пики
// громкости по отрезкам — где голос громче, там палочка выше
export async function analyzeAudio(blob, bars = 36) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / bars));
    const peaks = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const startAt = i * size;
      for (let j = 0; j < size; j += 8) sum += (data[startAt + j] ?? 0) ** 2;
      peaks.push(Math.sqrt(sum / (size / 8)));   // RMS — средняя громкость отрезка
    }
    const max = Math.max(...peaks) || 1;
    return { duration: buf.duration, wave: peaks.map((p) => Math.round(Math.max(0.08, p / max) * 100) / 100) };
  } catch {
    return null;
  } finally {
    ctx.close?.();
  }
}
