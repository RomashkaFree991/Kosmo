// Редактор фото перед отправкой: рисование кистью, обрезка, поворот, отмена
// и «На один просмотр». Открывается по нажатию на фото в лотке вложений.
// Возвращает { file, url, once } или null, если закрыли без изменений.

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  draw: svg('<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 7l3 3"/>'),
  crop: svg('<path d="M6 3v13a2 2 0 0 0 2 2h13"/><path d="M3 6h13a2 2 0 0 1 2 2v13"/>'),
  rotate: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  fire: svg('<path d="M12 21c-4 0-7-2.7-7-6.6 0-3.1 2-5.2 3.6-7 .3 1.9 1.4 3.1 2.6 3.6C11 7.4 12.6 4.6 15 3c-.4 2.8.8 4.6 2.2 6.2C18.4 10.6 19 12.2 19 14.4 19 18.3 16 21 12 21z"/>'),
};
const COLORS = ['#ffffff', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#000000'];
const MAX = 2048;

export function openPhotoEditor({ url, once = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ped';
    el.innerHTML = `
      <header class="ped-top">
        <button class="ped-txt" type="button" data-ped="cancel">Cancel</button>
        <span class="ped-title">Edit photo</span>
        <button class="ped-txt ped-done" type="button" data-ped="done">Done</button>
      </header>
      <div class="ped-stage"><div class="ped-wrap"><canvas class="ped-canvas"></canvas><div class="ped-crop" hidden><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
      <div class="ped-sub ped-colors">${COLORS.map((c, i) => `<button class="ped-color${i === 1 ? ' is-on' : ''}" type="button" data-color="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('')}
        <input class="ped-size" type="range" min="2" max="40" value="8" aria-label="Brush size"></div>
      <div class="ped-sub ped-cropbar" hidden>
        <button class="ped-chip is-on" type="button" data-ratio="0">Free</button>
        <button class="ped-chip" type="button" data-ratio="1">Square</button>
        <button class="ped-chip" type="button" data-ratio="1.3333">4:3</button>
        <button class="ped-chip" type="button" data-ratio="0.5625">9:16</button>
        <button class="ped-chip ped-apply" type="button" data-ped="apply-crop">Apply</button>
      </div>
      <footer class="ped-tools">
        <button class="ped-tool is-on" type="button" data-tool="draw" aria-label="Draw">${I.draw}<span>Draw</span></button>
        <button class="ped-tool" type="button" data-tool="crop" aria-label="Crop">${I.crop}<span>Crop</span></button>
        <button class="ped-tool" type="button" data-ped="rotate" aria-label="Rotate">${I.rotate}<span>Rotate</span></button>
        <button class="ped-tool" type="button" data-ped="undo" aria-label="Undo">${I.undo}<span>Undo</span></button>
        <button class="ped-tool ped-once${once ? ' is-on' : ''}" type="button" data-ped="once" aria-pressed="${once}">${I.fire}<span>View once</span></button>
      </footer>`;
    document.body.append(el);
    const canvas = el.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const cropEl = el.querySelector('.ped-crop');
    const history = [];
    let tool = 'draw';
    let color = COLORS[1];
    let size = 8;
    let changed = false;
    let ratio = 0;

    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = url;

    const snapshot = () => {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 12) history.shift();
    };
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height, k: canvas.width / r.width };
    };

    // Рисование
    let stroke = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (tool !== 'draw') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      snapshot();
      const p = toCanvas(e);
      stroke = p;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size * p.k;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y);
      ctx.stroke();
      changed = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!stroke) return;
      const p = toCanvas(e);
      ctx.beginPath();
      ctx.moveTo(stroke.x, stroke.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      stroke = p;
    });
    const endStroke = () => { stroke = null; };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    // Обрезка: рамка поверх фото, тянуть углы или саму рамку
    let box = null;   // в долях от картинки: x, y, w, h
    const paintCrop = () => {
      cropEl.style.left = `${box.x * 100}%`;
      cropEl.style.top = `${box.y * 100}%`;
      cropEl.style.width = `${box.w * 100}%`;
      cropEl.style.height = `${box.h * 100}%`;
    };
    const fitRatio = () => {
      if (!ratio) return;
      const aspect = canvas.width / canvas.height;   // w/h картинки
      // ratio — ширина/высота рамки в пикселях
      let w = box.w;
      let h = (w * aspect) / ratio;
      if (h > 1) { h = 1; w = (h * ratio) / aspect; }
      box = { x: Math.min(box.x, 1 - w), y: Math.min(box.y, 1 - h), w, h };
    };
    const startCrop = () => {
      box = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
      fitRatio();
      cropEl.hidden = false;
      paintCrop();
    };
    let drag = null;
    cropEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cropEl.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      drag = { h: e.target.dataset.h ?? 'move', x: e.clientX, y: e.clientY, box: { ...box }, r };
    });
    cropEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) / drag.r.width;
      const dy = (e.clientY - drag.y) / drag.r.height;
      const b = { ...drag.box };
      const min = 0.08;
      if (drag.h === 'move') {
        b.x = Math.min(1 - b.w, Math.max(0, b.x + dx));
        b.y = Math.min(1 - b.h, Math.max(0, b.y + dy));
      } else {
        if (drag.h.includes('w')) { const nx = Math.min(b.x + b.w - min, Math.max(0, b.x + dx)); b.w += b.x - nx; b.x = nx; }
        if (drag.h.includes('e')) b.w = Math.min(1 - b.x, Math.max(min, b.w + dx));
        if (drag.h.includes('n')) { const ny = Math.min(b.y + b.h - min, Math.max(0, b.y + dy)); b.h += b.y - ny; b.y = ny; }
        if (drag.h.includes('s')) b.h = Math.min(1 - b.y, Math.max(min, b.h + dy));
        if (ratio) {
          const aspect = canvas.width / canvas.height;
          b.h = Math.min(1 - b.y, (b.w * aspect) / ratio);
          b.w = (b.h * ratio) / aspect;
        }
      }
      box = b;
      paintCrop();
    });
    cropEl.addEventListener('pointerup', () => { drag = null; });

    const applyCrop = () => {
      if (!box) return;
      snapshot();
      const sx = Math.round(box.x * canvas.width);
      const sy = Math.round(box.y * canvas.height);
      const sw = Math.max(1, Math.round(box.w * canvas.width));
      const sh = Math.max(1, Math.round(box.h * canvas.height));
      const part = ctx.getImageData(sx, sy, sw, sh);
      canvas.width = sw;
      canvas.height = sh;
      ctx.putImageData(part, 0, 0);
      changed = true;
      setTool('draw');
    };

    const rotate = () => {
      snapshot();
      const tmp = document.createElement('canvas');
      tmp.width = canvas.height;
      tmp.height = canvas.width;
      const t = tmp.getContext('2d');
      t.translate(tmp.width, 0);
      t.rotate(Math.PI / 2);
      t.drawImage(canvas, 0, 0);
      canvas.width = tmp.width;
      canvas.height = tmp.height;
      ctx.drawImage(tmp, 0, 0);
      changed = true;
      if (tool === 'crop') startCrop();
    };

    const undo = () => {
      const last = history.pop();
      if (!last) return;
      canvas.width = last.width;
      canvas.height = last.height;
      ctx.putImageData(last, 0, 0);
      if (tool === 'crop') startCrop();
    };

    function setTool(t) {
      tool = t;
      el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === t));
      el.querySelector('.ped-colors').hidden = t !== 'draw';
      el.querySelector('.ped-cropbar').hidden = t !== 'crop';
      el.classList.toggle('is-cropping', t === 'crop');
      if (t === 'crop') startCrop();
      else cropEl.hidden = true;
    }

    const close = (result) => {
      el.classList.add('is-closing');
      setTimeout(() => el.remove(), 200);
      resolve(result);
    };

    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-color]');
      if (c) {
        color = c.dataset.color;
        el.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('is-on', b === c));
        return;
      }
      const r = e.target.closest('[data-ratio]');
      if (r) {
        ratio = Number(r.dataset.ratio);
        el.querySelectorAll('[data-ratio]').forEach((b) => b.classList.toggle('is-on', b === r));
        startCrop();
        return;
      }
      const t = e.target.closest('[data-tool]');
      if (t) { setTool(t.dataset.tool); return; }
      const a = e.target.closest('[data-ped]')?.dataset.ped;
      if (a === 'cancel') close(null);
      if (a === 'rotate') rotate();
      if (a === 'undo') undo();
      if (a === 'apply-crop') applyCrop();
      if (a === 'once') {
        once = !once;
        const b = e.target.closest('[data-ped]');
        b.classList.toggle('is-on', once);
        b.setAttribute('aria-pressed', String(once));
      }
      if (a === 'done') {
        if (tool === 'crop' && box && (box.w < 0.99 || box.h < 0.99)) applyCrop();
        if (!changed) { close({ once }); return; }
        canvas.toBlob((blob) => {
          const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          close({ file, url: URL.createObjectURL(blob), once });
        }, 'image/jpeg', 0.9);
      }
    });
    el.querySelector('.ped-size').addEventListener('input', (e) => { size = Number(e.target.value); });
  });
}
