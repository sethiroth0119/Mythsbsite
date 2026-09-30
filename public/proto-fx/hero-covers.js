/* proto-fx piece: hero-covers — the prototype's floating cover fan, on the real hero.
   Fills [data-pfx-slot="hero-covers"] with the site's real featured cards
   (MSBridge.cards run through MSBridge.applyOverride, so admin art edits show here too;
   the four most portrait-shaped are used, so landscape art is not cropped into a dark frame).
   At rest each cover bobs slowly in a slight fan; on hover it lifts, scales ~1.06 and
   tilts toward the cursor (up to 12deg), a specular sweep crosses the art, a gold glow
   blooms behind it and the neighbouring covers ease away. Click / Enter opens the card:
   a cancelable window 'pfx:inspect' event lets the inspector piece take over; otherwise
   the real CardModal opens through MSBridge.openCard(card).
   Layout is measured from the real hero (see hero-covers.css for the three modes). */
(function () {
  if (!window.ProtoFx) return;

  var MAX_TILT = 12;       // deg, toward the cursor
  var LIFT = 22;           // px the hovered cover rises
  var SCALE = 1.06;        // hovered cover scale
  var PUSH = 16;           // px neighbours ease away (halves with each step of distance)
  var EASE = 0.2;          // per-frame approach: the soft follow of the prototype's WebGL covers

  function reduced() {
    if (ProtoFx.reduced) return true;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ---------- featured cards: real bridge data, most portrait art first ---------- */
  var sizeCache = {};
  function measure(src) {
    if (sizeCache[src]) return sizeCache[src];
    var p = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); };
      im.onerror = function () { res(null); };
      im.decoding = 'async';
      im.src = src;
    });
    sizeCache[src] = p;
    return p;
  }
  function candidates(b) {
    var list = (b && b.cards) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      try { c = b.applyOverride ? b.applyOverride(c) : c; } catch (e) {}
      if (c && c.image) out.push(c);
    }
    return out;
  }
  function pick(cards) {
    return Promise.all(cards.map(function (c) { return measure(c.image); })).then(function (sizes) {
      var rows = cards.map(function (c, i) { var s = sizes[i]; return { c: c, i: i, s: s, a: s ? s.h / s.w : 0 }; })
        .filter(function (r) { return r.s; });
      var best = rows.slice().sort(function (x, y) { return (y.a - x.a) || (x.i - y.i); }).slice(0, 4);
      best.sort(function (x, y) { return x.i - y.i; });          // keep the site's own order
      return best;
    });
  }
  function keyOf(cards) { return cards.map(function (c) { return c.name + '|' + c.image; }).join('~'); }

  function openCard(card, el) {
    var ev = null;
    try {
      ev = new CustomEvent('pfx:inspect', { cancelable: true, detail: { card: card, source: el, from: 'hero-covers' } });
      window.dispatchEvent(ev);
    } catch (e) {}
    if (ev && ev.defaultPrevented) return;
    var b = ProtoFx.bridge();
    if (b && b.openCard) b.openCard(card);
  }

  /* ---------- DOM ---------- */
  function build(slot, rows, key) {
    var wrap = document.createElement('div');
    wrap.className = 'pfxhc';
    wrap.setAttribute('data-pfx-owned', 'hero-covers');
    wrap.setAttribute('data-key', key);

    var row = document.createElement('div');
    row.className = 'pfxhc-row';
    row.setAttribute('role', 'list');
    row.setAttribute('aria-label', 'Featured cards');
    wrap.appendChild(row);

    var states = [];
    rows.forEach(function (r, i) {
      var card = r.c;
      var item = document.createElement('div');
      item.className = 'pfxhc-item';
      if (r.a < 0.95) item.classList.add('is-contain');        // landscape art: whole picture on a blurred matte
      if (card.fullCard) item.classList.add('is-full');         // full card render carries its own nameplate
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-i', String(i));
      item.style.setProperty('--i', i);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pfxhc-cover';
      btn.setAttribute('data-card-name', card.name);
      btn.setAttribute('aria-label', 'Inspect ' + card.name);
      btn.innerHTML =
        '<span class="pfxhc-float">' +
          '<span class="pfxhc-glow" aria-hidden="true"></span>' +
          '<span class="pfxhc-card">' +
            '<span class="pfxhc-frame">' +
              '<span class="pfxhc-matte" aria-hidden="true"></span>' +
              '<img alt="" decoding="async" draggable="false">' +
              '<span class="pfxhc-plate" aria-hidden="true"></span>' +
              '<span class="pfxhc-light" aria-hidden="true"></span>' +
              '<span class="pfxhc-sheen" aria-hidden="true"></span>' +
            '</span>' +
          '</span>' +
        '</span>';
      var img = btn.querySelector('img');
      img.alt = card.name;
      img.src = card.image;
      btn.querySelector('.pfxhc-plate').textContent = card.name;
      btn.querySelector('.pfxhc-matte').style.backgroundImage = 'url("' + String(card.image).replace(/"/g, '\\"') + '")';
      btn.addEventListener('click', function () { openCard(card, btn); });
      item.appendChild(btn);
      row.appendChild(item);
      states.push({
        item: item, el: btn, card: btn.querySelector('.pfxhc-card'),
        rx: 0, ry: 0, lift: 0, s: 1, push: 0,
        trx: 0, try_: 0, tlift: 0, ts: 1, tpush: 0
      });
    });

    var hint = document.createElement('div');
    hint.className = 'pfxhc-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'HOVER TO REVEAL · CLICK TO INSPECT';
    wrap.appendChild(hint);

    slot.appendChild(wrap);
    wrap._pfxhc = { states: states, side: [] };
    wire(wrap, states);
    layout(slot);
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('is-in'); }); });

    // The fixed hint only shows while the hero is on screen.
    var hero = slot.closest('[data-pfx="hero"]') || slot.parentElement;
    try {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { wrap.classList.toggle('is-onscreen', e.isIntersecting && e.intersectionRatio > 0.45); });
      }, { threshold: [0, 0.45, 0.6, 1] });
      io.observe(hero);
      wrap._pfxhc.io = io;
    } catch (e) { wrap.classList.add('is-onscreen'); }
  }

  /* ---------- layout (measured from the real hero) ---------- */
  function offs(el, root) {
    var t = 0, l = 0, e = el;
    while (e && e !== root) { t += e.offsetTop; l += e.offsetLeft; e = e.offsetParent; }
    return { top: t, left: l, width: el.offsetWidth, height: el.offsetHeight };
  }
  function setVar(el, name, val) { if (el.style.getPropertyValue(name) !== val) el.style.setProperty(name, val); }
  function setAttr(el, name, val) {
    if (val == null) { if (el.hasAttribute(name)) el.removeAttribute(name); }
    else if (el.getAttribute(name) !== val) el.setAttribute(name, val);
  }
  function clearPlace(states) {
    states.forEach(function (s) { ['--x', '--y', '--w', '--r'].forEach(function (n) { s.item.style.removeProperty(n); }); s.item.classList.remove('is-off'); });
  }

  function layout(slot) {
    var wrap = slot.querySelector(':scope > .pfxhc');
    if (!wrap || !wrap._pfxhc) return;
    var states = wrap._pfxhc.states;
    var hero = slot.closest('[data-pfx="hero"]');
    var q = function (r) { return hero && hero.querySelector('[data-pfx-ht="' + r + '"]'); };
    var logo = q('logo'), headline = q('headline'), ctas = q('ctas'), stats = q('stats');
    var W = hero ? hero.clientWidth : 0;
    var mode = 'flow';
    var place = [];      // {x, y, w, r}
    var side = [];       // side of the fan per item (-1 left / 1 right), for the push logic

    if (hero && logo && headline && W >= 1000 && states.length >= 4) {
      // Split: two covers each side of the crest logo, above the headline.
      var L = offs(logo, hero), H = offs(headline, hero);
      var gap = 18, inset = Math.max(28, Math.min(56, W * 0.03)), arc = 16;
      var w = Math.min(182, (L.left - inset - 24 - gap) / 2);
      var topMin = 104;                                   // clears the fixed nav band
      var botMax = H.top - 22 - arc;                      // never reaches the headline (hover lift stays above it too)
      w = Math.min(w, (botMax - topMin) / 1.5);
      if (w >= 116) {
        mode = 'split';
        var h = w * 1.5;
        var cy = L.top + L.height / 2;
        var y = Math.max(topMin, Math.min(botMax - h, cy - h / 2 - arc / 2));
        var il = L.left - inset - w, ol = il - gap - w;
        var ir = L.left + L.width + inset, or_ = ir + w + gap;
        place = [
          { x: ol, y: y + arc, w: w, r: -8 }, { x: il, y: y, w: w, r: -3 },
          { x: ir, y: y, w: w, r: 3 },        { x: or_, y: y + arc, w: w, r: 8 }
        ];
        side = [-1, -1, 1, 1];
      }
    }
    if (mode === 'flow' && hero && ctas && stats) {
      // Row: centred under the CTA row, stats pushed beneath the covers.
      var n = W <= 760 ? 3 : 4;
      var g = W <= 760 ? 10 : 16;
      var rw = Math.min(W <= 760 ? 124 : 168, (W - 32 - g * (n - 1)) / n);
      var rh = rw * 1.5;
      var C = offs(ctas, hero);
      var top = C.top + C.height + (W <= 760 ? 26 : 34);
      var x0 = (W - (n * rw + (n - 1) * g)) / 2;
      var rots = n === 3 ? [-5, 0, 5] : [-6, -2, 2, 6];
      for (var i = 0; i < n; i++) {
        var edge = (i === 0 || i === n - 1) ? 8 : 0;
        place.push({ x: x0 + i * (rw + g), y: top + edge, w: rw, r: rots[i] });
        side.push(0);
      }
      mode = 'row';
      var push = Math.round(top + rh + 8 + 40 - (C.top + C.height));
      setVar(hero, '--pfxhc-push', push + 'px');
      setAttr(hero, 'data-pfxhc-push', '');
    }
    if (hero && mode !== 'row') setAttr(hero, 'data-pfxhc-push', null);

    setAttr(slot, 'data-pfxhc-mode', mode);
    wrap._pfxhc.side = side;
    if (mode === 'flow') { clearPlace(states); return; }
    states.forEach(function (s, i) {
      var p = place[i];
      if (!p) { if (!s.item.classList.contains('is-off')) s.item.classList.add('is-off'); return; }
      s.item.classList.remove('is-off');
      setVar(s.item, '--x', p.x.toFixed(1) + 'px');
      setVar(s.item, '--y', p.y.toFixed(1) + 'px');
      setVar(s.item, '--w', p.w.toFixed(1) + 'px');
      setVar(s.item, '--r', p.r + 'deg');
      s.item.style.width = p.w.toFixed(1) + 'px';
    });
  }

  /* ---------- hover physics ---------- */
  function wire(wrap, states) {
    var hot = -1, raf = 0;
    var still = reduced();

    function setTargets() {
      var side = wrap._pfxhc.side || [];
      states.forEach(function (s, i) {
        if (i === hot) { s.tlift = LIFT; s.ts = SCALE; s.tpush = 0; }
        else {
          s.tlift = 0; s.ts = 1; s.trx = 0; s.try_ = 0;
          // Neighbours ease away from the hovered cover (same side of the fan only in split mode).
          var same = hot >= 0 && (side[i] || 0) === (side[hot] || 0);
          s.tpush = !same ? 0 : (i < hot ? -1 : 1) * PUSH / Math.pow(2, Math.abs(i - hot) - 1);
        }
        s.item.classList.toggle('is-hover', i === hot);
      });
      wrap.classList.toggle('is-hot', hot >= 0);
      kick();
    }

    function apply(s) {
      s.card.style.transform =
        'translate3d(' + s.push.toFixed(2) + 'px,' + (-s.lift).toFixed(2) + 'px,0) ' +
        'rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) scale(' + s.s.toFixed(4) + ')';
    }

    function frame() {
      raf = 0;
      var moving = false;
      states.forEach(function (s) {
        var k = still ? 1 : EASE;
        s.rx += (s.trx - s.rx) * k; s.ry += (s.try_ - s.ry) * k;
        s.lift += (s.tlift - s.lift) * k; s.s += (s.ts - s.s) * k; s.push += (s.tpush - s.push) * k;
        if (Math.abs(s.trx - s.rx) > 0.02 || Math.abs(s.try_ - s.ry) > 0.02 || Math.abs(s.tlift - s.lift) > 0.05 ||
            Math.abs(s.ts - s.s) > 0.0005 || Math.abs(s.tpush - s.push) > 0.05) moving = true;
        apply(s);
      });
      if (moving) kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function sweep(s) {
      if (still) return;
      s.item.classList.remove('is-sweep'); void s.item.offsetWidth; s.item.classList.add('is-sweep');
    }
    function aim(s, el, e) {
      var r = el.getBoundingClientRect();
      var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      s.item.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      s.item.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (still) return;
      s.try_ = (px - 0.5) * 2 * MAX_TILT;      // the card turns to face the cursor
      s.trx = -(py - 0.5) * 2 * MAX_TILT;
      kick();
    }

    states.forEach(function (s, i) {
      var el = s.el;
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        hot = i; setTargets(); sweep(s); aim(s, el, e);
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        if (hot !== i) { hot = i; setTargets(); sweep(s); }
        aim(s, el, e);
      });
      el.addEventListener('pointerleave', function () {
        if (hot === i) { hot = -1; setTargets(); }
        s.item.classList.remove('is-sweep');
      });
      el.addEventListener('focus', function () {
        var fv = true; try { fv = el.matches(':focus-visible'); } catch (e) {}
        if (!fv) return;
        hot = i; setTargets(); sweep(s);
      });
      el.addEventListener('blur', function () {
        if (hot === i) { hot = -1; setTargets(); }
        s.item.classList.remove('is-sweep');
      });
    });
  }

  /* ---------- mount ---------- */
  var pending = {};
  function relayoutAll() { ProtoFx.slots('hero-covers').forEach(layout); }
  window.addEventListener('resize', relayoutAll, { passive: true });
  try { document.fonts && document.fonts.ready.then(relayoutAll); } catch (e) {}
  var ro = null;
  try { ro = new ResizeObserver(function () { relayoutAll(); }); } catch (e) {}
  var watched = [];

  ProtoFx.on('hero-covers', function () {
    var b = ProtoFx.bridge();
    if (!b) return;
    var cands = candidates(b);
    if (!cands.length) return;
    var ckey = keyOf(cands);
    ProtoFx.slots('hero-covers').forEach(function (slot) {
      slot.setAttribute('data-pfx-owned', 'hero-covers');   // our own DOM writes must not re-trigger ProtoFx runs
      var hero = slot.closest('[data-pfx="hero"]');
      if (ro && hero) {
        var copy = hero.querySelector('[data-pfx-ht="copy"]') || hero;
        [hero, copy].forEach(function (el) { if (watched.indexOf(el) < 0) { watched.push(el); ro.observe(el); } });
      }
      var cur = slot.querySelector(':scope > .pfxhc');
      if (cur && cur.getAttribute('data-ckey') === ckey) { layout(slot); return; }
      if (pending[ckey] === slot) return;
      pending[ckey] = slot;
      pick(cands).then(function (rows) {
        if (pending[ckey] === slot) delete pending[ckey];
        if (!rows.length || !slot.isConnected) return;
        var old = slot.querySelector(':scope > .pfxhc');
        if (old && old.getAttribute('data-ckey') === ckey) return;
        if (old) { if (old._pfxhc && old._pfxhc.io) old._pfxhc.io.disconnect(); old.remove(); }
        build(slot, rows, keyOf(rows.map(function (r) { return r.c; })));
        slot.querySelector(':scope > .pfxhc').setAttribute('data-ckey', ckey);
      });
    });
  });
})();
