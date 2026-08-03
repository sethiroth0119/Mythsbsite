/* Cartographer — the admin editor. Open the map with #admin on the URL.
   Loaded last so it can rebuild whatever map.js has already drawn. */
"use strict";

/* ═══════════════ CARTOGRAPHER (admin mode) ═════════════════
   Open your map with #admin on the end of the URL:
     yoursite.com/story-map.html#admin
   Edits autosave to this browser as a draft. When you're happy,
   hit "Export to file" and paste the block into the EDIT ZONE.
   ═════════════════════════════════════════════════════════════ */

const DRAFT_KEY = 'ashfall.storymap.draft';
var adminOn = false, placing = false;
let sel = null;                    // {type:'art'|'pin', i}
let selBox = null, selGrip = null;

const uid = p => p + '-' + Math.random().toString(36).slice(2, 7);

function draftSave() {
  if (!adminOn) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      art: ART_TILES.map(stripArt),
      locs: LOCATIONS.map(stripLoc),
      theme: THEME
    }));
  } catch (e) { toast('Draft too large to autosave — export it'); }
}
const stripArt = t => { const o = {}; for (const k in t) if (k[0] !== '_') o[k] = t[k]; return o; };
const stripLoc = l => { const o = {}; for (const k in l) if (k[0] !== '_') o[k] = l[k]; return o; };

function draftLoad() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.art) { ART_TILES.length = 0; d.art.forEach(t => ART_TILES.push(t)); }
    if (d.locs) { LOCATIONS.length = 0; d.locs.forEach(l => LOCATIONS.push(l)); }
    if (d.theme) Object.assign(THEME, d.theme);
    return true;
  } catch (e) { return false; }
}

function rebuild() {
  mountArt();
  buildMarkers();
  apply();
  renderDock();
  draftSave();
}

/* ── Selection ─────────────────────────────────────────────── */
function select(type, i) {
  sel = (type == null) ? null : { type, i };
  renderDock();
  adminSync();
}
function adminSync() {
  if (!adminOn) return;
  if (!selBox) {
    selBox = document.createElement('div');
    selBox.className = 'sel-box';
    selGrip = document.createElement('div');
    selGrip.className = 'sel-grip';
    selBox.appendChild(selGrip);
    world.appendChild(selBox);
    selGrip.addEventListener('pointerdown', startResize);
  }
  if (!sel) { selBox.style.display = 'none'; return; }
  const inv = 1 / view.z;
  selGrip.style.transform = 'scale(' + inv + ')';
  selGrip.style.transformOrigin = '100% 100%';
  if (sel.type === 'art') {
    const t = ART_TILES[sel.i];
    if (!t) { selBox.style.display = 'none'; return; }
    selBox.style.cssText = 'display:block;left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px';
    selGrip.style.display = 'block';
  } else {
    const l = LOCATIONS[sel.i];
    if (!l) { selBox.style.display = 'none'; return; }
    const r = 34 * inv;
    selBox.style.cssText = 'display:block;left:' + (l.x - r) + 'px;top:' + (l.y - r) + 'px;width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;border-radius:50%';
    selGrip.style.display = 'none';
  }
  selBox.appendChild(selGrip);
}

