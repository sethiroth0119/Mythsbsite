/* proto-fx piece: inspector — the prototype's card inspector ("THE CARD ARCHIVE").
   Opens whenever a card is clicked: [data-pfx=card] (hero, spotlights, gallery, community…),
   [data-pfx=card-thumb] (Card List), any [data-pfx-inspect="Card Name"] element, and on demand from
   other pieces (hero covers, collection showcase) via
       ProtoFx.inspect({ name | card | cards, index, el })   or
       window.dispatchEvent(new CustomEvent('protofx:inspect', { detail: {...} }))
   The dialog mirrors the prototype's #inspect-dialog: blurred veil, big card (drag to tilt, arrow keys to
   rotate, Home to reset), Turn card ↻ (card back), Reset view, ← 01 / 05 →, identity + facts panels,
   Card details +, Esc / × to close softly. Real data comes from window.MSBridge (the site's cards +
   admin overrides). The site's own detail modal stays one click away ("Full card record"), and
   "Play to Earn This Card" links to MSBridge.playUrl exactly like the site's CardModal. */
(function () {
  if (!window.ProtoFx) return;
  var PX = window.ProtoFx;
  var reduced = !!PX.reduced;
  var bypass = false;          // true while we forward a click to the site's own handler
  var dlg = null, els = {};
  var list = [], idx = 0, srcEl = null;
  var st = { rx: 0, ry: 0, cx: 0, cy: 0, flip: 0, drag: null, raf: 0, t0: 0, last: 0 };

  function B() { return window.MSBridge || null; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function txt(el) { return el ? (el.textContent || '').trim() : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function playUrl() { var b = B(); return (b && b.playUrl) || 'https://playmythicspellbook.com'; }

  /* ---------- real card data ---------- */
  function pool() {
    var b = B(); if (!b) return [];
    return [].concat(b.cards || [], b.communityCards || []);
  }
  function withOverride(c) { var b = B(); try { return (b && b.applyOverride) ? (b.applyOverride(c) || c) : c; } catch (e) { return c; } }
  function byName(name) {
    var n = String(name || '').toLowerCase(), p = pool();
    for (var i = 0; i < p.length; i++) if (String(p[i].name).toLowerCase() === n) return p[i];
    return null;
  }
  // Card List entries can come from the admin DB (not on the bridge): read what the thumb shows.
  function fromEl(el) {
    var name = el.getAttribute('data-card-name') || el.getAttribute('data-pfx-inspect') || txt(el.querySelector('.font-bold'));
    var hit = byName(name);
    if (hit) return hit;
    var img = el.querySelector('img');
    var chip = el.querySelector('.tracking-widest');
    var lines = el.querySelectorAll('.truncate');
    return {
      name: name || 'Unknown card', image: img ? img.getAttribute('src') : null,
      rarity: chip ? txt(chip) : '', type: lines.length > 1 ? txt(lines[lines.length - 1]).replace(/^—$/, '') : '',
      fullCard: !!(img && /object-contain/.test(img.className)), _partial: true
    };
  }

  /* ---------- dialog ---------- */
  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'pfx-inspect';
    dlg.setAttribute('data-pfx-owned', '');
    dlg.setAttribute('aria-labelledby', 'pfx-inspect-title');
    dlg.setAttribute('aria-describedby', 'pfx-inspect-tip');
    dlg.innerHTML =
      '<div class="inspect-scene" tabindex="0" role="img" aria-label="Interactive card. Drag to tilt, or use the arrow keys. Home resets the view.">' +
        '<div class="pfx-insp-fly"><div class="pfx-insp-swap"><div class="pfx-insp-shadow"></div><div class="pfx-insp-card">' +
          '<div class="pfx-insp-core"></div>' +
          '<div class="pfx-insp-face pfx-insp-front"><div class="pfx-insp-art"><div class="pfx-insp-fallback"></div><img alt="" draggable="false"></div><span class="pfx-insp-gem"></span><div class="pfx-insp-plate"><b></b><i></i></div><div class="pfx-insp-sheen"></div></div>' +
          '<div class="pfx-insp-face pfx-insp-back"><div class="pfx-insp-sheen"></div></div>' +
        '</div></div></div>' +
      '</div>' +
      '<div class="inspect-topbar"><span>THE CARD ARCHIVE <span class="inspect-counter" aria-live="polite">01 / 05</span></span><button class="close-dialog" type="button" aria-label="Close card inspector" data-close>×</button></div>' +
      '<div class="inspect-details" id="pfx-inspect-details">' +
        '<div class="inspect-panel inspect-identity"><div class="eyebrow" data-f="faction"></div><h2 id="pfx-inspect-title" data-f="title"></h2><p data-f="description"></p><span class="inspect-rarity" data-f="rarity"></span></div>' +
        '<div class="inspect-panel inspect-facts"><div class="inspect-stats" data-f="stats"></div><div class="inspect-ability" data-f="abilitybox"><strong data-f="abilitytitle"></strong><p data-f="ability"></p></div>' +
          '<div class="inspect-strategy"><strong>EXPLORE THIS CARD</strong><p data-f="strategy"></p>' +
            '<div class="inspect-links"><a class="angle-button" data-f="play" href="#">Play to Earn This Card</a><button type="button" class="inspect-reset" data-act="record">Full card record →</button></div>' +
          '</div></div>' +
      '</div>' +
      '<div class="inspect-toolbar"><p class="inspect-tip" id="pfx-inspect-tip">DRAG TO TILT · ARROW KEYS TO ROTATE · ESC TO RETURN</p>' +
        '<div class="inspect-actions"><button class="round-button" type="button" data-act="prev" aria-label="Inspect previous card">←</button><button class="angle-button outline" type="button" data-act="flip">Turn card ↻</button><button class="round-button" type="button" data-act="next" aria-label="Inspect next card">→</button></div>' +
        '<div class="inspect-toolbar-extra"><button class="inspect-reset" type="button" data-act="reset">Reset view</button><button class="inspect-details-toggle" type="button" data-act="details" aria-expanded="false" aria-controls="pfx-inspect-details">Card details +</button></div>' +
      '</div>';
    document.body.appendChild(dlg);
    var q = function (s) { return dlg.querySelector(s); };
    els = {
      scene: q('.inspect-scene'), fly: q('.pfx-insp-fly'), swap: q('.pfx-insp-swap'), card: q('.pfx-insp-card'), shadow: q('.pfx-insp-shadow'),
      front: q('.pfx-insp-front'), img: q('.pfx-insp-art img'), fallback: q('.pfx-insp-fallback'), gem: q('.pfx-insp-gem'),
      plateName: q('.pfx-insp-plate b'), plateType: q('.pfx-insp-plate i'), back: q('.pfx-insp-back'),
      sheens: dlg.querySelectorAll('.pfx-insp-sheen'), counter: q('.inspect-counter'),
      prev: q('[data-act=prev]'), next: q('[data-act=next]'), toggle: q('[data-act=details]'), play: q('[data-f=play]'),
      panels: dlg.querySelectorAll('.inspect-panel')
    };
    els.f = {}; Array.prototype.forEach.call(dlg.querySelectorAll('[data-f]'), function (n) { els.f[n.getAttribute('data-f')] = n; });
    els.back.style.backgroundImage = 'url("' + PX.asset('card-back.webp') + '")';
    els.img.addEventListener('error', function () { els.img.style.visibility = 'hidden'; });
    els.img.addEventListener('load', function () { els.img.style.visibility = ''; });

    dlg.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act],[data-close]');
      if (!a || !dlg.contains(a)) return;
      if (a.hasAttribute('data-close')) return softClose();
      var act = a.getAttribute('data-act');
      if (act === 'prev') step(-1);
      else if (act === 'next') step(1);
      else if (act === 'flip') { st.flip = st.flip ? 0 : 1; st.ry += 180; kick(); }
      else if (act === 'reset') resetView();
      else if (act === 'details') setDetails(!dlg.classList.contains('details-open'));
      else if (act === 'record') openRecord();
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); softClose(); });
    dlg.addEventListener('close', cleanup);
    dlg.addEventListener('keydown', onKey);
    els.scene.addEventListener('pointerdown', onDown);
    return dlg;
  }

  function setDetails(open) {
    dlg.classList.toggle('details-open', open);
    els.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    els.toggle.textContent = open ? 'Card details −' : 'Card details +';
  }

  function render(c) {
    c = withOverride(c) || {};
    var name = c.name || 'Unknown card';
    els.front.classList.toggle('is-full', !!(c.fullCard || c.full_card));
    els.img.style.visibility = '';
    if (c.image) { els.img.src = c.image; els.img.alt = name; } else { els.img.removeAttribute('src'); els.img.style.visibility = 'hidden'; }
    els.fallback.textContent = name;
    els.gem.textContent = c.rarity || '';
    els.gem.style.display = c.rarity ? '' : 'none';
    els.plateName.textContent = name;
    els.plateType.textContent = c.type || '';

    var f = els.f;
    var eyebrow = [c.faction, c.type].filter(Boolean).join(' · ');
    f.faction.textContent = eyebrow || 'Mythic Spellbook';
    f.title.textContent = name;
    f.description.textContent = c.flavor ? '“' + c.flavor + '”' : (c._partial ? 'A card from the Mythic Spellbook archive.' : '');
    f.description.style.display = f.description.textContent ? '' : 'none';
    f.rarity.textContent = [c.rarity, c.kalon ? 'Kalon' : ''].filter(Boolean).join(' · ');

    var stats = [];
    var has = function (v) { return v !== null && v !== undefined && v !== ''; };
    if (has(c.cost)) stats.push([c.cost, 'COST']);
    if (has(c.atk)) stats.push([c.atk, 'ATTACK']);
    if (has(c.def)) stats.push([c.def, 'DEFENSE']);
    if (stats.length < 3 && has(c.hp)) stats.push([c.hp, 'HP']);
    if (stats.length < 2 && has(c.power)) stats.push([c.power, 'POWER']);
    f.stats.innerHTML = stats.slice(0, 3).map(function (s) { return '<div><strong>' + esc(s[0]) + '</strong><span>' + s[1] + '</span></div>'; }).join('');

    var eff = String(c.effect || ''), cut = eff.indexOf(' — ');
    if (eff) {
      f.abilitytitle.textContent = cut > 0 && cut < 48 ? eff.slice(0, cut) : 'Card ability';
      f.ability.textContent = cut > 0 && cut < 48 ? eff.slice(cut + 3) : eff;
      f.abilitybox.style.display = '';
    } else f.abilitybox.style.display = 'none';

    var bits = [];
    if (c.type) bits.push(c.type + (has(c.cost) ? ' for ' + c.cost + ' energy' : '') + '.');
    if (c.element) bits.push('Element: ' + c.element + '.');
    if (c.kalon) bits.push('Kalon-capable — it can transform mid-match.');
    if (!bits.length || c._partial) bits.push('Open the full card record for its stats, set and release.');
    f.strategy.textContent = bits.join(' ');
    els.play.href = playUrl();

    els.counter.textContent = pad(idx + 1) + ' / ' + pad(list.length);
    els.prev.disabled = els.next.disabled = list.length < 2;
  }

  /* ---------- 3D motion ---------- */
  function apply(rx, ry, t) {
    var fl = (!reduced && !st.drag) ? Math.sin(t / 1100) * 6 : 0;       // gentle idle float
    var sw = (!reduced && !st.drag) ? Math.sin(t / 1700) * 2.2 : 0;     // …and sway
    els.card.style.transform = 'translateY(' + fl.toFixed(2) + 'px) rotateX(' + (rx + sw * .4).toFixed(2) + 'deg) rotateY(' + (ry + sw).toFixed(2) + 'deg)';
    var yr = (ry + sw) * Math.PI / 180, xr = rx * Math.PI / 180;
    var sy = Math.sin(yr), cy = Math.cos(yr), sx = Math.sin(xr);
    els.shadow.style.transform = 'translateY(' + (fl * -.4).toFixed(2) + 'px) scaleX(' + Math.max(.18, Math.abs(cy)).toFixed(3) + ') scale(' + (1 - fl / 60).toFixed(3) + ')';
    var gx = 50 - sy * 48, gy = 32 + sx * 55, gp = 50 + sy * 60 - sx * 20;
    var go = Math.min(.95, .42 + Math.abs(sy) * .5 + Math.abs(sx) * .45);
    for (var i = 0; i < els.sheens.length; i++) {
      var s = els.sheens[i].style;
      s.setProperty('--gx', (i ? 100 - gx : gx).toFixed(1) + '%'); s.setProperty('--gy', gy.toFixed(1) + '%');
      s.setProperty('--gp', gp.toFixed(1) + '%'); s.setProperty('--go', go.toFixed(3));
    }
  }
  function tick(now) {
    st.raf = 0;
    if (!dlg || !dlg.open) return;
    var dt = st.last ? Math.min(64, now - st.last) : 16; st.last = now;
    var k = reduced ? 1 : 1 - Math.pow(1 - (st.drag ? .35 : .12), dt / 16.7);
    st.cx += (st.rx - st.cx) * k; st.cy += (st.ry - st.cy) * k;
    apply(st.cx, st.cy, now);
    if (!reduced || Math.abs(st.rx - st.cx) > .01 || Math.abs(st.ry - st.cy) > .01) st.raf = requestAnimationFrame(tick);
  }
  function kick() { if (!st.raf && dlg && dlg.open) st.raf = requestAnimationFrame(tick); }
  function resetView() {
    // unwind to the nearest face-front turn so it doesn't spin several times
    st.ry = Math.round(st.ry / 360) * 360; st.rx = 0; st.flip = 0; kick();
  }
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    st.drag = { x: e.clientX, y: e.clientY, rx: st.rx, ry: st.ry, id: e.pointerId };
    try { els.scene.setPointerCapture(e.pointerId); } catch (_) {}
    els.scene.classList.add('is-dragging');
    els.scene.addEventListener('pointermove', onMove);
    els.scene.addEventListener('pointerup', onUp);
    els.scene.addEventListener('pointercancel', onUp);
    kick();
  }
  function onMove(e) {
    if (!st.drag) return;
    st.ry = st.drag.ry + (e.clientX - st.drag.x) * .42;
    st.rx = Math.max(-42, Math.min(42, st.drag.rx - (e.clientY - st.drag.y) * .32));
    kick();
  }
  function onUp() {
    st.drag = null;
    els.scene.classList.remove('is-dragging');
    els.scene.removeEventListener('pointermove', onMove);
    els.scene.removeEventListener('pointerup', onUp);
    els.scene.removeEventListener('pointercancel', onUp);
    st.flip = (Math.round(st.ry / 180) % 2 + 2) % 2; kick();
  }
  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { st.ry += (k === 'ArrowLeft' ? -15 : 15); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { st.rx = Math.max(-42, Math.min(42, st.rx + (k === 'ArrowUp' ? 12 : -12))); }
    else if (k === 'Home') resetView();
    else return;
    e.preventDefault(); kick();
  }

  /* ---------- open / switch / close ---------- */
  function rectOf(el) {
    if (!el || !el.isConnected) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return r;
  }
  function flyFrom(r, back) {
    var t = els.fly.getBoundingClientRect();
    var dx = (r.left + r.width / 2) - (t.left + t.width / 2), dy = (r.top + r.height / 2) - (t.top + t.height / 2);
    var s = Math.min(r.width / t.width, r.height / t.height) || .3;
    var from = { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: back ? 0 : .35 };
    var to = { transform: 'none', opacity: 1 };
    return els.fly.animate(back ? [to, from] : [from, to], back
      ? { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
      : { duration: 760, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
  function open(items, index, el) {
    if (!items || !items.length) return;
    build();
    list = items; idx = Math.max(0, Math.min(items.length - 1, index || 0)); srcEl = el || null;
    dlg.classList.remove('is-closing');
    try { els.fly.getAnimations().forEach(function (a) { a.cancel(); }); } catch (_) {}
    st.rx = st.cx = 0; st.ry = st.cy = 0; st.flip = 0; st.last = 0;
    render(list[idx].card);
    setDetails(window.innerWidth > 1100);
    var r = rectOf(el);
    if (!dlg.open) { try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); } }
    document.documentElement.classList.add('pfx-inspect-open');
    apply(0, 0, performance.now());
    if (r && !reduced && els.fly.animate) flyFrom(r, false);
    try { els.scene.focus({ preventScroll: true }); } catch (_) {}
    kick();
  }
  function restartCopy() {
    Array.prototype.forEach.call(els.panels, function (p) { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; });
  }
  function step(d) {
    if (list.length < 2) return;
    var ni = (idx + d + list.length) % list.length;
    var outC = d > 0 ? 'is-out-l' : 'is-out-r', inC = d > 0 ? 'is-out-r' : 'is-out-l';
    var swap = function () {
      idx = ni; srcEl = list[idx].el || null;
      st.rx = st.cx = 0; st.ry = st.cy = 0; st.flip = 0;
      render(list[idx].card); restartCopy(); apply(0, 0, performance.now());
    };
    if (reduced) return swap();
    els.swap.classList.add(outC);
    setTimeout(function () {
      swap();
      els.swap.style.transition = 'none';
      els.swap.classList.remove(outC); els.swap.classList.add(inC);
      void els.swap.offsetWidth;
      els.swap.style.transition = '';
      els.swap.classList.remove(inC);
    }, 220);
  }
  var closing = 0;
  function softClose() {
    if (!dlg || !dlg.open || closing) return;
    if (reduced) return dlg.close();
    dlg.classList.add('is-closing');
    var r = rectOf(srcEl);
    if (r && els.fly.animate) flyFrom(r, true);
    else els.fly.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
    closing = setTimeout(function () { closing = 0; dlg.close(); }, 280);
  }
  function cleanup() {
    if (closing) { clearTimeout(closing); closing = 0; }
    dlg.classList.remove('is-closing');
    document.documentElement.classList.remove('pfx-inspect-open');
    try { els.fly.getAnimations().forEach(function (a) { a.cancel(); }); } catch (_) {}
    if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; st.drag = null;
    var back = srcEl && srcEl.isConnected ? srcEl : null;
    if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (_) {} }
  }
  // The site's own detail modal (CardModal / CardListDetailModal): forward a click to the real element,
  // or use MSBridge.openCard for built-in cards that have no element on this page.
  function openRecord() {
    var it = list[idx]; if (!it) return;
    var el = it.el && it.el.isConnected ? it.el : null;
    if (dlg.open) dlg.close();
    if (el) { bypass = true; try { el.click(); } finally { bypass = false; } return; }
    var b = B(); var real = byName(it.card.name);
    if (b && b.openCard) b.openCard(real || it.card);
  }

  /* ---------- building the round (← 01 / 05 →) ---------- */
  function roundFor(el) {
    var name = el.getAttribute('data-card-name') || el.getAttribute('data-pfx-inspect');
    var kind = el.getAttribute('data-pfx');
    if (kind === 'card-thumb') {
      // every thumb on the Card List, in page order (Coming Drops then the catalog), one per name
      var seen = {}, items = [], at = 0;
      Array.prototype.forEach.call(document.querySelectorAll('[data-pfx="card-thumb"]'), function (t) {
        var n = t.getAttribute('data-card-name'); if (seen[n] && t !== el) return;
        if (t === el) at = items.length;
        if (!seen[n]) { seen[n] = 1; items.push({ card: fromEl(t), el: t }); }
      });
      return { items: items, index: at };
    }
    var b = B(), set = (b && b.cards) || [];
    var inSet = set.some(function (c) { return c.name === name; });
    if (!inSet && b && b.communityCards && b.communityCards.some(function (c) { return c.name === name; })) set = b.communityCards;
    else if (!inSet) set = [];
    if (!set.length) return { items: [{ card: fromEl(el), el: el }], index: 0 };
    var items2 = set.map(function (c) {
      var on = document.querySelector('[data-pfx="card"][data-card-name="' + String(c.name).replace(/"/g, '\\"') + '"]');
      return { card: c, el: c.name === name ? el : on };
    });
    var i2 = 0; set.forEach(function (c, i) { if (c.name === name) i2 = i; });
    return { items: items2, index: i2 };
  }

  document.addEventListener('click', function (e) {
    if (bypass || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target && e.target.closest && e.target.closest('[data-pfx="card"],[data-pfx="card-thumb"],[data-pfx-inspect]');
    if (!el || (dlg && dlg.contains(el))) return;
    // leave cards that already sit inside one of the site's own modals alone
    if (el.closest('.fixed.inset-0,[role="dialog"],dialog')) return;
    if (el.closest('[data-pfx-noinspect]')) return;
    // an interactive control nested inside a card (e.g. a remove button) keeps its own behaviour
    var ctl = e.target.closest('a,button,input,select,textarea');
    if (ctl && ctl !== el && el.contains(ctl)) return;
    var r = roundFor(el);
    if (!r.items.length) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    open(r.items, r.index, el);
  }, true);

  // API for other pieces (hero covers, collection showcase): open by name / card / list.
  PX.inspect = function (d) {
    d = d || {};
    var items;
    if (d.cards && d.cards.length) items = d.cards.map(function (c) { return { card: typeof c === 'string' ? (byName(c) || { name: c }) : c, el: null }; });
    else {
      var b = B(); var set = (b && b.cards) || [];
      var want = d.card ? d.card.name : d.name;
      if (want && !set.some(function (c) { return c.name === want; })) set = [d.card || byName(want) || { name: want }];
      items = set.map(function (c) { return { card: c, el: null }; });
    }
    var i = typeof d.index === 'number' ? d.index : 0;
    var nm = d.card ? d.card.name : d.name;
    if (nm) items.forEach(function (it, k) { if (it.card.name === nm) i = k; });
    if (d.el && items[i]) items[i].el = d.el;
    open(items, i, d.el || null);
  };
  PX.inspectClose = function () { softClose(); };
  window.addEventListener('protofx:inspect', function (e) { PX.inspect(e.detail || {}); });

  PX.on('inspector', function () {
    // idempotent: nothing to re-scan (clicks are delegated). Keep an open card in sync with admin overrides.
    if (dlg && dlg.open && list[idx] && !st.drag && !els.swap.classList.contains('is-out-l') && !els.swap.classList.contains('is-out-r')) {
      var live = byName(list[idx].card.name);
      if (live && live !== list[idx].card) { list[idx].card = live; render(live); }
    }
  });
})();
