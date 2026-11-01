/* ==========================================================================
   glisse.js — Liquid Glass physics for Kosmo.
   Ported to vanilla JS from github.com/0kzh/glisse (MIT License,
   Copyright (c) 2026 Kelvin Zhang): analytic damped springs, the press
   "rubber band", the selection that lifts into a lens and follows a drag
   (tab bar, segmented controls) and menus that spring open and let you
   scrub through rows with a finger.

   Only on the Liquid Glass theme; Material You keeps its own motion.
   Everything respects prefers-reduced-motion (springs jump to their target).
   ========================================================================== */

const root = document.documentElement;
const glassOn = () => root.dataset.theme !== 'material';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------------------------------------------------------------------------
   Spring: exact solution of a damped harmonic oscillator, one shared rAF loop
   --------------------------------------------------------------------------- */
const moving = new Set();
let frame = 0;
let last = 0;

function advance(s, dt) {
  const x = s.value - s.target;
  const v = s.velocity;
  const half = s.damping / 2;
  const disc = half * half - s.stiffness;
  if (Math.abs(disc) < 1e-4) {
    const decay = Math.exp(-half * dt);
    const b = v + half * x;
    s.value = s.target + decay * (x + b * dt);
    s.velocity = decay * (v - half * b * dt);
  } else if (disc > 0) {
    const r = Math.sqrt(disc);
    const r1 = -half + r;
    const r2 = -half - r;
    const a = (v - r2 * x) / (r1 - r2);
    const b = x - a;
    s.value = s.target + a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt);
    s.velocity = a * r1 * Math.exp(r1 * dt) + b * r2 * Math.exp(r2 * dt);
  } else {
    const w = Math.sqrt(-disc);
    const decay = Math.exp(-half * dt);
    const cos = Math.cos(w * dt);
    const sin = Math.sin(w * dt);
    s.value = s.target + decay * (x * cos + ((v + half * x) / w) * sin);
    s.velocity = decay * (v * cos - ((half * v + s.stiffness * x) / w) * sin);
  }
}

function tick(time) {
  frame = 0;
  const dt = Math.min(0.1, Math.max(0, (time - last) / 1000));
  last = time;
  for (const s of moving) {
    advance(s, dt);
    if (Math.abs(s.value - s.target) < 1e-3 && Math.abs(s.velocity) < 1e-2) {
      s.value = s.target;
      s.velocity = 0;
      moving.delete(s);
    }
    s.paint(s.value);
  }
  if (moving.size) frame = requestAnimationFrame(tick);
}

export function createSpring(value, stiffness, damping, paint) {
  const s = { value, target: value, velocity: 0, stiffness, damping, paint };
  return {
    get value() { return s.value; },
    get target() { return s.target; },
    paint: () => paint(s.value),
    set(target, instant = false) {
      s.target = target;
      if (instant || document.hidden || reduced()) {
        s.value = target;
        s.velocity = 0;
        moving.delete(s);
        paint(target);
        return;
      }
      moving.add(s);
      if (!frame) {
        last = Number(document.timeline?.currentTime ?? performance.now());
        frame = requestAnimationFrame(tick);
      }
    },
    tune(k, d) { s.stiffness = k; s.damping = d; },
    stop() { moving.delete(s); },
  };
}

/* ---------------------------------------------------------------------------
   Press: glass grows under the finger and stretches toward a drag
   --------------------------------------------------------------------------- */
const POINTER = { grow: 6, press: [417.6, 29.2], release: [230, 23.7] };
const TOUCH = { grow: 15, press: [515, 27.3], release: [250, 11.8] };
const PRESSABLE = 'button.glass, a.glass, .circle-btn, .icon-btn.glass';
const pressed = new WeakMap();

function pressRig(el) {
  if (pressed.has(el)) return pressed.get(el);
  const value = [1, 1, 0, 0];
  const paint = () => {
    const rest = value[0] === 1 && value[1] === 1 && value[2] === 0 && value[3] === 0;
    el.style.scale = rest ? '' : `${value[0]} ${value[1]}`;
    el.style.translate = rest ? '' : `${value[2]}px ${value[3]}px`;
  };
  const springs = value.map((v, i) => createSpring(v, ...POINTER.release, (n) => { value[i] = n; paint(); }));
  const rig = {
    to(next, [k, d]) { springs.forEach((s, i) => { s.tune(k, d); s.set(next[i]); }); },
  };
  pressed.set(el, rig);
  return rig;
}

