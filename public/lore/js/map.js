/* The map itself: theme, infinite terrain, pan/zoom, pins, hover brief.
   Depends on content.js, worldgen.js and core.js. */
"use strict";

function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--ember', THEME.ember);
  r.setProperty('--brass', THEME.brass);
  r.setProperty('--bone', THEME.bone);
  r.setProperty('--void', THEME.void);
  r.setProperty('--soot', THEME.soot);
  if (THEME.arcane) r.setProperty('--arcane', THEME.arcane);
  document.body.style.background = THEME.void;
}

/* ── Infinite terrain ──────────────────────────────────────
   Worldgen draws any tile from its coordinates alone, so tiles
   line up exactly and the map has no edge. Tiles render one per
   frame and pause while you're dragging, so panning stays smooth.
   ────────────────────────────────────────────────────────────── */
Worldgen.setSeed(CONFIG.seed);
const TILE = CONFIG.tile, TRES = CONFIG.res;
const tiles = new Map();
const queue = [];
const tkey = (c, r) => c + ',' + r;
const mkCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h; return c;
};

function requestTile(col, row) {
  const k = tkey(col, row);
  if (tiles.has(k)) return tiles.get(k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = TRES;
  cv.className = 'terrain-tile';
  cv.style.left = (col * TILE) + 'px';
  cv.style.top = (row * TILE) + 'px';
  cv.style.width = cv.style.height = TILE + 'px';
  const rec = { cv, col, row, attached: false, drawn: false };
  tiles.set(k, rec);
  queue.push(rec);
  return rec;
}

function pumpTiles() {
  if (queue.length && !dragging) {
    /* nearest to the middle of the screen first */
    const mx = (innerWidth / 2 - view.x) / view.z, my = (innerHeight / 2 - view.y) / view.z;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const d = Math.hypot(queue[i].col * TILE + TILE / 2 - mx, queue[i].row * TILE + TILE / 2 - my);
      if (d < bd) { bd = d; bi = i; }
    }
    const rec = queue.splice(bi, 1)[0];
    if (tiles.get(tkey(rec.col, rec.row)) === rec) {
      try {
        Worldgen.drawTile(rec.cv.getContext('2d'), rec.col * TILE, rec.row * TILE, TILE, TRES, mkCanvas);
      } catch (e) { /* a failed tile just stays dark */ }
      rec.drawn = true;
      requestAnimationFrame(() => rec.cv.classList.add('in'));
    }
  }
  requestAnimationFrame(pumpTiles);
}

let tileFrame = 0;
function syncTiles() {
  cancelAnimationFrame(tileFrame);
  tileFrame = requestAnimationFrame(() => {
    const x0 = -view.x / view.z, y0 = -view.y / view.z;
    const x1 = x0 + innerWidth / view.z, y1 = y0 + innerHeight / view.z;
    const c0 = Math.floor(x0 / TILE) - 1, c1 = Math.floor(x1 / TILE) + 1;
    const r0 = Math.floor(y0 / TILE) - 1, r1 = Math.floor(y1 / TILE) + 1;
    const want = new Set();
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      want.add(tkey(c, r));
      const rec = requestTile(c, r);
      if (!rec.attached) { world.appendChild(rec.cv); rec.attached = true; }
    }
    /* keep memory flat on an endless map */
    if (tiles.size > 80) {
      for (const [k, rec] of tiles) {
        if (want.has(k)) continue;
        if (rec.attached) rec.cv.remove();
        tiles.delete(k);
        const qi = queue.indexOf(rec);
        if (qi >= 0) queue.splice(qi, 1);
        if (tiles.size <= 52) break;
      }
    }
  });
}

/* ── Viewport ──────────────────────────────────────────────── */
const view = { x: 0, y: 0, z: CONFIG.start.z };
const MINZ = 0.14, MAXZ = 2.4;

