// Свой просмотрщик фото и видео: листание всех медиа чата, увеличение
// (двойной тап / щипок), перетаскивание увеличенного фото, свайп вниз —
// закрыть, своё управление видео, сохранение файла.

import { escapeHtml } from './core.js';
import { mediaUrl } from './media.js';

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  prev: svg('<path d="M14.5 6l-6 6 6 6"/>'),
  next: svg('<path d="M9.5 6l6 6-6 6"/>'),
  save: svg('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13M16 5.5v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  sound: svg('<path d="M11 5L6.5 9H4v6h2.5l4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: svg('<path d="M11 5L6.5 9H4v6h2.5l4.5 4zM16 9.5l5 5M21 9.5l-5 5"/>'),
};
const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

let v = null;   // текущее состояние просмотрщика

export async function openViewer(items, start = 0) {
  if (!items.length) return;
  closeViewer(true);
  const el = document.createElement('div');
  el.className = 'viewer2';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Media viewer');
  el.innerHTML = `
    <div class="v-bg"></div>
    <div class="v-stage"></div>
    <header class="v-top">
      <button class="v-btn" type="button" data-v="close" aria-label="Close">${ICON.close}</button>
      <div class="v-info"><b class="v-title"></b><span class="v-sub"></span></div>
      <span class="v-count"></span>
      <button class="v-btn" type="button" data-v="save" aria-label="Save">${ICON.save}</button>
    </header>
    <button class="v-nav v-prev" type="button" data-v="prev" aria-label="Previous">${ICON.prev}</button>
    <button class="v-nav v-next" type="button" data-v="next" aria-label="Next">${ICON.next}</button>
    <footer class="v-bottom">
      <p class="v-caption"></p>
      <div class="v-controls" hidden>
        <button class="v-btn v-play" type="button" data-v="play" aria-label="Play">${ICON.play}</button>
        <span class="v-time">0:00</span>
        <input class="v-range" type="range" min="0" max="1000" value="0" aria-label="Seek">
        <span class="v-dur">0:00</span>
        <button class="v-btn" type="button" data-v="mute" aria-label="Mute">${ICON.sound}</button>
      </div>
    </footer>`;
  document.body.append(el);
  v = { el, items, i: start, zoom: 1, x: 0, y: 0, video: null };
  bind(el);
  await show(start, 0);
}

export function closeViewer(instant = false) {
  if (!v) return;
  const { el } = v;
  v.video?.pause();
  v = null;
  if (instant) { el.remove(); return; }
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 240);
}

async function show(i, dir) {
  if (!v) return;
  const item = v.items[i];
  v.i = i;
  v.zoom = 1; v.x = 0; v.y = 0;
  v.video?.pause();
  v.video = null;
  const stage = v.el.querySelector('.v-stage');
  const url = await mediaUrl(item.media);
  if (!v) return;
  const slide = document.createElement('div');
  slide.className = `v-slide${dir ? (dir > 0 ? ' from-right' : ' from-left') : ''}`;
  if (item.type === 'video') {
    slide.innerHTML = `<video class="v-media" playsinline preload="metadata" src="${url ?? ''}"></video>
      <button class="v-bigplay" type="button" data-v="play" aria-label="Play">${ICON.play}</button>`;
  } else {
    slide.innerHTML = `<img class="v-media" src="${url ?? ''}" alt="${escapeHtml(item.caption || 'Photo')}" draggable="false">`;
  }
  stage.replaceChildren(slide);
  v.el.querySelector('.v-title').textContent = item.title ?? '';
  v.el.querySelector('.v-sub').textContent = item.sub ?? '';
  v.el.querySelector('.v-count').textContent = v.items.length > 1 ? `${i + 1} / ${v.items.length}` : '';
  v.el.querySelector('.v-caption').textContent = item.caption ?? '';
  v.el.querySelector('.v-prev').hidden = i === 0;
  v.el.querySelector('.v-next').hidden = i === v.items.length - 1;
  const controls = v.el.querySelector('.v-controls');
  controls.hidden = item.type !== 'video';
  if (item.type === 'video') setupVideo(slide.querySelector('video'));
}

