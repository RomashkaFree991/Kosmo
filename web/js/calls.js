// Голосовые и видеозвонки по WebRTC. Сервера нет, поэтому сигналинг идёт
// через BroadcastChannel: звонить можно между вкладками этого браузера
// (каждая вкладка — отдельное «устройство»). Итог звонка пишется в чат.

import { $, db, toast, escapeHtml, userAvatarHtml, uid } from './core.js';
import { state } from './panels.js';
import { hydrateMedia } from './media.js';
import { chats } from './chats.js';

const bc = 'BroadcastChannel' in window ? new BroadcastChannel('kosmo-calls') : null;
const TAB = uid();
const RING_TIMEOUT = 30_000;
const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  phone: svg('<path d="M6.5 3.5h3l1.5 4.2-2 1.3a10 10 0 0 0 6 6l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  end: svg('<path d="M3 13.5c5-4.7 13-4.7 18 0l-2.2 2.7-3.6-1.3v-2.6a10.5 10.5 0 0 0-6.4 0v2.6l-3.6 1.3z" fill="currentColor"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  micOff: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16"/>'),
  cam: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>'),
  camOff: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3zM3 3l18 18"/>'),
  speaker: svg('<path d="M11 5L6.5 9H4v6h2.5l4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let call = null;   // текущий звонок этой вкладки

const post = (msg) => bc?.postMessage({ ...msg, tab: TAB });

/* ---------------------------------------------------------------------------
   Экран звонка
   --------------------------------------------------------------------------- */
function screen(peer, { video, incoming }) {
  const el = document.createElement('div');
  el.className = `call-screen${video ? ' is-video' : ''}`;
  el.innerHTML = `
    <video class="call-remote" playsinline autoplay></video>
    <video class="call-local" playsinline autoplay muted></video>
    <div class="call-bg"></div>
    <div class="call-info">
      <div class="call-avatar">${userAvatarHtml(peer, 'avatar-call')}<span class="call-wave"></span><span class="call-wave w2"></span></div>
      <h2>${escapeHtml(peer.name)}</h2>
      <p class="call-status">${incoming ? (video ? 'Incoming video call' : 'Incoming call') : 'Calling…'}</p>
    </div>
    <div class="call-actions">
      ${incoming ? `
        <button class="call-btn is-end" type="button" data-call="decline" aria-label="Decline">${I.end}<span>Decline</span></button>
        <button class="call-btn is-accept" type="button" data-call="accept" aria-label="Accept">${video ? I.cam : I.phone}<span>Accept</span></button>` : `
        <button class="call-btn" type="button" data-call="speaker" aria-label="Speaker">${I.speaker}<span>Speaker</span></button>
        <button class="call-btn" type="button" data-call="cam" aria-label="Camera">${video ? I.cam : I.camOff}<span>Video</span></button>
        <button class="call-btn" type="button" data-call="mute" aria-label="Mute">${I.mic}<span>Mute</span></button>
        <button class="call-btn is-end" type="button" data-call="end" aria-label="End call">${I.end}<span>End</span></button>`}
    </div>`;
  document.body.append(el);
  hydrateMedia(el);
  el.addEventListener('click', onAction);
  return el;
}

function setStatus(text) { if (call) call.el.querySelector('.call-status').textContent = text; }

function activeControls() {
  const box = call.el.querySelector('.call-actions');
  box.innerHTML = `
    <button class="call-btn" type="button" data-call="speaker" aria-label="Speaker">${I.speaker}<span>Speaker</span></button>
    <button class="call-btn${call.video ? '' : ' is-off'}" type="button" data-call="cam" aria-label="Camera">${call.video ? I.cam : I.camOff}<span>Video</span></button>
    <button class="call-btn" type="button" data-call="mute" aria-label="Mute">${I.mic}<span>Mute</span></button>
    <button class="call-btn is-end" type="button" data-call="end" aria-label="End call">${I.end}<span>End</span></button>`;
}

/* ---------------------------------------------------------------------------
   Звонок: исходящий
   --------------------------------------------------------------------------- */
export function startCall(peerId, video = false) {
  if (call) { toast('You are already in a call'); return; }
  const peer = db.get(peerId);
  if (!peer) { toast('This account was deleted'); return; }
  if (peer.privacy?.blocked?.includes(state.acc.user.id)) { toast(`You can't call ${peer.name.split(/\s+/)[0]}`); return; }
  call = { id: uid(), peer: peerId, video, outgoing: true, state: 'ringing', el: screen(peer, { video, incoming: false }), queue: [] };
  ringback(true);
  post({ type: 'ring', callId: call.id, from: state.acc.user.id, to: peerId, video });
  call.timeout = setTimeout(() => finish('missed', true), RING_TIMEOUT);
  // нет второй вкладки с этим человеком — никто не ответит
  if (!bc) setTimeout(() => finish('missed', true), 1500);
}

/* ---------------------------------------------------------------------------
   Входящий
   --------------------------------------------------------------------------- */
function incoming(msg) {
  if (!state.acc || $('#app').hidden || msg.to !== state.acc.user.id) return;
  if (call) { post({ type: 'busy', callId: msg.callId }); return; }
  const peer = db.get(msg.from);
  if (!peer || state.acc.user.privacy?.blocked?.includes(msg.from)) { post({ type: 'decline', callId: msg.callId }); return; }
  call = { id: msg.callId, peer: msg.from, video: msg.video, outgoing: false, state: 'ringing', el: screen(peer, { video: msg.video, incoming: true }), queue: [], callerTab: msg.tab };
  ringtone(true);
  navigator.vibrate?.([300, 200, 300]);
}

async function accept() {
  ringtone(false);
  call.state = 'connecting';
  activeControls();
  setStatus('Connecting…');
  await setupPeer();
  post({ type: 'accept', callId: call.id, to: call.callerTab });
}

async function setupPeer() {
  const c = call;
  c.pc = new RTCPeerConnection();
  try {
    c.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: c.video ? { width: 640, height: 480 } : false });
    c.local.getTracks().forEach((t) => c.pc.addTrack(t, c.local));
    c.el.querySelector('.call-local').srcObject = c.local;
  } catch {
    // без микрофона/камеры — только слушаем
    c.pc.addTransceiver('audio', { direction: 'recvonly' });
    if (c.video) c.pc.addTransceiver('video', { direction: 'recvonly' });
    toast('No access to microphone — listening only');
  }
  c.pc.onicecandidate = (e) => { if (e.candidate) post({ type: 'ice', callId: c.id, candidate: e.candidate.toJSON() }); };
  c.pc.ontrack = (e) => {
    const v = c.el.querySelector('.call-remote');
    v.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    v.play().catch(() => {});
    if (e.track.kind === 'video') c.el.classList.add('has-remote-video');
  };
  c.pc.onconnectionstatechange = () => {
    if (c !== call) return;
    if (c.pc.connectionState === 'connected') connected();
    if (['failed', 'disconnected'].includes(c.pc.connectionState)) finish('ended', c.outgoing);
  };
}