function centerOn(wx, wy, z) {
  view.z = z != null ? z : view.z;
  view.x = innerWidth / 2 - wx * view.z;
  view.y = innerHeight / 2 - wy * view.z;
  apply();
}
function apply() {
  world.style.transform = 'translate3d(' + view.x + 'px,' + view.y + 'px,0) scale(' + view.z + ')';
  $('#zLvl').textContent = Math.round(view.z * 100) + '%';
  const inv = 1 / view.z;
  for (const m of markerEls) {
    m.inner.style.transform = 'scale(' + inv + ')';
    m.label.classList.toggle('faded', view.z < 0.5);
  }
  syncTiles();
  if (typeof adminSync === "function") adminSync();
}

/* ── Painted art tiles ─────────────────────────────────────── */
function styleArt(t) {
  const el = t._el; if (!el) return;
  const f = (t.feather != null ? t.feather : 160);
  const e = t.edges || 'trbl';
  el.style.cssText =
    'left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px;' +
    'background-image:url("' + t.src + '");' +
    'background-size:' + (t.fit || 'cover') + ';' +
    (t.filter ? 'filter:' + t.filter + ';' : '') +
    (t.blend ? 'mix-blend-mode:' + t.blend + ';' : '') +
    'z-index:' + (t.z || 1) + ';';
  const hMask = 'linear-gradient(to right, ' +
    (e.includes('l') ? 'transparent 0,#000 ' + f + 'px' : '#000 0') + ',' +
    (e.includes('r') ? '#000 calc(100% - ' + f + 'px),transparent 100%' : '#000 100%') + ')';
  const vMask = 'linear-gradient(to bottom, ' +
    (e.includes('t') ? 'transparent 0,#000 ' + f + 'px' : '#000 0') + ',' +
    (e.includes('b') ? '#000 calc(100% - ' + f + 'px),transparent 100%' : '#000 100%') + ')';
  el.style.maskImage = hMask + ',' + vMask;
  el.style.webkitMaskImage = hMask + ',' + vMask;
  el.style.maskComposite = 'intersect';
  el.style.webkitMaskComposite = 'source-in';
  el.classList.add('in');
}

function mountArt() {
  world.querySelectorAll('.art-tile').forEach(e => e.remove());
  ART_TILES.forEach((t, ti) => {
    const el = document.createElement('div');
    el.className = 'art-tile';
    t._el = el;
    styleArt(t);
    el.classList.remove('in');
    el.addEventListener('pointerdown', ev => {
      if (!adminOn) return;
      ev.stopPropagation();
      beginMove('art', ti, ev);
    });
    world.appendChild(el);
    const pre = new Image();
    pre.onload = pre.onerror = () => el.classList.add('in');
    pre.src = t.src;
  });
}

/* ── Markers ───────────────────────────────────────────────── */
const markerEls = [];
function locState(loc) {
  if (loc.state === 'sealed') return 'sealed';
  const open = loc.issues.filter(i => !i.locked);
  return open.every(i => Store.isRead(loc.id + ':' + i.no)) ? 'read' : 'unread';
}
function unreadCount(loc) {
  return loc.issues.filter(i => !i.locked && !Store.isRead(loc.id + ':' + i.no)).length;
}