function initPressSprings() {
  let p = null;
  const track = (e) => {
    const { el, box, feel, rig } = p;
    el.style.setProperty('--lg-x', `${((e.clientX - box.left) / box.width) * 100}%`);
    el.style.setProperty('--lg-y', `${((e.clientY - box.top) / box.height) * 100}%`);
    const { width, height } = box;
    const base = 1 + feel.grow / Math.max(width, height);
    const aspect = width / height;
    const dx = (e.clientX - p.x) / aspect;
    const dy = e.clientY - p.y;
    const len = Math.hypot(dx, dy);
    if (!len) return rig.to([base, base, 0, 0], feel.press);
    const nx = dx / len;
    const ny = dy / len;
    const rubber = 1 - 1 / (1 + len / height / (5 * aspect));
    const stretch = 1 + (6 / height) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
    const horiz = Math.abs(nx) > Math.abs(ny);
    rig.to([base * (horiz ? stretch : 1 / stretch), base * (horiz ? 1 / stretch : stretch), nx * 8 * rubber, ny * 8 * rubber], feel.press);
  };
  const end = (e) => {
    if (!p || (e && e.pointerId !== p.id)) return;
    const { el, rig, feel } = p;
    p = null;
    delete el.dataset.lgPressed;
    rig.to([1, 1, 0, 0], feel.release);
  };
  document.addEventListener('pointerdown', (e) => {
    if (!glassOn() || !e.isPrimary || e.button !== 0 || p) return;
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || el.closest('.tabbar, .seg, .segs, .menu')) return;
    p = {
      el, id: e.pointerId, x: e.clientX, y: e.clientY,
      box: el.getBoundingClientRect(),
      feel: e.pointerType === 'mouse' ? POINTER : TOUCH,
      rig: pressRig(el),
    };
    el.dataset.lgPressed = '';
    track(e);
  }, true);
  addEventListener('pointermove', (e) => { if (p && e.pointerId === p.id) track(e); }, { passive: true });
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  addEventListener('blur', () => end());
}

/* ---------------------------------------------------------------------------
   Lens refraction: a rim displacement map (squircle-ish Snell profile) used
   as backdrop-filter. (glisse also splits RGB at the rim; in Chrome's
   backdrop-filter a split chain greys out light backdrops, so it's left out.) Only Chromium filters the live
   backdrop with url(); elsewhere the lens is a clear glass without bending.
   --------------------------------------------------------------------------- */
const refracts = /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
const lensCache = new Map();
let defs = null;

function lensFilter(w, h, radius) {
  w = Math.round(w); h = Math.round(h);
  const r = Math.min(radius, h / 2, w / 2);
  const key = `${w}x${h}x${Math.round(r)}`;
  if (lensCache.has(key)) return lensCache.get(key);
  if (!defs) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs = document.createElementNS(svg.namespaceURI, 'defs');
    svg.append(defs);
    document.body.append(svg);
  }
  const bezel = Math.max(6, Math.min(14, h / 2.6));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const d = r - out - Math.min(Math.max(qx, qy), 0);   // distance to the rim, inside > 0
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) { nx = (qx / out) * Math.sign(px); ny = (qy / out) * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);
      // thick glass: near the rim each pixel looks further in (Snell, steep at the edge)
      const t = d < bezel ? 1 - Math.max(0, d) / bezel : 0;
      const m = t * t * (1.6 - 0.6 * t);
      const i = (y * w + x) * 4;
      img.data[i] = 128 - 127 * nx * m;
      img.data[i + 1] = 128 - 127 * ny * m;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const id = `lg-lens-${lensCache.size}`;
  const s = bezel * 1.1;
  defs.insertAdjacentHTML('beforeend', `
    <filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feImage href="${c.toDataURL()}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${s.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`);
  lensCache.set(key, id);
  return id;
}

/* ---------------------------------------------------------------------------
   Selection: the indicator springs between choices, follows a drag and lifts
   into a clear lens while held (tab bar, .seg, .segs)
   --------------------------------------------------------------------------- */
const REST = [1024, 58.9, 676, 47.8];   // slide k/d, lift k/d
const DRAG = [2500, 94, 576, 44.2];
const BARS = '.tabbar, .seg, .segs';
const bars = new WeakMap();

