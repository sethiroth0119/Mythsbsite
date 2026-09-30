/* proto-fx piece: realm-footer — the prototype's closing (section#join-the-hunt.mythic-finale inside
   .realm-footer) rendered into every [data-pfx-slot=finale], plus the prototype's footer.mythic-footer
   directory (gold rule with a centre diamond, four columns + "Join the realm" panel) injected at the
   top of the site's real footer[data-pfx=footer]. The React footer's own links / copyright stay and
   are restyled as the prototype's colophon by realm-footer.css.
   Every link goes to a REAL destination: MSBridge.go.*, MSBridge.scrollTo(id), ./lore/, and the
   game's Play / Login URLs (same tab, exactly as the site's existing Play Now / Login links). */
(function () {
  if (!window.ProtoFx) return;
  var FALLBACK_PLAY = 'https://playmythicspellbook.com/?mode=signup';
  var FALLBACK_LOGIN = 'https://playmythicspellbook.com/?mode=signin';
  // Paths relative to the deploy root, so the pieces also work from nested pages.
  function ROOT() { return String(ProtoFx.base || './proto-fx/').replace(/proto-fx\/$/, '') || './'; }
  function LOGO() { return ROOT() + 'assets/artwork/Mythic%20Spellbook%20Gold%20Logo.png'; }

  function B() { return window.MSBridge || null; }
  function playUrl() { var b = B(); return (b && b.playUrl) || FALLBACK_PLAY; }
  function loginUrl() { var b = B(); return (b && b.loginUrl) || FALLBACK_LOGIN; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // In-app destinations: `go` names a MSBridge.go.* screen; `sec` is an element id on that screen
  // (the home page when `go` is empty). Switch screens first, then wait for the section to mount
  // (MutationObserver, not a fixed poll) and land on it under the fixed nav.
  var pendingWait = null;
  function navOffset() {
    var nav = document.querySelector('nav[data-pfx=nav]');
    var r = nav && nav.getBoundingClientRect();
    return r && r.bottom > 0 && r.bottom < 200 ? Math.round(r.bottom) + 12 : 0;
  }
  function landOn(el, smooth) {
    var top = el.getBoundingClientRect().top + window.pageYOffset - navOffset();
    // 'instant', not 'auto': the site sets html { scroll-behavior: smooth }, which turns 'auto'
    // jumps into slow animations that the screen switch's own scroll-to-top then fights.
    window.scrollTo({ top: Math.max(0, top), behavior: smooth && !ProtoFx.reduced ? 'smooth' : 'instant' });
  }
  function goTo(go, sec) {
    var b = B(); if (!b) return;
    if (pendingWait) { pendingWait(); pendingWait = null; }
    var page = go || 'home';
    var here = b.page === page || (page === 'home' && !b.page);
    if (sec && here) {
      var now = document.getElementById(sec);
      if (now) { landOn(now, true); return; }
    }
    // Same screen, no section (e.g. 'Home' while already home): go back to the top.
    if (!sec && here) { window.scrollTo({ top: 0, behavior: ProtoFx.reduced ? 'instant' : 'smooth' }); return; }
    // Anything with this id that existed before the switch belongs to the old screen.
    var stale = sec ? document.getElementById(sec) : null;
    if (!here) {
      if (b.go && typeof b.go[page] === 'function') b.go[page]();
      else if (page === 'home' && b.scrollTo && sec) { b.scrollTo(sec); }
    }
    if (!sec) return;
    // React commits the new screen synchronously or on its next tick; MSBridge.page is only
    // refreshed in a useEffect afterwards, so the element is accepted as soon as it is a
    // freshly mounted node (or the bridge agrees), checked on DOM mutations, on 'ms:render'
    // and on every frame. Then the landing is held until the layout above it stops growing.
    var done = false, mo = null, timer = null, raf = 0, landed = null;
    var t0 = performance.now(), lastTop = null, stableFrames = 0, lastY = null;
    function cleanup() {
      done = true;
      if (mo) mo.disconnect(); mo = null;
      clearTimeout(timer); cancelAnimationFrame(raf);
      window.removeEventListener('ms:render', check);
      window.removeEventListener('wheel', userScrolled);
      window.removeEventListener('touchstart', userScrolled);
      window.removeEventListener('keydown', userKey);
      if (pendingWait === cleanup) pendingWait = null;
    }
    function userScrolled() { cleanup(); }
    function userKey(e) { if (/^(Arrow|Page|Home|End| )/.test(e.key)) cleanup(); }
    function candidate() {
      var el = document.getElementById(sec);
      if (!el) return null;
      if (el !== stale) return el;                    // newly mounted on the new screen
      var b2 = B();
      if (!b2 || !b2.page || b2.page === page) return el;  // same node survived; bridge agrees
      return null;
    }
    function settle() {
      raf = 0;
      if (done) return;
      if (!document.contains(landed)) { landed = null; lastTop = null; stableFrames = 0; loop(); return; }
      var off = landed.getBoundingClientRect().top - navOffset();
      var y = window.pageYOffset;
      if (Math.abs(off) > 2) { landOn(landed, false); stableFrames = 0; }
      else stableFrames++;
      lastTop = off; lastY = window.pageYOffset;
      var age = performance.now() - t0;
      // Done once it has sat still for ~12 frames after at least 600ms, or after 3.5s.
      if ((stableFrames >= 12 && age > 600) || age > 3500) { cleanup(); return; }
      raf = requestAnimationFrame(settle);
    }
    function check() {
      if (done) return true;
      if (landed) return true;
      var el = candidate();
      if (!el) return false;
      landed = el;
      if (mo) { mo.disconnect(); mo = null; }
      clearTimeout(timer);
      landOn(el, false);
      lastY = window.pageYOffset;
      window.addEventListener('wheel', userScrolled, { once: true, passive: true });
      window.addEventListener('touchstart', userScrolled, { once: true, passive: true });
      window.addEventListener('keydown', userKey);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(settle);
      return true;
    }
    function loop() {
      raf = 0;
      if (done || check()) return;
      raf = requestAnimationFrame(loop);
    }
    pendingWait = cleanup;
    window.addEventListener('ms:render', check);
    if (check()) return;
    mo = new MutationObserver(function () { check(); });
    mo.observe(document.body, { childList: true, subtree: true });
    raf = requestAnimationFrame(loop);
    timer = setTimeout(function () { if (!landed) cleanup(); }, 8000);
  }

  // The site has no per-page URLs, so a new-tab open lands on the closest real address.
  function fallbackHref(item) {
    var root = ROOT();
    if (item.go === 'shop') return root + '?shop=1';
    if (item.sec && (!item.go || item.go === 'home')) return root + '#' + item.sec;
    return root;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function link(item) {
    if (item.href) return '<a href="' + esc(item.href) + '"' + (item.ext ? ' data-rf-ext="' + item.ext + '"' : '') +
      (item.ext === 'discord' ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(item.label) + '</a>';
    return '<a href="' + esc(fallbackHref(item)) + '" data-rf-go="' + (item.go || '') + '" data-rf-sec="' + (item.sec || '') + '">' + esc(item.label) + '</a>';
  }
  // Discord: reuse whatever the site's own footer Discord link points at.
  function discordHref(footer) {
    var a = footer && Array.prototype.find.call(footer.querySelectorAll('a'), function (x) { return !x.closest('.rf-footer-top') && /discord/i.test(x.textContent || ''); });
    return a ? (a.getAttribute('href') || '#') : '#';
  }

  function columns(footer) {
    return [
      { title: 'The realm', items: [
        { label: 'Home', go: 'home' },
        { label: 'The cards', go: 'cardlist' },
        { label: 'World', sec: 'story' },
        { label: 'Lore', href: './lore/' }
      ] },
      { title: 'Explore', items: [
        { label: 'Card gallery', go: 'deckbuilder', sec: 'gallery' },
        { label: 'Survivors', go: 'survivor' },
        { label: 'Gameplay', sec: 'play' },
        { label: 'News & updates', go: 'news' }
      ] },
      { title: 'Your journey', items: [
        { label: 'Choose your path', go: 'survivor', sec: 'factions' },
        { label: 'Deck builder', go: 'deckbuilder' },
        { label: 'The economy', go: 'rmt' },
        { label: 'Back the project', go: 'backing' },
        { label: 'Shop', go: 'shop' }
      ] },
      { title: 'Community', items: [
        { label: 'Join the realm', href: playUrl(), ext: 'play' },
        { label: 'Log in', href: loginUrl(), ext: 'login' },
        { label: 'Community', go: 'community' },
        { label: 'Player hub', go: 'hub' },
        { label: 'Discord', href: discordHref(footer), ext: 'discord' }
      ].filter(function (i) { return i.ext !== 'discord' || (i.href && i.href !== '#'); }) }
    ];
  }

  function finaleHTML() {
    return '' +
      '<div class="rf-realm" data-pfx-owned>' +
        '<div class="rf-backdrop" aria-hidden="true">' +
          '<img class="rf-landscape" data-footer-speed="0.12" src="' + ProtoFx.asset('distant-world.webp') + '" alt="" decoding="async">' +
          '<div class="rf-mist" data-footer-speed="0.19"></div>' +
          '<img class="rf-relics rf-relics-l" data-footer-speed="-0.055" src="' + ProtoFx.asset('cliff-left.webp') + '" alt="" decoding="async">' +
          '<img class="rf-relics rf-relics-r" data-footer-speed="-0.055" src="' + ProtoFx.asset('cliff-right.webp') + '" alt="" decoding="async">' +
        '</div>' +
        '<section class="rf-finale" id="join-the-hunt" aria-labelledby="rf-finale-title">' +
          '<p class="rf-marginalia">Worlds<br>live<br>better<br>in stories</p>' +
          '<div class="rf-copy">' +
            '<h2 id="rf-finale-title"><img src="' + LOGO() + '" alt="Mythic Spellbook" width="1000" height="1000" loading="eager" fetchpriority="high" onerror="this.parentNode.classList.add(\'rf-logo-failed\')"><span class="rf-wordmark">Mythic Spellbook</span></h2>' +
            '<p class="rf-invitation">A brighter tomorrow<br>through greater stories</p>' +
            '<a class="rf-enter" data-rf-ext="play" href="' + esc(playUrl()) + '">Enter the realm <span aria-hidden="true">↗</span></a>' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function directoryHTML(footer) {
    var cols = columns(footer).map(function (c) {
      return '<nav aria-label="' + esc(c.title) + '"><h3>' + esc(c.title) + '</h3><ul>' +
        c.items.map(function (i) { return '<li>' + link(i) + '</li>'; }).join('') + '</ul></nav>';
    }).join('');
    return '' +
      '<div class="rf-rule" aria-hidden="true"><span>◇</span></div>' +
      '<div class="rf-directory">' + cols +
        '<div class="rf-join"><h3>Join the realm</h3><p>Get the latest stories, expansions,<br>and exclusive content.</p>' +
          '<form class="rf-signup" novalidate>' +
            '<label class="rf-sr" for="rf-signup-email">Email address</label>' +
            '<input id="rf-signup-email" type="email" name="email" autocomplete="email" placeholder="Your email" required>' +
            '<button type="submit">Sign up</button>' +
          '</form>' +
          '<p class="rf-signup-done" role="status" aria-live="polite"></p>' +
          '<a class="rf-news-link" href="' + esc(ROOT()) + '" data-rf-go="news" data-rf-sec="">Read the latest news <span aria-hidden="true">→</span></a>' +
          '<p class="rf-oath">Secure · Contain · Survive</p></div>' +
      '</div>' +
      '<div class="rf-rule rf-rule-bottom" aria-hidden="true"><span>◇</span></div>';
  }

  // Keep Play / Login hrefs in sync with the bridge (it can appear after first paint).
  function syncHrefs(scope) {
    each(scope.querySelectorAll('[data-rf-ext=play]'), function (a) { if (a.getAttribute('href') !== playUrl()) a.setAttribute('href', playUrl()); });
    each(scope.querySelectorAll('[data-rf-ext=login]'), function (a) { if (a.getAttribute('href') !== loginUrl()) a.setAttribute('href', loginUrl()); });
  }

  // One delegated click handler for every in-app directory link.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[data-rf-go]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goTo(a.getAttribute('data-rf-go'), a.getAttribute('data-rf-sec'));
  });

  // "Join the realm" newsletter: the same signup as the site's own Newsletter form (GaSignup):
  // kept in localStorage.ms_newsletter and mirrored best-effort to Supabase newsletter_signups.
  document.addEventListener('submit', function (e) {
    var form = e.target && e.target.closest && e.target.closest('form.rf-signup');
    if (!form) return;
    e.preventDefault();
    var input = form.querySelector('input[type=email]');
    var email = String(input && input.value || '').trim();
    var msg = form.parentNode.querySelector('.rf-signup-done');
    if (email.indexOf('@') < 1) { if (msg) msg.textContent = 'Enter a valid email address.'; if (input) input.focus(); return; }
    try {
      var list = JSON.parse(localStorage.getItem('ms_newsletter') || '[]');
      if (list.indexOf(email) < 0) { list.push(email); localStorage.setItem('ms_newsletter', JSON.stringify(list)); }
    } catch (err) {}
    try {
      var c = window.msSupabase ? window.msSupabase() : null;
      if (c) c.from('newsletter_signups').insert({ email: email }).then(function () {}, function () {});
    } catch (err) {}
    form.hidden = true;
    if (msg) msg.textContent = "You're on the list \u2014 welcome, Survivor.";
  });

  // Parallax for the realm backdrop layers (the prototype's [data-footer-speed] contract):
  // each layer drifts by (realm centre - viewport centre) * speed. Off for reduced motion.
  var ticking = false;
  function onscreenFlag() {
    var vh = window.innerHeight || 800, on = false;
    each(document.querySelectorAll('.rf-realm, footer[data-pfx=footer]'), function (el) {
      var r = el.getBoundingClientRect(); if (r.top < vh && r.bottom > 0 && r.height) on = true;
    });
    if (document.documentElement.classList.contains('rf-finale-onscreen') !== on)
      document.documentElement.classList.toggle('rf-finale-onscreen', on);
  }
  function parallax() {
    ticking = false;
    onscreenFlag();
    if (ProtoFx.reduced) return;
    var vh = window.innerHeight || 800;
    each(document.querySelectorAll('.rf-realm'), function (realm) {
      var r = realm.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var d = (r.top + r.height / 2) - vh / 2;
      each(realm.querySelectorAll('[data-footer-speed]'), function (el) {
        var s = parseFloat(el.getAttribute('data-footer-speed')) || 0;
        el.style.transform = 'translate3d(0,' + (d * s).toFixed(1) + 'px,0)';
      });
    });
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }
  if (!ProtoFx.reduced) document.documentElement.classList.add('rf-parallax-active');
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);

  // The prototype's .footer-colophon: "© …" left, "Imagination endures" centred, "Back to top ↑" right.
  // The React footer's own © line and links stay; the sign-off and back-to-top join them.
  function colophon(footer) {
    var row = footer.querySelector(':scope > div.max-w-6xl');
    if (!row) return;
    row.classList.add('rf-colophon');
    var links = row.lastElementChild;
    if (!row.querySelector(':scope > .rf-signoff') && links) {
      var p = document.createElement('p');
      p.className = 'rf-signoff'; p.setAttribute('data-pfx-owned', ''); p.textContent = 'Imagination endures';
      row.insertBefore(p, links);
    }
    // The site's own Discord / Privacy / Terms links have no destination yet (href="#" on main too):
    // mark them as not-yet-available instead of leaving silent dead links.
    if (links) each(links.querySelectorAll('a[href="#"]'), function (a) {
      if (a.classList.contains('rf-soon')) return;
      a.classList.add('rf-soon'); a.setAttribute('aria-disabled', 'true'); a.setAttribute('title', 'Coming soon');
      a.removeAttribute('href');
    });
    if (links && !links.querySelector('.rf-top')) {
      var a = document.createElement('a');
      a.className = 'rf-top'; a.href = '#top'; a.setAttribute('data-pfx-owned', '');
      a.innerHTML = 'Back to top <span aria-hidden="true">↑</span>';
      links.appendChild(a);
    }
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a.rf-top');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: ProtoFx.reduced ? 'auto' : 'smooth' });
  });

  // While the finale is on screen, flag it on <html> so fixed hero chrome (the covers' hint) stays hidden.
  var io = null, watched = [];
  function watchFinale() {
    if (!('IntersectionObserver' in window)) return;
    if (!io) io = new IntersectionObserver(function () {
      var on = watched.some(function (el) {
        if (!document.contains(el)) return false;
        var r = el.getBoundingClientRect(); return r.top < (window.innerHeight || 800) && r.bottom > 0;
      });
      document.documentElement.classList.toggle('rf-finale-onscreen', on);
    });
    watched = watched.filter(function (el) { if (document.contains(el)) return true; io.unobserve(el); return false; });
    each(document.querySelectorAll('.rf-realm, footer[data-pfx=footer]'), function (el) {
      if (watched.indexOf(el) < 0) { watched.push(el); io.observe(el); }
    });
  }

  ProtoFx.on('realm-footer', function () {
    ProtoFx.slots('finale').forEach(function (slot) {
      if (!slot.querySelector(':scope > .rf-realm')) slot.innerHTML = finaleHTML();
      syncHrefs(slot);
    });
    each(document.querySelectorAll('footer[data-pfx=footer]'), function (footer) {
      var top = footer.querySelector(':scope > .rf-footer-top');
      if (!top) {
        top = document.createElement('div');
        top.className = 'rf-footer-top';
        top.setAttribute('data-pfx-owned', '');
        top.innerHTML = directoryHTML(footer);
        footer.insertBefore(top, footer.firstChild);
      }
      syncHrefs(top);
      colophon(footer);
    });
    watchFinale();
    req();
  });
})();