function setupVideo(video) {
  v.video = video;
  const el = v.el;
  const range = el.querySelector('.v-range');
  const sync = () => {
    const d = video.duration;
    el.querySelector('.v-time').textContent = fmt(video.currentTime);
    el.querySelector('.v-dur').textContent = fmt(d);
    if (Number.isFinite(d) && d > 0) range.value = String(Math.round((video.currentTime / d) * 1000));
    range.style.setProperty('--p', range.value / 1000);
  };
  const playIcon = () => {
    el.querySelector('.v-play').innerHTML = video.paused ? ICON.play : ICON.pause;
    el.classList.toggle('is-playing', !video.paused);
  };
  video.addEventListener('timeupdate', sync);
  video.addEventListener('loadedmetadata', sync);
  video.addEventListener('play', playIcon);
  video.addEventListener('pause', playIcon);
  video.addEventListener('ended', playIcon);
  video.addEventListener('click', () => (video.paused ? video.play() : video.pause()));
  range.oninput = () => {
    if (Number.isFinite(video.duration)) video.currentTime = (range.value / 1000) * video.duration;
    range.style.setProperty('--p', range.value / 1000);
  };
  playIcon();
  video.play().catch(() => {});
}

function applyTransform(img, animate = false) {
  img.style.transition = animate ? 'transform 300ms cubic-bezier(0.2, 0, 0, 1)' : 'none';
  img.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
}

function bind(el) {
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]');
    if (!b || !v) return;
    const act = b.dataset.v;
    if (act === 'close') closeViewer();
    if (act === 'prev' && v.i > 0) show(v.i - 1, -1);
    if (act === 'next' && v.i < v.items.length - 1) show(v.i + 1, 1);
    if (act === 'play' && v.video) (v.video.paused ? v.video.play() : v.video.pause());
    if (act === 'mute' && v.video) {
      v.video.muted = !v.video.muted;
      b.innerHTML = v.video.muted ? ICON.mute : ICON.sound;
    }
    if (act === 'save') {
      const item = v.items[v.i];
      const url = await mediaUrl(item.media);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `kosmo-${item.type}-${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
      a.click();
    }
  });

  // двойной тап — увеличить в точке касания / вернуть
  el.addEventListener('dblclick', (e) => {
    const img = el.querySelector('img.v-media');
    if (!img || !e.target.closest('.v-media')) return;
    if (v.zoom > 1) { v.zoom = 1; v.x = 0; v.y = 0; } else {
      const r = img.getBoundingClientRect();
      v.zoom = 2.5;
      v.x = (r.left + r.width / 2 - e.clientX) * 1.5;
      v.y = (r.top + r.height / 2 - e.clientY) * 1.5;
    }
    applyTransform(img, true);
    el.classList.toggle('is-zoomed', v.zoom > 1);
  });

  // жесты: свайп влево/вправо, вниз — закрыть, щипок — масштаб, перетаскивание
  const pointers = new Map();
  let start = null;
  let pinch = null;
  el.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.v-stage')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom };
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !v) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const img = el.querySelector('img.v-media');
    const slide = el.querySelector('.v-slide');
    if (pinch && img && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      v.zoom = Math.min(4, Math.max(1, pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)));
      applyTransform(img);
      el.classList.toggle('is-zoomed', v.zoom > 1);
      return;
    }
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (v.zoom > 1 && img) {
      v.x = start.vx + dx;
      v.y = start.vy + dy;
      applyTransform(img);
    } else if (slide) {
      // тянем слайд за пальцем; вниз — фон светлеет
      const down = Math.abs(dy) > Math.abs(dx) && dy > 0;
      slide.style.transition = 'none';
      slide.style.transform = down ? `translateY(${dy}px) scale(${1 - Math.min(dy, 400) / 1600})` : `translateX(${dx}px)`;
      el.querySelector('.v-bg').style.opacity = down ? String(1 - Math.min(dy, 400) / 500) : '';
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId) || !v) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    const slide = el.querySelector('.v-slide');
    el.querySelector('.v-bg').style.opacity = '';
    if (v.zoom > 1 || !slide) return;
    slide.style.transition = 'transform 320ms cubic-bezier(0.2, 0, 0, 1)';
    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) { closeViewer(); return; }
    if (dx < -70 && v.i < v.items.length - 1) { show(v.i + 1, 1); return; }
    if (dx > 70 && v.i > 0) { show(v.i - 1, -1); return; }
    slide.style.transform = '';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

document.addEventListener('keydown', (e) => {
  if (!v) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); closeViewer(); }
  if (e.key === 'ArrowLeft' && v.i > 0) show(v.i - 1, -1);
  if (e.key === 'ArrowRight' && v.i < v.items.length - 1) show(v.i + 1, 1);
}, true);