const KIND = {
  tabbar: { items: '.tab', on: (b) => b.classList.contains('is-active'), thumb: '.tab-thumb', grow: [16, 12] },
  seg: { items: '.seg-item', on: (b) => b.getAttribute('aria-checked') === 'true', thumb: '.seg-thumb', grow: [14, 10] },
  segs: { items: '.seg-btn', on: (b) => b.getAttribute('aria-checked') === 'true', thumb: null, grow: [10, 8] },
};
const kindOf = (bar) => (bar.classList.contains('tabbar') ? 'tabbar' : bar.classList.contains('seg') ? 'seg' : 'segs');

function attachBar(bar) {
  if (bars.has(bar)) return bars.get(bar);
  const kind = KIND[kindOf(bar)];
  let thumb = kind.thumb && bar.querySelector(kind.thumb);
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.setAttribute('aria-hidden', 'true');
    bar.prepend(thumb);
  }
  thumb.classList.add('lg-thumb');
  bar.classList.add('lg-bar');

  const st = { x: 0, y: 0, w: 0, h: 0, lift: 0 };
  let shown = false;
  let gesture = null;
  let suppress = false;
  const items = () => [...bar.querySelectorAll(kind.items)];

  const paint = () => {
    if (!glassOn()) return;
    const { w, h, lift } = st;
    const sx = w ? 1 + (kind.grow[0] / w) * lift : 1;
    const sy = h ? 1 + (kind.grow[1] / h) * lift : 1;
    thumb.style.width = `${w}px`;
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translate(${st.x}px, ${st.y}px) scale(${sx}, ${sy})`;
    thumb.style.setProperty('--lg-lift', clamp(lift, 0, 1).toFixed(3));
    bar.toggleAttribute('data-lg-lensing', lift > 0.04);
  };
  const sp = {
    x: createSpring(0, REST[0], REST[1], (v) => { st.x = v; paint(); }),
    y: createSpring(0, REST[0], REST[1], (v) => { st.y = v; paint(); }),
    w: createSpring(0, REST[0], REST[1], (v) => { st.w = v; paint(); }),
    h: createSpring(0, REST[0], REST[1], (v) => { st.h = v; paint(); }),
    lift: createSpring(0, REST[2], REST[3], (v) => { st.lift = v; paint(); }),
  };
  const tune = () => {
    const [k, d, lk, ld] = gesture?.moved ? DRAG : REST;
    sp.x.tune(k, d); sp.y.tune(k, d); sp.w.tune(k, d); sp.h.tune(k, d);
    sp.lift.tune(lk, ld);
  };
  // Box of an item relative to the bar's padding box (where the thumb lives)
  const boxOf = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  const moveTo = (b, instant) => {
    tune();
    sp.x.set(b.x, instant); sp.y.set(b.y, instant); sp.w.set(b.w, instant); sp.h.set(b.h, instant);
  };

  const settle = (instant = false) => {
    if (!glassOn()) { clear(); return; }
    const sel = items().find(kind.on);
    bar.toggleAttribute('data-lg-empty', !sel);
    if (!sel || gesture) return;
    moveTo(boxOf(sel), instant || !shown);
    sp.lift.set(0, instant);
    shown = true;
  };
  const clear = () => {
    shown = false;
    for (const k of ['width', 'height', 'transform', '--lg-lift', '--lg-x', '--lg-lens-filter']) thumb.style.removeProperty(k);
    bar.removeAttribute('data-lg-lensing');
  };

  // Horizontal drag across one row; .segs that wrap pick the item under the finger
  const itemAt = (e) => {
    const list = items();
    let best = null;
    let dist = Infinity;
    const r = bar.getBoundingClientRect();
    for (const it of list) {
      const b = it.getBoundingClientRect();
      const dy = e.clientY < b.top ? b.top - e.clientY : e.clientY > b.bottom ? e.clientY - b.bottom : 0;
      const d = Math.abs(e.clientX - (b.left + b.width / 2)) + dy * 3;
      if (d < dist) { dist = d; best = it; }
    }
    return e.clientY > r.top - 40 && e.clientY < r.bottom + 40 ? best : null;
  };

  const down = (e) => {
    if (!glassOn() || !e.isPrimary || e.button !== 0 || gesture) return;
    const it = e.target.closest(kind.items);
    if (!it || it.disabled) return;
    const b = boxOf(it);
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, start: it, b, moved: false, over: it };
    suppress = false;
    bar.dataset.lgLifted = '';
    const r = it.getBoundingClientRect();
    thumb.style.setProperty('--lg-x', `${clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)}%`);
    if (refracts && !matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      const rad = parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0;
      thumb.style.setProperty('--lg-lens-filter', `url(#${lensFilter(b.w, b.h, rad)}) saturate(1.6) brightness(1.08)`);
    }
    moveTo(b, !shown);
    shown = true;
    sp.lift.set(1);
  };
  const move = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x;
    if (!gesture.moved && Math.abs(dx) > 6) {
      gesture.moved = true;
      try { bar.setPointerCapture(e.pointerId); } catch { /* touch already captured */ }
    }
    if (!gesture.moved) return;
    const list = items();
    const over = itemAt(e) ?? gesture.over;
    gesture.over = over;
    const ob = boxOf(over);
    const minX = Math.min(...list.map((i) => i.offsetLeft));
    const maxX = Math.max(...list.map((i) => i.offsetLeft + i.offsetWidth)) - ob.w;
    tune();
    // the lens rides under the finger; its size and row come from the item below
    sp.x.set(clamp(gesture.b.x + dx + (gesture.b.w - ob.w) / 2, minX, maxX), true);
    sp.y.set(ob.y); sp.w.set(ob.w); sp.h.set(ob.h);
  };
  const up = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    delete bar.dataset.lgLifted;
    if (bar.hasPointerCapture?.(g.id)) bar.releasePointerCapture(g.id);
    if (g.moved && e.type === 'pointerup' && g.over) {
      suppress = true;
      setTimeout(() => { suppress = false; }, 400);
      if (!kind.on(g.over)) g.over.click();
    }
    requestAnimationFrame(() => settle());
  };
  const lost = (e) => { if (e.target === bar) up(e); };
  bar.addEventListener('pointerdown', down);
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  bar.addEventListener('lostpointercapture', lost);
  // a drag that started on one item would click it on release: swallow that click
  bar.addEventListener('click', (e) => {
    if (suppress && e.isTrusted) { suppress = false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  bar.addEventListener('touchmove', (e) => { if (gesture?.moved && e.cancelable) e.preventDefault(); }, { passive: false });

  const mo = new MutationObserver(() => settle());
  mo.observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-checked', 'class'] });
  new ResizeObserver(() => settle(true)).observe(bar);

  const ctl = { settle, clear };
  bars.set(bar, ctl);
  settle(true);
  return ctl;
}

/* ---------------------------------------------------------------------------
   Menus: spring open from the corner they grow from, a plate that slides
   between rows, and press-and-slide to pick (works right after a long-press)
   --------------------------------------------------------------------------- */
const LIST_MENUS = '.menu:not(.emoji-picker)';
const opened = new WeakSet();
let lastOpen = 0;

function openMenu(menu) {
  if (!glassOn() || opened.has(menu) || menu.hidden || menu.classList.contains('is-closing')) return;
  opened.add(menu);
  lastOpen = performance.now();
  menu.classList.add('lg-menu');
  let plate = menu.querySelector(':scope > .lg-plate');
  if (!plate) {
    plate = document.createElement('span');
    plate.className = 'lg-plate';
    plate.setAttribute('aria-hidden', 'true');
    menu.prepend(plate);
  }
  const morph = createSpring(0, 600, 46, (t) => {
    if (menu.classList.contains('is-closing')) return;
    const done = t === 1;
    const c = clamp(t, 0, 1.2);
    menu.style.opacity = done ? '' : String(clamp(t / 0.25, 0, 1));
    menu.style.scale = done ? '' : String(0.5 + 0.5 * c);
    // contents arrive a little after the glass, out of a soft blur
    const k = clamp((t - 0.12) / 0.6, 0, 1);
    menu.style.setProperty('--lg-in', done ? '' : k.toFixed(3));
  });
  morph.set(0, true);
  morph.set(1);
  menuGesture.attach(menu, plate);
}

function closedMenu(menu) {
  opened.delete(menu);
  menu.style.opacity = '';
  menu.style.scale = '';
  menu.style.removeProperty('--lg-in');
  menu.querySelector(':scope > .lg-plate')?.style.setProperty('opacity', '0');
}

const menuGesture = (() => {
  const plates = new WeakMap();
  let active = null;   // { menu, plate, row, springs }
  let press = null;    // { id, x, y, moved, startRow }

  const rowAt = (x, y) => {
    const row = document.elementFromPoint(x, y)?.closest?.('.menu-item');
    return row && !row.disabled && row.closest(LIST_MENUS) ? row : null;
  };

  function attach(menu, plate) {
    const st = { y: 0, h: 0, x: 0, w: 0 };
    const paint = () => {
      plate.style.transform = `translate(${st.x}px, ${st.y}px)`;
      plate.style.width = `${st.w}px`;
      plate.style.height = `${st.h}px`;
    };
    plates.set(menu, {
      plate,
      row: null,
      s: ['x', 'y', 'w', 'h'].map((k) => createSpring(0, 900, 52, (v) => { st[k] = v; paint(); })),
    });
  }

  function highlight(row) {
    const menu = row?.closest(LIST_MENUS);
    if (active && active.menu !== menu) { active.plate.style.opacity = '0'; active.row = null; active = null; }
    if (!row) return;
    const rig = plates.get(menu);
    if (!rig) return;
    active = Object.assign(rig, { menu });
    if (rig.row === row) return;
    const first = !rig.row || rig.plate.style.opacity === '0';
    rig.row = row;
    const b = [row.offsetLeft, row.offsetTop, row.offsetWidth, row.offsetHeight];
    rig.s.forEach((s, i) => s.set(b[i], first));
    rig.plate.style.opacity = '1';
    if (press?.moved) navigator.vibrate?.(4);
  }
  function unhighlight() {
    if (!active) return;
    active.plate.style.opacity = '0';
    active.row = null;
    active = null;
  }

  addEventListener('pointerdown', (e) => {
    if (!glassOn() || !e.isPrimary) return;
    press = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY, moved: false, startRow: rowAt(e.clientX, e.clientY) };
    if (press.startRow) highlight(press.startRow);
  }, true);
  addEventListener('pointermove', (e) => {
    if (!glassOn()) return;
    if (!press) {
      if (e.pointerType === 'mouse') { const r = rowAt(e.clientX, e.clientY); if (r) highlight(r); else unhighlight(); }
      return;
    }
    if (e.pointerId !== press.id) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
    if (!press.moved) return;
    const r = rowAt(e.clientX, e.clientY);
    if (r) highlight(r);
    else if (active) unhighlight();
  }, { passive: true });
  const end = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    const row = e.type === 'pointerup' && p.moved ? rowAt(e.clientX, e.clientY) : null;
    if (e.pointerType !== 'mouse') unhighlight();
    // the browser only clicks when down and up land on the same row
    if (row && row !== p.startRow) row.click();
  };
  addEventListener('pointerup', end, true);
  addEventListener('pointercancel', end, true);
  // a finger that opened a menu by long-press slides over its rows instead of scrolling the page
  addEventListener('touchmove', (e) => {
    if (press && e.cancelable && (press.t < lastOpen || press.startRow) && document.querySelector('.lg-menu:not([hidden], .is-closing)')) e.preventDefault();
  }, { passive: false });
  return { attach };
})();

/* ---------------------------------------------------------------------------
   Wiring: find bars and menus as screens are rendered
   --------------------------------------------------------------------------- */
function scan(node = document) {
  if (!glassOn()) return;
  if (node.matches?.(BARS)) attachBar(node);
  node.querySelectorAll?.(BARS).forEach(attachBar);
  const menus = node.matches?.(LIST_MENUS) ? [node] : [...(node.querySelectorAll?.(LIST_MENUS) ?? [])];
  menus.forEach((m) => { if (!m.hidden) openMenu(m); });
}

export function initGlisse() {
  initPressSprings();
  scan();
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') {
        r.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
        continue;
      }
      const el = r.target;
      if (!el.matches(LIST_MENUS)) continue;
      if (el.hidden || el.classList.contains('is-closing')) closedMenu(el);
      else if (r.attributeName === 'hidden') openMenu(el);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  // theme switch: hand the indicators back to CSS (Material) or take them over
  new MutationObserver(() => {
    document.querySelectorAll('.lg-bar').forEach((b) => bars.get(b)?.settle(true));
    if (glassOn()) scan();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
}
