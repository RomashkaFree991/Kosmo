// Видеосообщения-«кружки», как в Telegram: запись с фронтальной камеры
// до 60 секунд, в чате — круглое видео без звука, по тапу — со звуком
// и кольцом прогресса.

import { toast } from './core.js';
import { putBlob } from './media.js';

const MAX = 60;
const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  send: svg('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>'),
  flip: svg('<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/>'),
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const R = 47;
const C = 2 * Math.PI * R;

export function roundHtml(m) {
  return `
    <button class="b-round" type="button" data-round aria-label="Play video message">
      <video data-media="${m.media}" muted loop playsinline autoplay preload="auto"></video>
      <svg class="round-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
      <span class="round-dur">${fmt(m.duration ?? 0)}</span>
      <span class="round-sound" aria-hidden="true">${svg('<path d="M11 5L6.5 9H4v6h2.5l4.5 4zM16 9.5l5 5M21 9.5l-5 5"/>')}</span>
    </button>`;
}

// Тап по кружку: со звуком с начала, ещё тап — пауза; кольцо показывает прогресс
let active = null;
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-round]');
  if (!btn) return;
  const v = btn.querySelector('video');
  if (active && active !== btn) stop(active);
  if (btn.classList.contains('is-playing')) {
    if (v.paused) v.play(); else v.pause();
    return;
  }
  active = btn;
  btn.classList.add('is-playing');
  v.muted = false;
  v.loop = false;
  v.currentTime = 0;
  v.play().catch(() => {});
  const ring = btn.querySelector('circle');
  const dur = btn.querySelector('.round-dur');
  v.ontimeupdate = () => {
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    if (d) ring.style.strokeDashoffset = String(C * (1 - v.currentTime / d));
    dur.textContent = fmt(v.currentTime);
  };
  v.onended = () => stop(btn);
});

function stop(btn) {
  const v = btn.querySelector('video');
  btn.classList.remove('is-playing');
  v.ontimeupdate = null;
  v.muted = true;
  v.loop = true;
  v.play().catch(() => {});
  btn.querySelector('circle').style.strokeDashoffset = String(C);
  if (active === btn) active = null;
}

/* ---------------------------------------------------------------------------
   Запись
   --------------------------------------------------------------------------- */
export async function openRoundRecorder(onSend) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Video messages are not supported in this browser');
    return;
  }
  let facing = 'user';
  let stream;
  const getStream = () => navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 480 }, height: { ideal: 480 } }, audio: true,
  });
  try {
    stream = await getStream();
  } catch {
    toast('Allow camera and microphone access to record');
    return;
  }
  const el = document.createElement('div');
  el.className = 'round-rec';
  el.innerHTML = `
    <div class="round-rec-bg"></div>
    <div class="round-rec-stage">
      <div class="round-rec-circle"><video muted playsinline autoplay></video></div>
      <svg class="round-rec-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
    </div>
    <div class="round-rec-time"><span class="rec-dot"></span><span id="round-time">0:00</span></div>
    <div class="round-rec-actions">
      <button class="v-btn" type="button" data-rr="cancel" aria-label="Cancel">${I.close}</button>
      <button class="round-rec-send" type="button" data-rr="send" aria-label="Send">${I.send}</button>
      <button class="v-btn" type="button" data-rr="flip" aria-label="Switch camera">${I.flip}</button>
    </div>`;
  document.body.append(el);
  const video = el.querySelector('video');
  video.srcObject = stream;
  const ring = el.querySelector('circle');
  let chunks = [];
  let rec = null;
  let started = 0;
  let send = false;
  let timer = null;

  const startRec = () => {
    chunks = [];
    const type = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const elapsed = (Date.now() - started) / 1000;
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer);
      el.classList.add('is-closing');
      setTimeout(() => el.remove(), 220);
      if (!send || elapsed < 0.6) return;
      const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
      onSend({ kind: 'round', media: await putBlob(blob), duration: Math.min(MAX, elapsed) });
    };
    rec.start(250);
    started = Date.now();
  };
  startRec();
  timer = setInterval(() => {
    const t = (Date.now() - started) / 1000;
    el.querySelector('#round-time').textContent = fmt(t);
    ring.style.strokeDashoffset = String(C * (1 - Math.min(1, t / MAX)));
    if (t >= MAX) { send = true; rec.stop(); }
  }, 100);

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rr]');
    if (!b) return;
    if (b.dataset.rr === 'cancel') { send = false; rec.stop(); }
    if (b.dataset.rr === 'send') { send = true; rec.stop(); }
    if (b.dataset.rr === 'flip') {
      // смена камеры: запись начинается заново
      facing = facing === 'user' ? 'environment' : 'user';
      send = false;
      rec.onstop = null;
      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      try { stream = await getStream(); } catch { facing = 'user'; stream = await getStream(); }
      video.srcObject = stream;
      startRec();
    }
  });
}