function connected() {
  if (call.state === 'active') return;
  call.state = 'active';
  call.started = Date.now();
  ringback(false);
  call.el.classList.add('is-active');
  call.tick = setInterval(() => setStatus(fmt((Date.now() - call.started) / 1000)), 500);
  setStatus('0:00');
}

async function flushIce() {
  for (const cand of call.queue.splice(0)) await call.pc.addIceCandidate(cand).catch(() => {});
}

/* ---------------------------------------------------------------------------
   Сигналинг
   --------------------------------------------------------------------------- */
bc?.addEventListener('message', async ({ data: msg }) => {
  if (msg.type === 'ring') { incoming(msg); return; }
  if (!call || msg.callId !== call.id) return;
  if (msg.tab === TAB) return;
  switch (msg.type) {
    case 'accept':
      if (!call.outgoing || call.state !== 'ringing') return;
      clearTimeout(call.timeout);
      call.calleeTab = msg.tab;
      call.state = 'connecting';
      setStatus('Connecting…');
      post({ type: 'taken', callId: call.id, tabOk: msg.tab });
      await setupPeer();
      await call.pc.setLocalDescription(await call.pc.createOffer());
      post({ type: 'offer', callId: call.id, sdp: call.pc.localDescription.toJSON() });
      break;
    case 'taken':
      // ответили на другой вкладке
      if (!call.outgoing && msg.tabOk !== TAB) finish(null, false, true);
      break;
    case 'offer':
      if (call.outgoing || !call.pc) return;
      await call.pc.setRemoteDescription(msg.sdp);
      await call.pc.setLocalDescription(await call.pc.createAnswer());
      post({ type: 'answer', callId: call.id, sdp: call.pc.localDescription.toJSON() });
      await flushIce();
      break;
    case 'answer':
      if (!call.outgoing) return;
      await call.pc.setRemoteDescription(msg.sdp);
      await flushIce();
      break;
    case 'ice':
      if (!call.pc) return;
      if (call.pc.remoteDescription) await call.pc.addIceCandidate(msg.candidate).catch(() => {});
      else call.queue.push(msg.candidate);
      break;
    case 'decline':
      finish('declined', call.outgoing);
      break;
    case 'busy':
      setStatus('Line busy');
      setTimeout(() => finish('busy', true), 1200);
      break;
    case 'end':
      finish(call.state === 'active' ? 'ended' : 'missed', call.outgoing);
      break;
    default:
  }
});

