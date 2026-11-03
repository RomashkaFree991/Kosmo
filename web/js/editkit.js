// Инструменты экрана «Редактировать профиль»:
//  • openCropper — фото посередине, круг (аватар) или рамка (баннер), снаружи
//    затемнение; фото двигается пальцем, масштаб — щипком, колёсиком или ползунком;
//  • openFieldScreen — отдельный экран для одного поля: круг «назад» слева,
//    поле с тонкой линией, ниже — что можно и что нельзя, справа галочка.

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const BACK = svg('<path d="M14.5 6l-6 6 6 6"/>');
const CHECK = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>');

function layer(cls, html) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  return el;
}
function dismiss(el) {
  el.classList.remove('is-in');
  el.classList.add('is-out');
  setTimeout(() => el.remove(), 320);
}

/* ---------------------------------------------------------------------------
   Обрезка
   --------------------------------------------------------------------------- */
export function openCropper({ file, shape = 'circle', aspect = 1, out = 1024, title = 'Move and scale' }) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = layer(`crop crop-${shape}`, `
      <header class="kit-top">
        <button class="circle-btn glass kit-back" type="button" data-crop="cancel" aria-label="Cancel">${BACK}</button>
        <div class="title-pill glass"><span>${title}</span></div>
        <button class="circle-btn kit-ok" type="button" data-crop="done" aria-label="Done">${CHECK}</button>
      </header>
      <div class="crop-stage"><img class="crop-img" alt="" draggable="false"><div class="crop-hole" aria-hidden="true"></div></div>
      <div class="crop-bottom">
        <input class="crop-zoom" type="range" min="0" max="1000" value="0" aria-label="Zoom">
        <p class="crop-hint">Drag the photo to move it, pinch or use the slider to zoom</p>
      </div>`);
    const stage = el.querySelector('.crop-stage');
    const img = el.querySelector('.crop-img');
    const hole = el.querySelector('.crop-hole');
    const zoom = el.querySelector('.crop-zoom');
    let iw = 0; let ih = 0; let s = 1; let min = 1; let cx = 0; let cy = 0;
    let H = { x: 0, y: 0, w: 0, h: 0 };

    const measure = () => {
      const W = stage.clientWidth;
      const Ht = stage.clientHeight;
      let w; let h;
      if (shape === 'circle') { w = h = Math.min(W - 40, Ht - 40, 420); } else { w = Math.min(W - 24, 640); h = w / aspect; if (h > Ht - 40) { h = Ht - 40; w = h * aspect; } }
      H = { x: (W - w) / 2, y: (Ht - h) / 2, w, h };
      Object.assign(hole.style, { left: `${H.x}px`, top: `${H.y}px`, width: `${w}px`, height: `${h}px` });
      min = Math.max(w / iw, h / ih);
    };
    const clamp = () => {
      s = Math.min(min * 6, Math.max(min, s));
      const hw = (iw * s) / 2;
      const hh = (ih * s) / 2;
      cx = Math.min(H.x + hw, Math.max(H.x + H.w - hw, cx));
      cy = Math.min(H.y + hh, Math.max(H.y + H.h - hh, cy));
    };
    const paint = () => {
      clamp();
      img.style.transform = `translate(${cx - (iw * s) / 2}px, ${cy - (ih * s) / 2}px) scale(${s})`;
      zoom.value = String(Math.round((Math.log(s / min) / Math.log(6)) * 1000));
    };
    const zoomAt = (ns, px, py) => {
      const k = Math.min(min * 6, Math.max(min, ns)) / s;
      cx = px + (cx - px) * k;
      cy = py + (cy - py) * k;
      s *= k;
      paint();
    };

    img.onload = () => {
      iw = img.naturalWidth;
      ih = img.naturalHeight;
      img.style.width = `${iw}px`;
      img.style.height = `${ih}px`;
      measure();
      s = min;
      cx = H.x + H.w / 2;
      cy = H.y + H.h / 2;
      paint();
      el.classList.add('is-ready');
    };
    img.onerror = () => { close(null); };
    img.src = url;
    const onResize = () => { if (!iw) return; const rel = s / min; measure(); s = min * rel; paint(); };
    addEventListener('resize', onResize);

    // перетаскивание и щипок
    const pts = new Map();
    let start = null;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = null;
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        cx += e.clientX - prev.x;
        cy += e.clientY - prev.y;
        paint();
        return;
      }
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = stage.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      if (!start) { start = { d, s, mx, my }; return; }
      cx += mx - start.mx;
      cy += my - start.my;
      start.mx = mx;
      start.my = my;
      zoomAt(start.s * (d / start.d), mx, my);
    });
    const up = (e) => { pts.delete(e.pointerId); start = null; };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    zoom.addEventListener('input', () => zoomAt(min * 6 ** (Number(zoom.value) / 1000), H.x + H.w / 2, H.y + H.h / 2));

    function close(result) {
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey, true);
      dismiss(el);
      URL.revokeObjectURL(url);
      resolve(result);
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(null); } };
    addEventListener('keydown', onKey, true);

    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-crop]')?.dataset.crop;
      if (a === 'cancel') close(null);
      if (a !== 'done' || !iw) return;
      // кусок картинки под рамкой → canvas нужного размера
      const imgX = cx - (iw * s) / 2;
      const imgY = cy - (ih * s) / 2;
      const sx = (H.x - imgX) / s;
      const sy = (H.y - imgY) / s;
      const sw = H.w / s;
      const sh = H.h / s;
      const ow = Math.round(Math.min(out, sw));
      const oh = Math.round(ow / (H.w / H.h));
      const c = document.createElement('canvas');
      c.width = ow;
      c.height = oh;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
      c.toBlob((blob) => close(blob), 'image/jpeg', 0.9);
    });
  });
}