/* ── Dragging & resizing on the map ────────────────────────── */
let drag = null;
function worldPt(e) {
  return { x: (e.clientX - view.x) / view.z, y: (e.clientY - view.y) / view.z };
}
function startResize(e) {
  if (!sel || sel.type !== 'art') return;
  e.stopPropagation(); e.preventDefault();
  const t = ART_TILES[sel.i], p = worldPt(e);
  drag = { mode: 'resize', ox: p.x, oy: p.y, w: t.w, h: t.h, ratio: t.w / t.h, shift: false };
  selGrip.setPointerCapture(e.pointerId);
}
addEventListener('pointermove', e => {
  if (!drag) return;
  const p = worldPt(e);
  if (drag.mode === 'resize') {
    const t = ART_TILES[sel.i];
    let w = Math.max(64, drag.w + (p.x - drag.ox));
    let h = Math.max(64, drag.h + (p.y - drag.oy));
    if (!e.shiftKey) h = Math.round(w / drag.ratio);   // hold Shift to free-stretch
    t.w = Math.round(w); t.h = Math.round(h);
    if (t._el) { t._el.style.width = t.w + 'px'; t._el.style.height = t.h + 'px'; }
    adminSync(); renderInspector();
  } else if (drag.mode === 'move') {
    const dx = p.x - drag.ox, dy = p.y - drag.oy;
    if (drag.type === 'art') {
      const t = ART_TILES[drag.i];
      t.x = Math.round(drag.sx + dx); t.y = Math.round(drag.sy + dy);
      if (t._el) { t._el.style.left = t.x + 'px'; t._el.style.top = t.y + 'px'; }
    } else {
      const l = LOCATIONS[drag.i];
      l.x = Math.round(drag.sx + dx); l.y = Math.round(drag.sy + dy);
      if (l._el) { l._el.style.left = l.x + 'px'; l._el.style.top = l.y + 'px'; }
    }
    adminSync(); renderInspector();
  }
});
addEventListener('pointerup', () => { if (drag) { drag = null; draftSave(); } });

function beginMove(type, i, e) {
  const p = worldPt(e);
  const o = type === 'art' ? ART_TILES[i] : LOCATIONS[i];
  drag = { mode: 'move', type, i, ox: p.x, oy: p.y, sx: o.x, sy: o.y };
  select(type, i);
}

/* ── Placing new pins ──────────────────────────────────────── */
stage.addEventListener('click', e => {
  if (!adminOn || !placing || dragMoved) return;
  const p = worldPt(e);
  LOCATIONS.push({
    id: uid('loc'), name: 'New site', region: 'Unfiled',
    x: Math.round(p.x), y: Math.round(p.y), state: 'open',
    brief: 'Write the hover brief here. <em>Italics</em> work.',
    meta: { era: '', pov: '' },
    issues: []
  });
  placing = false;
  document.body.classList.remove('placing');
  rebuild();
  select('pin', LOCATIONS.length - 1);
});

/* ── Dropping images ───────────────────────────────────────── */
function readImage(file) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => res({ data: fr.result, w: img.naturalWidth, h: img.naturalHeight, name: file.name });
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function placeImages(files, wx, wy) {
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    const im = await readImage(f);
    const scale = Math.min(1, 2048 / Math.max(im.w, im.h));
    const w = Math.round(im.w * scale), h = Math.round(im.h * scale);
    ART_TILES.push({
      src: im.data, file: im.name,
      x: Math.round(wx - w / 2), y: Math.round(wy - h / 2),
      w, h, feather: 160, edges: 'trbl', fit: 'cover', z: 1
    });
  }
  rebuild();
  select('art', ART_TILES.length - 1);
  toast('Image placed — drag to position');
}
['dragenter', 'dragover'].forEach(ev => stage.addEventListener(ev, e => {
  if (!adminOn) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
}));
stage.addEventListener('drop', e => {
  if (!adminOn) return;
  e.preventDefault();
  const p = worldPt(e);
  placeImages(e.dataTransfer.files, p.x, p.y);
});

/* ── Dock ──────────────────────────────────────────────────── */
function renderDock() {
  if (!adminOn) return;
  const layers = [
    ...ART_TILES.map((t, i) => ({ type: 'art', i, tag: 'IMG', nm: t.file || t.src.slice(0, 28) })),
    ...LOCATIONS.map((l, i) => ({ type: 'pin', i, tag: 'PIN', nm: l.name }))
  ];
  $('#layerList').innerHTML = layers.map(L =>
    '<button class="layer' + (sel && sel.type === L.type && sel.i === L.i ? ' on' : '') +
    '" data-t="' + L.type + '" data-i="' + L.i + '">' +
    '<span class="tag">' + L.tag + '</span><span class="nm">' + escapeHtml(L.nm) + '</span></button>'
  ).join('') || '<p class="f-note">Nothing placed yet.</p>';
  renderInspector();
}