/* ---------------------------------------------------------------------------
   Завершение и запись в чат
   --------------------------------------------------------------------------- */
function finish(status, log, silent = false) {
  if (!call) return;
  const c = call;
  call = null;
  clearTimeout(c.timeout);
  clearInterval(c.tick);
  ringtone(false);
  ringback(false);
  if (!silent) post({ type: 'end', callId: c.id });
  c.pc?.close();
  c.local?.getTracks().forEach((t) => t.stop());
  const duration = c.started ? Math.round((Date.now() - c.started) / 1000) : 0;
  if (!silent) {
    c.el.querySelector('.call-status').textContent = { missed: 'No answer', declined: 'Declined', busy: 'Line busy' }[status] ?? 'Call ended';
  }
  c.el.classList.add('is-ending');
  setTimeout(() => c.el.remove(), silent ? 0 : 900);
  // в чат пишет только звонивший, чтобы запись была одна
  if (log && status && state.acc) {
    const me = state.acc.user.id;
    const id = chats.idFor(me, c.peer);
    chats.send(id, [me, c.peer], { from: me, kind: 'call', video: c.video, status, duration });
    document.dispatchEvent(new CustomEvent('kosmo:chat-updated', { detail: id }));
  }
}

function onAction(e) {
  const b = e.target.closest('[data-call]');
  if (!b || !call) return;
  const act = b.dataset.call;
  if (act === 'accept') accept();
  if (act === 'decline') { post({ type: 'decline', callId: call.id }); finish(null, false, true); }
  if (act === 'end') finish(call.state === 'active' ? 'ended' : 'missed', call.outgoing);
  if (act === 'mute') {
    const on = b.classList.toggle('is-off');
    call.local?.getAudioTracks().forEach((t) => { t.enabled = !on; });
    b.innerHTML = `${on ? I.micOff : I.mic}<span>${on ? 'Unmute' : 'Mute'}</span>`;
  }
  if (act === 'cam') {
    const tracks = call.local?.getVideoTracks() ?? [];
    if (!tracks.length) { toast('Video is off for this call'); return; }
    const on = b.classList.toggle('is-off');
    tracks.forEach((t) => { t.enabled = !on; });
    b.innerHTML = `${on ? I.camOff : I.cam}<span>Video</span>`;
  }
  if (act === 'speaker') b.classList.toggle('is-on');
}

window.addEventListener('beforeunload', () => { if (call) post({ type: 'end', callId: call.id }); });

/* ---------- Звуки: гудки и рингтон (WebAudio) ---------- */
let audio = null;
let beeper = null;
function tone(pattern) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    pattern.forEach(([freq, start, len]) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(0.08, t + start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
      o.connect(g).connect(audio.destination);
      o.start(t + start);
      o.stop(t + start + len + 0.05);
    });
  } catch { /* без звука */ }
}
function ringback(on) {
  clearInterval(beeper);
  if (on) { tone([[425, 0, 1]]); beeper = setInterval(() => tone([[425, 0, 1]]), 4000); }
}
function ringtone(on) {
  clearInterval(beeper);
  if (on) { const r = () => tone([[880, 0, 0.18], [660, 0.22, 0.18], [880, 0.44, 0.18]]); r(); beeper = setInterval(r, 2000); }
}

export const inCall = () => Boolean(call);