/* ---------------------------------------------------------------------------
   Экран одного поля
   check(v) → { ok, note?, tone? } или Promise с тем же (например, «занято?» с сервера)
   --------------------------------------------------------------------------- */
export function openFieldScreen({ title, value = '', prefix = '', placeholder = '', max = 40, multiline = false, rules = '', check = () => ({ ok: true }), clean = (v) => v, counter = false }) {
  return new Promise((resolve) => {
    const tag = multiline ? 'textarea' : 'input';
    const el = layer('kit-field', `
      <header class="kit-top">
        <button class="circle-btn glass kit-back" type="button" data-kf="back" aria-label="Back">${BACK}</button>
        <div class="title-pill glass"><span>${title}</span></div>
        <button class="circle-btn kit-ok" type="button" data-kf="ok" aria-label="Done" disabled>${CHECK}</button>
      </header>
      <div class="kf-body">
        <label class="kf-line">
          ${prefix ? `<span class="kf-prefix">${prefix}</span>` : ''}
          <${tag} class="kf-input" ${multiline ? 'rows="1"' : 'type="text"'} maxlength="${max}" placeholder="${placeholder}" autocomplete="off" autocapitalize="${prefix === '@' ? 'none' : 'sentences'}" spellcheck="${prefix === '@' ? 'false' : 'true'}">${multiline ? '' : ''}${multiline ? `</${tag}>` : ''}
          ${counter ? `<span class="kf-count"></span>` : ''}
        </label>
        <p class="kf-status" aria-live="polite"></p>
        <div class="kf-rules">${rules}</div>
      </div>`);
    const input = el.querySelector('.kf-input');
    const ok = el.querySelector('[data-kf="ok"]');
    const status = el.querySelector('.kf-status');
    const line = el.querySelector('.kf-line');
    const count = el.querySelector('.kf-count');
    input.value = value;
    let seq = 0;
    let good = false;
    const fit = () => { if (multiline) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; } };
    const run = async () => {
      const v = clean(input.value);
      if (v !== input.value) input.value = v;
      if (count) count.textContent = String(max - v.length);
      fit();
      const my = ++seq;
      let r = check(v);
      if (r?.then) {
        good = false;
        ok.disabled = true;
        line.dataset.tone = 'wait';
        status.textContent = r.pending ?? 'Checking…';
        r = await r;
        if (my !== seq) return;
      }
      good = Boolean(r?.ok);
      ok.disabled = !good;
      line.dataset.tone = r?.tone ?? (good ? (v !== value ? 'ok' : '') : (v ? 'bad' : ''));
      status.textContent = r?.note ?? '';
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); if (good) finish(clean(input.value).trim()); } });
    run();
    setTimeout(() => { input.focus(); const n = input.value.length; input.setSelectionRange?.(n, n); }, 320);

    function finish(result) {
      removeEventListener('keydown', onKey, true);
      input.blur();
      dismiss(el);
      resolve(result);
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(null); } };
    addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-kf]')?.dataset.kf;
      if (a === 'back') finish(null);
      if (a === 'ok' && good) finish(clean(input.value).trim());
    });
  });
}
