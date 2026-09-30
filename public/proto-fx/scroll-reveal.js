/* proto-fx piece: scroll-reveal — port of the prototype's reveal-on-scroll ([data-motion] / .reveal:
   opacity 0 + 28px rise, .8s cubic-bezier(.16,1,.3,1), ~80ms stagger via a per-element delay) and its
   fixed 2px gold scroll-progress line.

   Safety rules:
   - Only JS hides things (class .pfx-rv-h). No JS / no IntersectionObserver / reduced motion => nothing hidden.
   - Elements already in view on the first page are never hidden.
   - Skips the hero, nav, footer, modals/fixed layers and anything injected by other pieces
     ([data-pfx-owned], [data-pfx-slot]) so their own entrances are untouched. Opt out: [data-pfx-noreveal].
   - After an element has risen, its reveal classes are removed so its own hover transitions/transforms
     (card tilt, hover scale) behave exactly as before. */
(function () {
  if (!window.ProtoFx) return;
  var STAGGER = 80, MAX_STEPS = 7, DURATION = 800;
  var reduced = !!ProtoFx.reduced;
  var canIO = 'IntersectionObserver' in window;
  var SKIP = '[data-pfx="hero"],[data-pfx="nav"],[data-pfx="footer"],nav,footer,header,dialog,[role="dialog"],' +
             '[aria-modal="true"],.fixed,[data-pfx-owned],[data-pfx-slot],[data-pfx-noreveal]';

  /* ---------- scroll progress line ---------- */
  var bar = null, ticking = false;
  function ensureBar() {
    if (bar && bar.isConnected) return;
    bar = document.querySelector('.pfx-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pfx-progress';
      bar.setAttribute('aria-hidden', 'true');
      bar.setAttribute('data-pfx-owned', '');
      document.body.appendChild(bar);
    }
    paint();
  }
  function paint() {
    ticking = false;
    if (!bar) return;
    var de = document.documentElement;
    var max = Math.max(1, (de.scrollHeight || document.body.scrollHeight) - innerHeight);
    var p = Math.min(1, Math.max(0, (window.scrollY || de.scrollTop || 0) / max));
    bar.style.width = (p * 100).toFixed(3) + '%';
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  /* ---------- reveal ---------- */
  var firstPage = null, pageChangedAt = 0, lastPage = null;
  var io = (!reduced && canIO) ? new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

  function onIntersect(entries) {
    var hits = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
    if (!hits.length) return;
    hits.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    hits.forEach(function (el, i) { io.unobserve(el); show(el, Math.min(i, MAX_STEPS) * STAGGER); });
  }
  function show(el, delay) {
    el.style.setProperty('--pfx-rv-delay', delay + 'ms');
    el.setAttribute('data-pfx-rv', 'in');
    el.classList.remove('pfx-rv-h');
    setTimeout(function () { finish(el); }, delay + DURATION + 80);
  }
  function finish(el) {
    el.classList.remove('pfx-rv-t', 'pfx-rv-h');
    el.style.removeProperty('--pfx-rv-delay');
    el.setAttribute('data-pfx-rv', 'done');
  }

  function inflowKids(el) {
    var out = [];
    for (var i = 0; i < el.children.length; i++) {
      var c = el.children[i];
      if (/^(SCRIPT|STYLE|VIDEO|SOURCE|TEMPLATE)$/.test(c.tagName)) continue;
      if (c.matches('[data-pfx-owned],[data-pfx-slot],[data-pfx-noreveal]')) continue;
      var cs = getComputedStyle(c);
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') continue;
      out.push(c);
    }
    return out;
  }
  function isRow(el, kids) {
    if (kids.length < 2 || /^(P|H1|H2|H3|H4|A|SPAN|UL|OL)$/.test(el.tagName)) return false;
    var d = getComputedStyle(el).display;
    if (!/flex|grid/.test(d) && !/\bspace-y-/.test(String(el.className))) return false;
    for (var i = 0; i < kids.length; i++) if (kids[i].offsetHeight < 30) return false;
    return true;
  }
  /* Section head, cards, steps and panels of one section. */
  function targetsOf(sec) {
    var el = sec, kids = inflowKids(sec), guard = 0;
    while (kids.length === 1 && !/^H[1-4]$/.test(kids[0].tagName) && guard++ < 6) { el = kids[0]; kids = inflowKids(el); }
    var out = [];
    kids.forEach(function (k) {
      var sub = inflowKids(k);
      if (isRow(k, sub)) sub.forEach(function (s) { out.push(s); }); else out.push(k);
    });
    return out;
  }

  function scan() {
    var root = document.getElementById('root') || document.body;
    var b = ProtoFx.bridge();
    var page = b && b.page != null ? String(b.page) : 'home';
    if (firstPage === null) firstPage = page;
    if (lastPage !== null && page !== lastPage) pageChangedAt = Date.now();
    lastPage = page;
    var onFirstPage = pageChangedAt === 0;
    var animateInView = !onFirstPage && Date.now() - pageChangedAt < 1500;
    var vh = innerHeight;

    var secs = root.querySelectorAll('section');
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (sec.closest(SKIP) || sec.parentElement.closest('section')) continue;
      if (!sec.querySelector('h1,h2,h3')) continue;
      var list = targetsOf(sec);
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (t.hasAttribute('data-pfx-rv') || t.closest('[data-pfx-rv]') || t.querySelector('[data-pfx-rv="wait"],[data-pfx-rv="in"]')) continue;
        if (!io) { t.setAttribute('data-pfx-rv', 'done'); continue; }
        var r = t.getBoundingClientRect();
        var inView = r.top < vh && r.bottom > 0 && r.width > 0;
        if (inView && !animateInView) { t.setAttribute('data-pfx-rv', 'done'); continue; }
        t.setAttribute('data-pfx-rv', 'wait');
        t.classList.add('pfx-rv-t', 'pfx-rv-h');
        io.observe(t);
      }
    }
    ensureBar();
  }

  /* Hide newly mounted content before it paints (MutationObserver callbacks run before paint),
     then the debounced ProtoFx.on pass catches anything else. */
  var queued = false;
  function queue() { if (!queued) { queued = true; Promise.resolve().then(function () { queued = false; try { scan(); } catch (e) { console.error('[proto-fx] scroll-reveal:', e); } }); } }
  function startMO() {
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var n = muts[i].target;
          if (muts[i].addedNodes.length && !(n.closest && n.closest('[data-pfx-owned]'))) { queue(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.body) startMO(); else document.addEventListener('DOMContentLoaded', startMO);

  /* Safety net: never leave anything hidden if the observer misses (e.g. element left the layout). */
  setInterval(function () {
    var hidden = document.querySelectorAll('.pfx-rv-h');
    for (var i = 0; i < hidden.length; i++) {
      var r = hidden[i].getBoundingClientRect();
      if (r.top < innerHeight * 0.9 && r.bottom > 0 && r.width > 0) { if (io) io.unobserve(hidden[i]); show(hidden[i], 0); }
    }
  }, 1500);

  ProtoFx.on('scroll-reveal', scan);
})();