function buildMarkers() {
  world.querySelectorAll('.marker').forEach(e => e.remove());
  markerEls.length = 0;
  LOCATIONS.forEach((loc, li) => {
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = loc.x + 'px';
    m.style.top = loc.y + 'px';

    const inner = document.createElement('div');
    inner.className = 'marker-inner';

    const hit = document.createElement('button');
    hit.className = 'marker-hit';
    hit.setAttribute('aria-label', loc.name + ' — ' + loc.region);
    hit.innerHTML =
      '<span class="sigil"><span class="sigil-ring"></span><span class="plate">' +
      (loc.icon
        ? '<img alt="" src="' + loc.icon + '">'
        : '<svg class="gly" viewBox="0 0 24 24"><path d="' +
          (GLYPHS[loc.glyph] || GLYPHS.sigil) + '"/></svg>') +
      '</span></span>';

    const label = document.createElement('div');
    label.className = 'marker-label';

    inner.appendChild(hit); inner.appendChild(label);
    m.appendChild(inner); world.appendChild(m);
    loc._el = m;

    const rec = { el: m, inner, label, hit, loc };
    markerEls.push(rec);

    if (FINE) {
      hit.addEventListener('pointerenter', () => { if (!adminOn) openBrief(loc); });
      hit.addEventListener('pointerleave', () => { if (!adminOn) scheduleCloseBrief(); });
      hit.addEventListener('focus', () => { if (!adminOn) openBrief(loc); });
    }
    hit.addEventListener('pointerdown', ev => {
      if (!adminOn) return;
      ev.stopPropagation();
      beginMove('pin', li, ev);
    });
    hit.addEventListener('click', ev => {
      ev.stopPropagation();
      if (dragMoved || adminOn) return;
      if (loc.state === 'sealed') { openBrief(loc); return; }
      if (FINE) openReader(loc, 0); else openBrief(loc);
    });
    refreshMarker(rec);
  });
}
function refreshMarker(rec) {
  const st = locState(rec.loc);
  rec.el.dataset.state = st;
  const n = unreadCount(rec.loc);
  rec.label.innerHTML = escapeHtml(rec.loc.name) +
    (rec.loc.state === 'sealed'
      ? '<span class="issue-pip">SEALED</span>'
      : n > 0 ? '<span class="issue-pip">' + n + ' NEW</span>' : '<span class="issue-pip">READ</span>');
}
const refreshAllMarkers = () => markerEls.forEach(refreshMarker);

/* ── Brief modal ───────────────────────────────────────────── */
let briefLoc = null, closeTimer = null;
function openBrief(loc) {
  clearTimeout(closeTimer);
  briefLoc = loc;
  $('#briefRegion').textContent = loc.region;
  $('#briefTitle').textContent = loc.name;
  $('#briefSub').textContent = loc.issues.length + (loc.issues.length === 1 ? ' issue' : ' issues') +
    (loc.meta && loc.meta.era ? ' · ' + loc.meta.era : '');
  $('#briefBody').innerHTML = loc.brief;

  const rewards = loc.issues.filter(i => i.reward).length;
  const meta = [];
  if (loc.meta && loc.meta.pov) meta.push(['Recorded by', loc.meta.pov, '']);
  meta.push(['Issues', String(loc.issues.length), '']);
  if (rewards) meta.push(['Rewards', rewards + ' redeemable', 'reward']);
  $('#briefMeta').innerHTML = meta.map(m =>
    '<div class="meta-cell"><span class="meta-k">' + escapeHtml(m[0]) + '</span>' +
    '<span class="meta-v ' + m[2] + '">' + escapeHtml(m[1]) + '</span></div>').join('');

  const cta = $('#briefCta');
  if (loc.state === 'sealed') {
    cta.textContent = 'Sealed by order';
    cta.classList.add('sealed'); cta.disabled = true;
    $('#briefHint').textContent = 'Recovery pending';
  } else {
    cta.textContent = 'Read the issue';
    cta.classList.remove('sealed'); cta.disabled = false;
    $('#briefHint').textContent = FINE ? 'Click the seal to open' : 'Tap to open';
  }
  veil.classList.add('on');
  briefEl.classList.add('on');
}
function scheduleCloseBrief() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeBrief, 220);
}
function closeBrief() {
  clearTimeout(closeTimer);
  veil.classList.remove('on');
  briefEl.classList.remove('on');
  briefLoc = null;
}
briefEl.addEventListener('pointerenter', () => clearTimeout(closeTimer));
briefEl.addEventListener('pointerleave', () => { if (FINE) scheduleCloseBrief(); });
$('#briefCta').addEventListener('click', () => { if (briefLoc && briefLoc.state !== 'sealed') openReader(briefLoc, 0); });
stage.addEventListener('pointerdown', () => { if (!FINE) closeBrief(); });