function field(label, val, oninput, opts) {
  opts = opts || {};
  const id = uid('f');
  const el = document.createElement('div');
  el.className = 'f-row';
  const tag = opts.area ? 'textarea' : 'input';
  el.innerHTML = '<label for="' + id + '">' + escapeHtml(label) + '</label>' +
    (opts.select
      ? '<select id="' + id + '">' + opts.select.map(o =>
        '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>'
      : '<' + tag + ' id="' + id + '"' + (opts.area ? '' : ' type="' + (opts.num ? 'number' : 'text') + '"') + '>' +
      (opts.area ? escapeHtml(val == null ? '' : val) + '</textarea>' : ''));
  const input = el.querySelector('input,textarea,select');
  if (input.tagName !== 'TEXTAREA') input.value = val == null ? '' : val;
  input.addEventListener('input', () => { oninput(opts.num ? +input.value : input.value); draftSave(); });
  return el;
}

function renderInspector() {
  const box = $('#inspector');
  if (!box) return;
  box.innerHTML = '';
  if (!sel) { box.innerHTML = '<p class="f-note">Select a layer, or click the map in Add-pin mode.</p>'; return; }

  if (sel.type === 'art') {
    const t = ART_TILES[sel.i];
    if (!t) return;
    box.appendChild(field('Image path (for export)', t.file || '', v => { t.file = v; renderDock(); }));
    const two = document.createElement('div'); two.className = 'f-two';
    two.appendChild(field('X', t.x, v => { t.x = v; t._el.style.left = v + 'px'; adminSync(); }, { num: 1 }));
    two.appendChild(field('Y', t.y, v => { t.y = v; t._el.style.top = v + 'px'; adminSync(); }, { num: 1 }));
    box.appendChild(two);
    const two2 = document.createElement('div'); two2.className = 'f-two';
    two2.appendChild(field('Width', t.w, v => { t.w = v; t._el.style.width = v + 'px'; adminSync(); }, { num: 1 }));
    two2.appendChild(field('Height', t.h, v => { t.h = v; t._el.style.height = v + 'px'; adminSync(); }, { num: 1 }));
    box.appendChild(two2);
    box.appendChild(field('Feather (px)', t.feather, v => { t.feather = v; styleArt(t); }, { num: 1 }));
    box.appendChild(field('Feathered edges', t.edges || 'trbl', v => { t.edges = v; styleArt(t); }));
    box.insertAdjacentHTML('beforeend', '<p class="f-note">t r b l — drop a letter to keep that side hard where two images meet.</p>');
    box.appendChild(field('Fit', t.fit || 'cover', v => { t.fit = v; styleArt(t); }, { select: ['cover', 'contain', '100% 100%'] }));
    box.appendChild(field('CSS filter', t.filter || '', v => { t.filter = v; styleArt(t); }));
    box.insertAdjacentHTML('beforeend', '<p class="f-note">e.g. saturate(.85) brightness(.95) — colour-match to neighbours.</p>');
    box.appendChild(field('Layer order (z)', t.z || 1, v => { t.z = v; styleArt(t); }, { num: 1 }));
    const del = document.createElement('button');
    del.className = 'a-btn danger'; del.style.width = '100%'; del.textContent = 'Delete image';
    del.onclick = () => { ART_TILES.splice(sel.i, 1); sel = null; rebuild(); };
    box.appendChild(del);
    return;
  }

  const l = LOCATIONS[sel.i];
  if (!l) return;
  box.appendChild(field('Name', l.name, v => { l.name = v; refreshAllMarkers(); renderDock(); }));
  box.appendChild(field('Region label', l.region, v => { l.region = v; }));
  const two = document.createElement('div'); two.className = 'f-two';
  two.appendChild(field('X', l.x, v => { l.x = v; l._el.style.left = v + 'px'; adminSync(); }, { num: 1 }));
  two.appendChild(field('Y', l.y, v => { l.y = v; l._el.style.top = v + 'px'; adminSync(); }, { num: 1 }));
  box.appendChild(two);
  box.appendChild(field('State', l.state, v => { l.state = v; refreshAllMarkers(); }, { select: ['open', 'sealed'] }));
  box.appendChild(field('Hover brief (HTML ok)', l.brief, v => { l.brief = v; }, { area: 1 }));
  const m2 = document.createElement('div'); m2.className = 'f-two';
  m2.appendChild(field('Era', (l.meta || {}).era || '', v => { (l.meta = l.meta || {}).era = v; }));
  m2.appendChild(field('Recorded by', (l.meta || {}).pov || '', v => { (l.meta = l.meta || {}).pov = v; }));
  box.appendChild(m2);

  /* custom pin artwork */
  const icoWrap = document.createElement('div');
  icoWrap.className = 'f-row';
  icoWrap.innerHTML = '<label>Pin artwork</label>';
  const icoBtn = document.createElement('div');
  icoBtn.className = 'a-drop';
  icoBtn.textContent = l.icon ? 'Replace pin image' : 'Upload a pin image';
  icoBtn.onclick = () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*';
    fi.onchange = async () => {
      if (!fi.files[0]) return;
      const im = await readImage(fi.files[0]);
      l.icon = im.data; l.iconFile = im.name;
      rebuild(); select('pin', sel.i);
    };
    fi.click();
  };
  icoWrap.appendChild(icoBtn);
  if (l.icon) {
    const rm = document.createElement('button');
    rm.className = 'a-btn'; rm.style.cssText = 'width:100%;margin-top:6px';
    rm.textContent = 'Use default seal';
    rm.onclick = () => { delete l.icon; delete l.iconFile; rebuild(); select('pin', sel.i); };
    icoWrap.appendChild(rm);
  }
  box.appendChild(icoWrap);
  if (l.icon) box.appendChild(field('Pin image path (for export)', l.iconFile || '', v => { l.iconFile = v; }));
  if (!l.icon) {
    const gw = document.createElement('div');
    gw.className = 'f-row';
    gw.innerHTML = '<label>Glyph</label>';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:5px';
    Object.keys(GLYPHS).forEach(g => {
      const b = document.createElement('button');
      b.title = g;
      b.style.cssText = 'aspect-ratio:1;display:grid;place-items:center;border:1px solid ' +
        ((l.glyph || 'sigil') === g ? 'var(--ember)' : 'rgba(223,228,222,.14)') +
        ';background:' + ((l.glyph || 'sigil') === g ? 'rgba(255,193,94,.1)' : 'transparent') + ';';
      b.innerHTML = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:' +
        ((l.glyph || 'sigil') === g ? 'var(--ember)' : 'var(--bone-faint)') +
        ';stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="' + GLYPHS[g] + '"/></svg>';
      b.onclick = () => { l.glyph = g; rebuild(); select('pin', sel.i); };
      grid.appendChild(b);
    });
    gw.appendChild(grid);
    box.appendChild(gw);
  }

  /* issues */
  const ih = document.createElement('h3');
  ih.textContent = 'Issues';
  ih.style.cssText = 'font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ember);margin:18px 0 9px';
  box.appendChild(ih);
  (l.issues || []).forEach((iss, ii) => {
    const c = document.createElement('div');
    c.className = 'iss-card';
    const hd = document.createElement('div'); hd.className = 'hd';
    hd.innerHTML = '<span class="t">' + escapeHtml(iss.no + ' · ' + iss.title) + '</span>';
    const rmb = document.createElement('button');
    rmb.className = 'mini'; rmb.textContent = 'REMOVE';
    rmb.onclick = () => { l.issues.splice(ii, 1); rebuild(); select('pin', sel.i); };
    hd.appendChild(rmb);
    c.appendChild(hd);
    const nt = document.createElement('div'); nt.className = 'f-two';
    nt.appendChild(field('No.', iss.no, v => { iss.no = v; }));
    nt.appendChild(field('Title', iss.title, v => { iss.title = v; }));
    c.appendChild(nt);
    c.appendChild(field('Blurb', iss.blurb || '', v => { iss.blurb = v; }));
    c.appendChild(field('Page image URLs (one per line)',
      (iss.pages || []).filter(p => typeof p === 'string').join('\n'),
      v => { iss.pages = v.split('\n').map(s => s.trim()).filter(Boolean); }, { area: 1 }));
    const rw = iss.reward || {};
    c.appendChild(field('Reward code (blank = no reward)', rw.code || '', v => {
      if (!v) { delete iss.reward; return; }
      iss.reward = iss.reward || {}; iss.reward.code = v;
    }));
    c.appendChild(field('Reward name', rw.title || '', v => { (iss.reward = iss.reward || {}).title = v; }));
    c.appendChild(field('Reward description', rw.desc || '', v => { (iss.reward = iss.reward || {}).desc = v; }, { area: 1 }));
    c.appendChild(field('Reward fine print', rw.note || '', v => { (iss.reward = iss.reward || {}).note = v; }));
    box.appendChild(c);
  });
  const addI = document.createElement('button');
  addI.className = 'a-btn'; addI.style.width = '100%'; addI.textContent = '+ Add issue';
  addI.onclick = () => {
    l.issues = l.issues || [];
    l.issues.push({ no: roman(l.issues.length + 1), title: 'Untitled issue', blurb: '', pages: [] });
    rebuild(); select('pin', sel.i);
  };
  box.appendChild(addI);

  const del = document.createElement('button');
  del.className = 'a-btn danger'; del.style.cssText = 'width:100%;margin-top:10px';
  del.textContent = 'Delete pin';
  del.onclick = () => { LOCATIONS.splice(sel.i, 1); sel = null; rebuild(); };
  box.appendChild(del);
}
function roman(n) {
  const m = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return m[n] || String(n);
}

