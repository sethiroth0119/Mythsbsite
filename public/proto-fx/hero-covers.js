/* proto-fx piece: hero-covers — the prototype's floating cover fan, on the real hero.
   Fills [data-pfx-slot="hero-covers"] with the site's real featured cards
   (MSBridge.cards run through MSBridge.applyOverride, so admin art edits show here too).
   At rest each cover bobs slowly in a slight fan; on hover it lifts, scales ~1.06 and
   tilts toward the cursor (up to 12deg), a specular sweep crosses the art, a gold glow
   blooms behind it and the neighbouring covers ease away. Click / Enter opens the card:
   a cancelable window 'pfx:inspect' event lets the inspector piece take over; otherwise
   the real CardModal opens through MSBridge.openCard(card). */
(function () {
  if (!window.ProtoFx) return;

  var MAX_TILT = 12;       // deg, toward the cursor
  var LIFT = 22;           // px the hovered cover rises
  var SCALE = 1.06;        // hovered cover scale
  var PUSH = 18;           // px neighbours ease away (halves with each step of distance)
  var EASE = 0.14;         // per-frame approach: the soft follow of the prototype's WebGL covers

  function reduced() {
    if (ProtoFx.reduced) return true;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function featured(b) {
    var list = (b && b.cards) || [];
    var out = [];
    for (var i = 0; i < list.length && out.length < 4; i++) {
      var c = list[i];
      try { c = b.applyOverride ? b.applyOverride(c) : c; } catch (e) {}
      if (c && c.image) out.push(c);
    }
    return out;
  }

  function keyOf(cards) {
    return cards.map(function (c) { return c.name + '|' + c.image; }).join('~');
  }

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

  function build(slot, cards) {
    var wrap = document.createElement('div');
    wrap.className = 'pfxhc';
    wrap.setAttribute('data-pfx-owned', 'hero-covers');
    wrap.setAttribute('data-key', keyOf(cards));
    wrap.style.setProperty('--n', cards.length);

    var row = document.createElement('div');
    row.className = 'pfxhc-row';
    row.setAttribute('role', 'list');
    row.setAttribute('aria-label', 'Featured cards');
    wrap.appendChild(row);

    var states = [];
    cards.forEach(function (card, i) {
      var item = document.createElement('div');
      item.className = 'pfxhc-item';
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
              '<img alt="" decoding="async" draggable="false">' +
              '<span class="pfxhc-light" aria-hidden="true"></span>' +
              '<span class="pfxhc-sheen" aria-hidden="true"></span>' +
            '</span>' +
          '</span>' +
        '</span>';
      var img = btn.querySelector('img');
      img.addEventListener('load', function () { item.classList.add('is-loaded'); });
      img.alt = card.name;
      img.src = card.image;
      if (img.complete && img.naturalWidth) item.classList.add('is-loaded');
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
    wire(wrap, states);
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('is-in'); }); });
  }

  function wire(wrap, states) {
    var hot = -1, raf = 0;
    var still = reduced();

    function setTargets() {
      states.forEach(function (s, i) {
        if (i === hot) { s.tlift = LIFT; s.ts = SCALE; s.tpush = 0; }
        else {
          s.tlift = 0; s.ts = 1; s.trx = 0; s.try_ = 0;
          // Neighbours ease away from the hovered cover (same side of the fan only).
          var sameSide = wrap.classList.contains('is-split') ? ((i < 2) === (hot < 2)) : true;
          s.tpush = (hot < 0 || !sameSide) ? 0 : (i < hot ? -1 : 1) * PUSH / Math.pow(2, Math.abs(i - hot) - 1);
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

    states.forEach(function (s, i) {
      var el = s.el;
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        hot = i; setTargets(); sweep(s);
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        if (hot !== i) { hot = i; setTargets(); sweep(s); }
        var r = el.getBoundingClientRect();
        var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        s.item.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        s.item.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (still) return;
        s.try_ = (px - 0.5) * 2 * MAX_TILT;     // the side under the cursor dips away, like pressing the card
        s.trx = -(py - 0.5) * 2 * MAX_TILT;
        kick();
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

    // Split layout (two covers each side of the centred hero copy) is decided by CSS; mirror it for the push logic.
    function mode() {
      var r = wrap.querySelector('.pfxhc-row');
      wrap.classList.toggle('is-split', !!r && getComputedStyle(r).display === 'block');
    }
    mode();
    window.addEventListener('resize', mode, { passive: true });
  }

  ProtoFx.on('hero-covers', function () {
    var b = ProtoFx.bridge();
    if (!b) return;
    var cards = featured(b);
    if (!cards.length) return;
    var key = keyOf(cards);
    ProtoFx.slots('hero-covers').forEach(function (slot) {
      var cur = slot.querySelector(':scope > .pfxhc');
      if (cur && cur.getAttribute('data-key') === key) return;
      if (cur) cur.remove();
      slot.setAttribute('data-pfx-owned', 'hero-covers');   // our own DOM writes must not re-trigger ProtoFx runs
      build(slot, cards);
    });
  });
})();