/* ── Pan & zoom ────────────────────────────────────────────── */
let dragging = false, dragMoved = false, last = null;
const pointers = new Map();
let pinch0 = 0, pinchZ = 1;

stage.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragging = true; dragMoved = false;
    last = { x: e.clientX, y: e.clientY };
    stage.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
  } else if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinch0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    pinchZ = view.z;
  }
});
stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
    zoomAt(mx, my, Math.max(MINZ, Math.min(MAXZ, pinchZ * (d / pinch0))));
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - last.x, dy = e.clientY - last.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) { dragMoved = true; if (FINE) closeBrief(); }
  view.x += dx; view.y += dy;
  last = { x: e.clientX, y: e.clientY };
  apply();
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) { dragging = false; stage.classList.remove('dragging'); setTimeout(() => { dragMoved = false; }, 30); }
};
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

function zoomAt(cx, cy, nz) {
  const wx = (cx - view.x) / view.z, wy = (cy - view.y) / view.z;
  view.z = nz;
  view.x = cx - wx * view.z;
  view.y = cy - wy * view.z;
  apply();
}
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * 0.0016);
  zoomAt(e.clientX, e.clientY, Math.max(MINZ, Math.min(MAXZ, view.z * f)));
}, { passive: false });

$('#zIn').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, Math.min(MAXZ, view.z * 1.35)));
$('#zOut').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, Math.max(MINZ, view.z / 1.35)));
$('#zHome').addEventListener('click', () => centerOn(CONFIG.start.x, CONFIG.start.y, CONFIG.start.z));

/* ── Coordinate readout — press ` to place new markers ─────── */
let coordBox = null;
addEventListener('keydown', e => {
  if (e.key !== '`') return;
  if (coordBox) { coordBox.remove(); coordBox = null; return; }
  coordBox = document.createElement('div');
  coordBox.style.cssText = 'position:fixed;z-index:90;left:50%;bottom:76px;transform:translateX(-50%);' +
    'padding:8px 14px;background:#0D1114;border:1px solid #C4923A;font-family:var(--mono);' +
    'font-size:11px;letter-spacing:.1em;color:#C4923A;pointer-events:none';
  document.body.appendChild(coordBox);
});
stage.addEventListener('pointermove', e => {
  if (!coordBox) return;
  const wx = Math.round((e.clientX - view.x) / view.z);
  const wy = Math.round((e.clientY - view.y) / view.z);
  coordBox.textContent = 'x: ' + wx + '   y: ' + wy;
});

/* ── Toast ─────────────────────────────────────────────────── */
let toastT;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), 2400);
}

/* ── Grain + drifting ash ──────────────────────────────────── */
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const x = c.getContext('2d'), d = x.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  $('#grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
})();

(function ash() {
  const cv = $('#ashfall'), ctx = cv.getContext('2d');
  let parts = [], w = 0, h = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() {
    w = cv.width = innerWidth; h = cv.height = innerHeight;
    parts = Array.from({ length: Math.min(70, Math.round(w / 22)) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.5 + 0.4,
      s: Math.random() * 0.28 + 0.07,
      d: Math.random() * 0.5 - 0.25,
      o: Math.random() * 0.4 + 0.1,
      e: Math.random() < 0.1
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y += p.s; p.x += p.d + Math.sin(p.y * 0.008) * 0.15;
      if (p.y > h + 4) { p.y = -4; p.x = Math.random() * w; }
      if (p.x < -4) p.x = w + 4; if (p.x > w + 4) p.x = -4;
      ctx.beginPath();
      ctx.fillStyle = p.e ? 'rgba(255,193,94,' + p.o + ')' : 'rgba(150,168,152,' + p.o * 0.42 + ')';
      ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  size(); addEventListener('resize', size);
  if (!reduce) tick();
})();

/* ── Boot ──────────────────────────────────────────────────── */
applyTheme();
mountArt();
buildMarkers();
centerOn(CONFIG.start.x, CONFIG.start.y, CONFIG.start.z);
addEventListener('resize', apply);
requestAnimationFrame(pumpTiles);