/* ── Export ────────────────────────────────────────────────── */
function exportText(embed) {
  const cleanArt = ART_TILES.map(t => {
    const o = stripArt(t);
    if (!embed && /^data:/.test(o.src)) o.src = 'art/' + (o.file || 'image.png');
    delete o.file;
    return o;
  });
  const cleanLocs = LOCATIONS.map(l => {
    const o = JSON.parse(JSON.stringify(stripLoc(l)));
    if (o.icon && !embed && /^data:/.test(o.icon)) o.icon = 'art/pins/' + (o.iconFile || 'pin.png');
    delete o.iconFile;
    return o;
  });
  return '/* Generated by Cartographer — paste over the matching blocks in data/content.js */\n\n' +
    'const THEME = ' + JSON.stringify(THEME, null, 2) + ';\n\n' +
    'const ART_TILES = ' + JSON.stringify(cleanArt, null, 2) + ';\n\n' +
    'const LOCATIONS = ' + JSON.stringify(cleanLocs, null, 2) + ';\n';
}
function openExport() {
  const embed = $('#embedChk').checked;
  $('#exportBox').value = exportText(embed);
  $('#exportModal').classList.add('on');
  const files = [
    ...ART_TILES.filter(t => /^data:/.test(t.src)).map(t => 'art/' + (t.file || 'image.png')),
    ...LOCATIONS.filter(l => l.icon && /^data:/.test(l.icon)).map(l => 'art/pins/' + (l.iconFile || 'pin.png'))
  ];
  $('#exportNote').textContent = embed
    ? 'Images are embedded as data — the file will be large but needs no uploads.'
    : (files.length ? 'Add these files to the project so the paths resolve: ' + files.join(', ')
      : 'No uploaded images to worry about.');
}

