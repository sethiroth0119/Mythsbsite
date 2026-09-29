/* proto-fx piece: collection-showcase — fills data-pfx-slot="home-collection" with the
   prototype's "I / THE COLLECTION" chapter (prototype section#collection), driven by the
   site's REAL cards (MSBridge.cards, with admin overrides applied).
   - The active card floats large; hover lifts it and it tilts toward the pointer (8deg max,
     same calm tilt as card-hover) with a light that follows the pointer.
   - Prev / next round buttons (and ArrowLeft/ArrowRight, and clicking a side card) switch
     cards with a fade-and-slide; the caption shows name, rarity and type; "01 / 05" count.
   - "Inspect card ↗" and clicking the focused card open the real card (ProtoFx.inspect when
     the inspector piece provides it, otherwise MSBridge.openCard -> CardModal).
   - "Explore cards" -> MSBridge.go.cardlist() (the real Card List page).
   Respects prefers-reduced-motion: no float, no tilt, instant switches. */
(function () {
  if (!window.ProtoFx) return;
  var MAX = 8, OUT_MS = 260;
  var fine = true; try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
  var index = 0;          // survives the slot being unmounted/remounted by page switches
  var preloaded = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function list() {
    var b = ProtoFx.bridge();
    if (!b || !b.cards || !b.cards.length) return [];
    return b.cards.map(function (c) { try { return b.applyOverride ? (b.applyOverride(c) || c) : c; } catch (e) { return c; } });
  }
  function sig(cards) { return cards.map(function (c) { return c.name + '|' + c.image + '|' + c.rarity + '|' + c.type; }).join('~'); }
  function src(c) { return c && c.image ? c.image : ProtoFx.asset('card-back.webp'); }
  function abs(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  function typeLine(c) { return [c.faction, c.type].filter(Boolean).join(' · '); }
  function preload(c) { var u = src(c); if (preloaded[u]) return; preloaded[u] = 1; var i = new Image(); i.decoding = 'async'; i.src = u; }
  function wrap(i, n) { return ((i % n) + n) % n; }

  function build(slot, cards) {
    var sec = document.createElement('section');
    sec.className = 'pfx-coll';
    sec.id = 'collection';
    sec.setAttribute('data-pfx-owned', '');
    sec.setAttribute('aria-labelledby', 'pfx-coll-title');
    sec.innerHTML =
      '<span class="pfx-coll__chapter">I / THE COLLECTION</span>' +
      '<div class="pfx-coll__copy">' +
        '<p class="pfx-coll__eyebrow">Cards that live in the world</p>' +
        '<h2 class="pfx-coll__title" id="pfx-coll-title">Collect a card.<br> <em>Begin a story.</em></h2>' +
        '<p class="pfx-coll__lede">Meet the heroes, creatures, spells and locations of Mythic Spellbook. Every card you collect belongs to a larger world of survival, building and tactical combat.</p>' +
        '<div class="pfx-coll__caption" aria-live="polite">' +
          '<div class="pfx-coll__meta"><h3 class="pfx-coll__name"></h3><span class="pfx-coll__rarity"></span></div>' +
          '<p class="pfx-coll__type"></p>' +
          '<div class="pfx-coll__controls">' +
            '<button type="button" class="pfx-coll__round" data-dir="-1" aria-label="Previous card">←</button>' +
            '<span class="pfx-coll__count"></span>' +
            '<button type="button" class="pfx-coll__round" data-dir="1" aria-label="Next card">→</button>' +
            '<button type="button" class="pfx-coll__inspect">Inspect card ↗</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="pfx-coll__explore">Explore cards <span aria-hidden="true">›</span></button>' +
      '</div>' +
      '<div class="pfx-coll__stage">' +
        '<div class="pfx-coll__halo" aria-hidden="true"></div>' +
        '<img class="pfx-coll__ghost pfx-coll__ghost--prev" alt="" data-dir="-1" draggable="false">' +
        '<img class="pfx-coll__ghost pfx-coll__ghost--next" alt="" data-dir="1" draggable="false">' +
        '<div class="pfx-coll__slot"><div class="pfx-coll__float">' +
          '<button type="button" class="pfx-coll__card"><img alt="" draggable="false" decoding="async"></button>' +
        '</div></div>' +
      '</div>' +
      '<p class="pfx-coll__footnote">SELECT A CARD TO FOCUS · CLICK THE FOCUSED CARD TO INSPECT</p>';
    slot.appendChild(sec);

    var st = { sec: sec, busy: false, cards: cards, sig: sig(cards) };
    sec.__pfxColl = st;
    var q = function (s) { return sec.querySelector(s); };
    st.name = q('.pfx-coll__name'); st.rarity = q('.pfx-coll__rarity'); st.type = q('.pfx-coll__type');
    st.count = q('.pfx-coll__count'); st.slot = q('.pfx-coll__slot'); st.card = q('.pfx-coll__card');
    st.img = q('.pfx-coll__card img'); st.prev = q('.pfx-coll__ghost--prev'); st.next = q('.pfx-coll__ghost--next');

    Array.prototype.forEach.call(sec.querySelectorAll('[data-dir]'), function (b) {
      b.addEventListener('click', function () { step(st, +b.getAttribute('data-dir')); });
    });
    sec.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        e.preventDefault(); step(st, e.key === 'ArrowRight' ? 1 : -1);
      }
    });
    q('.pfx-coll__inspect').addEventListener('click', function () { inspect(st); });
    st.card.addEventListener('click', function () { inspect(st); });
    q('.pfx-coll__explore').addEventListener('click', function () {
      var b = ProtoFx.bridge();
      if (b && b.go && b.go.cardlist) b.go.cardlist();
    });

    if (!ProtoFx.reduced && fine) {
      st.card.addEventListener('pointermove', function (e) {
        var r = st.card.getBoundingClientRect(); if (!r.width) return;
        var px = Math.max(-.5, Math.min(.5, (e.clientX - r.left) / r.width - .5));
        var py = Math.max(-.5, Math.min(.5, (e.clientY - r.top) / r.height - .5));
        st.card.classList.add('is-tracking');
        st.card.style.setProperty('--rx', (-py * 2 * MAX).toFixed(2) + 'deg');
        st.card.style.setProperty('--ry', (px * 2 * MAX).toFixed(2) + 'deg');
        st.card.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%');
        st.card.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%');
      }, { passive: true });
      st.card.addEventListener('pointerleave', function () {
        st.card.classList.remove('is-tracking');
        st.card.style.setProperty('--rx', '0deg'); st.card.style.setProperty('--ry', '0deg');
      }, { passive: true });
    }
    // Some real cards ship bare (unframed, landscape) art: frame those like a card cover.
    st.img.addEventListener('load', function () {
      var w = st.img.naturalWidth, h = st.img.naturalHeight;
      st.card.classList.toggle('is-bare', !!(w && h && w / h > 0.82));
    });
    paint(st);
    return st;
  }

  function paint(st) {
    var cards = st.cards, n = cards.length; if (!n) return;
    index = wrap(index, n);
    var c = cards[index];
    st.img.src = src(c); st.img.alt = c.name || 'Card';
    st.card.setAttribute('aria-label', 'Inspect ' + (c.name || 'card'));
    st.card.style.setProperty('--pfx-mask', 'url("' + abs(src(c)).replace(/"/g, '%22') + '")');
    st.name.textContent = c.name || '';
    st.rarity.textContent = (c.rarity || '').toUpperCase();
    st.type.textContent = typeLine(c);
    st.count.textContent = pad(index + 1) + ' / ' + pad(n);
    var p = cards[wrap(index - 1, n)], x = cards[wrap(index + 1, n)];
    st.prev.src = src(p); st.prev.title = p.name || '';
    st.next.src = src(x); st.next.title = x.name || '';
    preload(cards[wrap(index + 2, n)]); preload(cards[wrap(index - 2, n)]);
  }

  function step(st, dir) {
    if (st.busy || st.cards.length < 2) return;
    var d = dir > 0 ? 'next' : 'prev';
    index = wrap(index + dir, st.cards.length);
    if (ProtoFx.reduced) { paint(st); return; }
    st.busy = true;
    st.sec.classList.add('is-swapping');
    st.slot.classList.add('is-out-' + d);
    setTimeout(function () {
      paint(st);
      st.slot.classList.remove('is-out-' + d);
      st.slot.classList.add('is-in-' + d);
      void st.slot.offsetWidth;                       // commit the start position
      st.slot.classList.remove('is-in-' + d);         // ...then ease in from the far side
      st.sec.classList.remove('is-swapping');
      setTimeout(function () { st.busy = false; }, 200);
    }, OUT_MS);
  }

  function inspect(st) {
    var c = st.cards[index]; if (!c) return;
    if (typeof ProtoFx.inspect === 'function') { try { ProtoFx.inspect(c); return; } catch (e) {} }
    var b = ProtoFx.bridge();
    if (b && b.openCard) b.openCard(c);
  }

  ProtoFx.on('collection-showcase', function () {
    var slots = ProtoFx.slots('home-collection'); if (!slots.length) return;
    var cards = list(); if (!cards.length) return;
    slots.forEach(function (slot) {
      var sec = slot.querySelector(':scope > .pfx-coll');
      if (!sec) { build(slot, cards); return; }
      var st = sec.__pfxColl;
      if (st && sig(cards) !== st.sig) { st.cards = cards; st.sig = sig(cards); paint(st); }   // admin overrides arrived
    });
  });
})();
