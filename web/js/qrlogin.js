// Вход по QR-коду без сервера: экран входа показывает настоящий QR с
// одноразовым кодом, вошедшая вкладка (Profile → Sessions → Link a device)
// сканирует его камерой или вводит код — и передаёт вход через BroadcastChannel.

import { $, db, uid, toast, shake, refreshRefraction } from './core.js';
import { state } from './panels.js';

const bc = 'BroadcastChannel' in window ? new BroadcastChannel('kosmo-qr') : null;
const TTL = 120_000;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join('');
const pretty = (c) => `${c.slice(0, 3)}-${c.slice(3)}`;

let qrLib = null;
const qrReady = import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm').then((m) => { qrLib = m.default ?? m; }).catch(() => {});

function qrSvg(text) {
  if (!qrLib) return null;
  const qr = qrLib(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="Login QR code"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" rx="2" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ---------- Экран входа: показать код и ждать подтверждения ---------- */
let waiting = null;   // { code, timer, onLinked }

export async function showLoginQr(onLinked) {
  stopLoginQr();
  const code = newCode();
  waiting = { code, onLinked, timer: setTimeout(() => showLoginQr(onLinked), TTL) };
  $('#qr-code').innerHTML = `Code: <b>${pretty(code)}</b>`;
  $('#qr-box').innerHTML = '<div class="qr-loading"></div>';
  await qrReady;
  if (waiting?.code !== code) return;
  $('#qr-box').innerHTML = qrSvg(`kosmo-login:${code}`) ?? `<div class="qr-fallback">${pretty(code)}</div>`;
}

export function stopLoginQr() {
  if (!waiting) return;
  clearTimeout(waiting.timer);
  waiting = null;
}

bc?.addEventListener('message', ({ data }) => {
  if (data.type !== 'link' || !waiting || data.code !== waiting.code) return;
  const user = db.get(data.uid);
  if (!user) return;
  const { onLinked } = waiting;
  stopLoginQr();
  bc.postMessage({ type: 'linked', code: data.code });
  onLinked(user);
});

/* ---------- Вошедшая вкладка: сканировать или ввести код ---------- */
let dlg = null;
let stream = null;

export function openLinkDevice() {
  if (!state.acc?.session.trusted) { toast('Only a trusted device can link new devices'); return; }
  closeLink();
  dlg = document.createElement('div');
  dlg.className = 'modal-wrap';
  dlg.innerHTML = `
    <div class="modal-scrim" data-link-close></div>
    <form class="modal link-modal glass glass-text" role="dialog" aria-label="Link a device" novalidate>
      <header class="modal-head"><h2>Link a device</h2><button class="icon-btn" type="button" data-link-close aria-label="Close"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></header>
      <div class="scan-box"><video playsinline muted></video><span class="scan-frame"></span><p class="scan-hint">Point the camera at the QR code</p></div>
      <label class="modal-field"><span>Or enter the code shown on the other device</span>
        <input type="text" id="link-code" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABC-123"></label>
      <button class="btn btn-primary" type="submit">Link device</button>
    </form>`;
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-link-close]')) closeLink(); });
  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#link-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) { shake($('#link-code').parentElement); toast('Enter the 6-character code'); return; }
    link(code);
  });
  $('#link-code').addEventListener('input', (e) => {
    const c = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    e.target.value = c.length > 3 ? pretty(c) : c;
  });
  startScan();
  refreshRefraction();
}

function link(code) {
  if (!bc) { toast('Not supported in this browser'); return; }
  let ok = false;
  const onAck = ({ data }) => {
    if (data.type === 'linked' && data.code === code) { ok = true; bc.removeEventListener('message', onAck); closeLink(); toast('Device linked'); }
  };
  bc.addEventListener('message', onAck);
  bc.postMessage({ type: 'link', code, uid: state.acc.user.id, id: uid() });
  setTimeout(() => {
    bc.removeEventListener('message', onAck);
    if (!ok && dlg) { shake($('#link-code').parentElement); toast('Code not found or expired'); }
  }, 1500);
}

async function startScan() {
  const box = dlg.querySelector('.scan-box');
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    box.classList.add('is-off');
    box.querySelector('.scan-hint').textContent = 'Camera scanning isn’t supported here — type the code';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    box.classList.add('is-off');
    box.querySelector('.scan-hint').textContent = 'No camera access — type the code';
    return;
  }
  if (!dlg) { stream.getTracks().forEach((t) => t.stop()); return; }
  const video = box.querySelector('video');
  video.srcObject = stream;
  await video.play().catch(() => {});
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const loop = async () => {
    if (!dlg) return;
    try {
      const [hit] = await detector.detect(video);
      const m = hit?.rawValue?.match(/^kosmo-login:([A-Z0-9]{6})$/);
      if (m) { link(m[1]); return; }
    } catch { /* следующий кадр */ }
    setTimeout(loop, 300);
  };
  loop();
}

function closeLink() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (!dlg) return;
  const el = dlg;
  dlg = null;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 200);
}

document.addEventListener('click', (e) => { if (e.target.closest('[data-link-device]')) openLinkDevice(); });