/* ── Boot admin ────────────────────────────────────────────── */
function initAdmin() {
  if (adminOn) return;                 // already booted
  // Admin is gated to the site admin email (Supabase session). The
  // lore-auth script in index.html sets window.__LORE_ADMIN_OK and shows an
  // "Edit map" button only for richaegisop@gmail.com. Local/offline dev can
  // still force it with #admin on the URL.
  if (!window.__LORE_ADMIN_OK && !/admin/i.test(location.hash)) return;
  adminOn = true;
  document.body.classList.add('admin');
  const hadDraft = draftLoad();

  const dock = document.createElement('aside');
  dock.id = 'dock';
  dock.innerHTML =
    '<div class="dock-head"><h2>Cartographer</h2><p>Admin · edits autosave to this browser</p></div>' +
    '<div class="dock-body">' +
    '<div class="a-sec"><h3>Place</h3>' +
    '<div class="a-row"><button class="a-btn" id="pinMode">Add pin</button>' +
    '<button class="a-btn" id="imgBtn">Add image</button></div>' +
    '<div class="a-drop" id="dropHint" style="margin-top:7px">or drag image files<br>straight onto the map</div></div>' +
    '<div class="a-sec"><h3>Layers</h3><div id="layerList"></div></div>' +
    '<div class="a-sec"><h3>Selected</h3><div id="inspector"></div></div>' +
    '<div class="a-sec"><h3>Brand</h3>' +
    '<div id="themeFields"></div></div>' +
    '</div>' +
    '<div class="dock-foot">' +
    '<button class="a-btn" id="exportBtn">Export to file</button>' +
    '<button class="a-btn" id="jsonBtn">Download JSON</button>' +
    '<label class="a-btn" style="grid-column:1/-1;display:flex;gap:8px;align-items:center;justify-content:center;cursor:pointer">' +
    '<input type="checkbox" id="embedChk" style="accent-color:#C4923A"> Embed images in export</label>' +
    '<button class="a-btn danger" style="grid-column:1/-1" id="discardBtn">Discard local draft</button>' +
    '</div>';
  document.body.appendChild(dock);

  const hint = document.createElement('div');
  hint.id = 'adminHint';
  hint.textContent = 'Click the map to drop a pin — Esc to cancel';
  document.body.appendChild(hint);

  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.innerHTML =
    '<div class="ex-plate"><h3>Export</h3>' +
    '<p id="exportNote"></p>' +
    '<textarea id="exportBox" spellcheck="false" readonly></textarea>' +
    '<div class="ex-actions"><button class="a-btn" id="copyExport">Copy</button>' +
    '<button class="a-btn" id="closeExport">Close</button></div></div>';
  document.body.appendChild(modal);

  /* theme fields */
  const tf = $('#themeFields');
  [['ember', 'Accent / ember'], ['brass', 'Metal / brass'], ['bone', 'Text'],
  ['void', 'Background'], ['soot', 'Panels']].forEach(([k, label]) => {
    const row = document.createElement('div');
    row.className = 'f-row';
    row.innerHTML = '<label>' + label + '</label>';
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = THEME[k];
    inp.style.cssText = 'height:34px;padding:2px;cursor:pointer';
    inp.addEventListener('input', () => { THEME[k] = inp.value; applyTheme(); draftSave(); });
    row.appendChild(inp);
    tf.appendChild(row);
  });


  $('#pinMode').onclick = e => {
    placing = !placing;
    document.body.classList.toggle('placing', placing);
    e.target.classList.toggle('on', placing);
  };
  $('#imgBtn').onclick = $('#dropHint').onclick = () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = true;
    fi.onchange = () => {
      const c = { x: (innerWidth / 2 - view.x) / view.z, y: (innerHeight / 2 - view.y) / view.z };
      placeImages(fi.files, c.x, c.y);
    };
    fi.click();
  };
  $('#layerList').addEventListener('click', e => {
    const b = e.target.closest('.layer'); if (!b) return;
    select(b.dataset.t, +b.dataset.i);
    const o = b.dataset.t === 'art' ? ART_TILES[+b.dataset.i] : LOCATIONS[+b.dataset.i];
    centerOn(o.x + (o.w || 0) / 2, o.y + (o.h || 0) / 2);
  });
  $('#exportBtn').onclick = openExport;
  $('#closeExport').onclick = () => $('#exportModal').classList.remove('on');
  $('#copyExport').onclick = async () => {
    try { await navigator.clipboard.writeText($('#exportBox').value); toast('Export copied'); } catch (e) {}
  };
  $('#jsonBtn').onclick = () => {
    const blob = new Blob([JSON.stringify({ theme: THEME, art: ART_TILES.map(stripArt), locations: LOCATIONS.map(stripLoc) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'story-map-data.json'; a.click();
  };
  $('#discardBtn').onclick = () => {
    if (!confirm('Discard your local draft and reload the version saved in the file?')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    location.reload();
  };
  addEventListener('keydown', e => {
    if (!adminOn) return;
    if (e.key === 'Escape' && placing) {
      placing = false;
      document.body.classList.remove('placing');
      $('#pinMode').classList.remove('on');
    }
    if (e.key === 'Delete' && sel && document.activeElement === document.body) {
      if (sel.type === 'art') ART_TILES.splice(sel.i, 1); else LOCATIONS.splice(sel.i, 1);
      sel = null; rebuild();
    }
  });

  rebuild();
  if (hadDraft) toast('Local draft loaded');
}
initAdmin();
