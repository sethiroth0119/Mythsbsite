/* proto-fx piece: links — every button goes to the right place.
   1) A shared, declarative router any piece (or the site) can use instead of wiring its own:
        data-pfx-go="news|survivor|cardlist|deckbuilder|hub|home|backing|rmt|community|shop|signIn|lore"
                                      -> MSBridge.go[...]()          (the real screen)
        data-pfx-href="play|login|game|lore"
                                      -> sets the real href (PLAY_URL ?mode=signup, LOGIN_URL ?mode=signin,
                                         GAME_URL, ./lore/) so the link also works with middle-click / new tab
        data-pfx-scroll="gallery"     -> MSBridge.scrollTo(id)  (switches to home first when needed)
        data-pfx-card="Card Name"     -> MSBridge.openCard(card)   (the real CardModal)
        data-pfx-hero="Hero Name"     -> MSBridge.openHero(hero)   (the real HeroModal)
      Handlers that already called preventDefault() win, so a piece's own wiring is never overridden.
   2) An overlay guard: after each render / scroll it hit-tests the centre of every on-screen button
      and link. If a proto-fx decorative layer (inside [data-pfx-owned], with nothing clickable in it)
      is on top, that layer gets data-pfx-passthru (pointer-events:none) so the real button works.
   3) The prototype's "Skip to the cards" link, and scroll-padding sized to the real navbar.
   ProtoFx.links.audit() returns the buttons whose centre is still covered (used by the critic). */
(function () {
  if (!window.ProtoFx) return;
  var B = function () { return window.MSBridge || null; };
  var CLICKABLE = 'a[href],button,input,select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"]),[data-pfx-go],[data-pfx-card],[data-pfx-hero],[data-pfx-scroll]';
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };

  function urlFor(kind) {
    var b = B();
    if (kind === 'play' || kind === 'signup') return (b && b.playUrl) || 'https://playmythicspellbook.com/?mode=signup';
    if (kind === 'login' || kind === 'signin') return (b && b.loginUrl) || 'https://playmythicspellbook.com/?mode=signin';
    if (kind === 'game') return (b && b.gameUrl) || 'https://playmythicspellbook.com/';
    if (kind === 'lore') return './lore/';
    return null;
  }
  function findCard(name) {
    var b = B(); if (!b) return null; var n = norm(name);
    var pools = [b.cards || [], b.communityCards || []];
    for (var p = 0; p < pools.length; p++) for (var i = 0; i < pools[p].length; i++) {
      var c = pools[p][i]; if (c && norm(c.name) === n) return b.applyOverride ? b.applyOverride(c) : c;
    }
    return null;
  }
  function findHero(name) {
    var b = B(); if (!b) return null; var n = norm(name), list = b.heroes || [];
    for (var i = 0; i < list.length; i++) if (list[i] && (norm(list[i].name) === n || norm(list[i].id) === n)) return list[i];
    return null;
  }
  function scrollToId(id) {
    var b = B();
    if (b && b.scrollTo) { b.scrollTo(id); return true; }
    var el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: ProtoFx.reduced ? 'auto' : 'smooth' }); return true; }
    return false;
  }

  // ---- 1) declarative router (bubble phase on document: pieces' own handlers run first) --------
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var t = e.target && e.target.closest ? e.target.closest('[data-pfx-go],[data-pfx-href],[data-pfx-scroll],[data-pfx-card],[data-pfx-hero]') : null;
    if (!t) return;
    var b = B(), v;
    if ((v = t.getAttribute('data-pfx-href'))) {
      var u = urlFor(v); if (!u) return;
      if (t.tagName === 'A') { if (t.getAttribute('href') !== u) t.setAttribute('href', u); return; } // let the browser follow it (keeps ctrl/middle-click)
      e.preventDefault(); if (e.ctrlKey || e.metaKey) window.open(u, '_blank', 'noopener'); else location.href = u; return;
    }
    if ((v = t.getAttribute('data-pfx-go'))) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      var fn = b && b.go && b.go[v];
      if (fn) { e.preventDefault(); fn(); } else if (v === 'lore') { e.preventDefault(); location.href = './lore/'; }
      return;
    }
    if ((v = t.getAttribute('data-pfx-scroll'))) { if (scrollToId(v)) e.preventDefault(); return; }
    if ((v = t.getAttribute('data-pfx-card'))) { var c = findCard(v); if (c && b && b.openCard) { e.preventDefault(); b.openCard(c); } return; }
    if ((v = t.getAttribute('data-pfx-hero'))) { var h = findHero(v); if (h && b && b.openHero) { e.preventDefault(); b.openHero(h); } return; }
  }, false);
  // Enter / Space on non-button routers (e.g. a div with tabindex) behave like a click.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target; if (!t || !t.matches || t.matches('a,button,input,textarea,select,summary')) return;
    if (!t.matches('[data-pfx-go],[data-pfx-scroll],[data-pfx-card],[data-pfx-hero],[data-pfx-href]')) return;
    e.preventDefault(); t.click();
  });

  // Keep real hrefs on router anchors so hover-preview / new-tab show the true destination.
  function syncHrefs() {
    var els = document.querySelectorAll('a[data-pfx-href]');
    for (var i = 0; i < els.length; i++) { var u = urlFor(els[i].getAttribute('data-pfx-href')); if (u && els[i].getAttribute('href') !== u) els[i].setAttribute('href', u); }
    var gs = document.querySelectorAll('[data-pfx-go]:not(a):not(button),[data-pfx-card]:not(a):not(button),[data-pfx-hero]:not(a):not(button),[data-pfx-scroll]:not(a):not(button)');
    for (var j = 0; j < gs.length; j++) { if (!gs[j].hasAttribute('tabindex')) gs[j].setAttribute('tabindex', '0'); if (!gs[j].hasAttribute('role')) gs[j].setAttribute('role', 'button'); }
  }

  // ---- 2) overlay guard ------------------------------------------------------------------------
  function isVisible(el, r) {
    if (r.width < 3 || r.height < 3) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05;
  }
  function describe(n) {
    if (!n || !n.tagName) return String(n);
    var c = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + c : '');
  }
  function navBottom() {
    var nav = document.querySelector('[data-pfx="nav"]');
    if (!nav) return 0;
    var r = nav.getBoundingClientRect();
    return getComputedStyle(nav).position === 'fixed' || getComputedStyle(nav).position === 'sticky' ? Math.max(0, r.bottom) : 0;
  }
  function scan(fix) {
    var out = [], vh = innerHeight, vw = innerWidth, top = navBottom();
    var els = document.querySelectorAll('a[href],button,[role=button],[data-pfx-go],[data-pfx-card],[data-pfx-hero]');
    for (var i = 0; i < els.length && i < 600; i++) {
      var e = els[i], r = e.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 1 || x > vw - 1 || y < 1 || y > vh - 1) continue;
      if (!isVisible(e, r)) continue;
      var hit = document.elementFromPoint(x, y);
      if (!hit || hit === e || e.contains(hit)) continue;
      // The fixed navbar legitimately covers content scrolled beneath it; its own open menu too.
      if (y < top && hit.closest('[data-pfx="nav"]') && !e.closest('[data-pfx="nav"]')) continue;
      // A site modal / real dialog on top is intended (e.g. CardModal open).
      var owned = hit.closest('[data-pfx-owned]');
      var layer = null;
      if (owned && !owned.contains(e)) {
        // Climb to the highest ancestor inside the owned container that still has nothing clickable.
        var n = hit;
        while (n && n !== document.body && !n.contains(e) && !(n.matches && n.matches(CLICKABLE)) && !n.querySelector(CLICKABLE)) {
          layer = n; if (n === owned) break; n = n.parentElement;
        }
      } else if (owned && owned.contains(e)) {
        // Decorative sibling inside the same piece container (e.g. a glow span above a button).
        var m = hit;
        while (m && !m.contains(e) && !(m.matches && m.matches(CLICKABLE)) && !m.querySelector(CLICKABLE)) { layer = m; m = m.parentElement; }
      }
      // Never punch through a real dialog / full-screen overlay (inspector, boot loader): those are
      // meant to be on top. Full-screen layers only count as decorative when aria-hidden.
      if (layer && (hit.closest('dialog,[role=dialog],[aria-modal=true]') || isScreenCover(layer))) layer = null;
      if (fix && layer && !layer.hasAttribute('data-pfx-passthru')) {
        layer.setAttribute('data-pfx-passthru', '');
        var again = document.elementFromPoint(x, y);
        if (again && (again === e || e.contains(again))) { out.push({ text: label(e), fixed: describe(layer) }); continue; }
      }
      out.push({ text: label(e), el: describe(e), coveredBy: describe(hit), piece: owned ? (owned.getAttribute('data-pfx-owned') || describe(owned)) : null, y: Math.round(y) });
    }
    return out;
  }
  function isScreenCover(layer) {
    var r = layer.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.6) return false;
    var n = layer;
    while (n && n !== document.body) { if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return false; n = n.parentElement; }
    return true;
  }
  function label(e) { return (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48); }
  var warned = {};
  function guard() {
    var res = scan(true);
    for (var i = 0; i < res.length; i++) {
      var k = res[i].text + '|' + (res[i].coveredBy || res[i].fixed);
      if (warned[k]) continue; warned[k] = 1;
      if (res[i].fixed) console.info('[proto-fx] links: made decorative ' + res[i].fixed + ' click-through for "' + res[i].text + '"');
    }
  }
  var st = null;
  addEventListener('scroll', function () { if (!st) st = setTimeout(function () { st = null; guard(); }, 250); }, { passive: true });
  addEventListener('resize', function () { setPad(); guard(); });

  // ---- 3) skip link + scroll padding -----------------------------------------------------------
  function setPad() {
    var nav = document.querySelector('[data-pfx="nav"]'); if (!nav) return;
    var h = Math.round(nav.getBoundingClientRect().height);
    // Only the bar itself (not an open mobile menu) counts.
    var bar = nav.firstElementChild && nav.firstElementChild.getBoundingClientRect().height;
    if (bar && bar < h) h = Math.round(bar + (nav.firstElementChild.getBoundingClientRect().top - nav.getBoundingClientRect().top));
    if (h > 20 && h < 200) document.documentElement.style.setProperty('--pfx-links-pad', (h + 16) + 'px');
  }
  function skipLink() {
    if (document.querySelector('.pfx-skip')) return;
    var a = document.createElement('a');
    a.className = 'pfx-skip'; a.href = '#gallery'; a.textContent = 'Skip to the cards';
    a.setAttribute('data-pfx-owned', 'links');
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var b = B(), target = null;
      if (!b || b.page === 'home') {
        var slot = document.querySelector('[data-pfx-slot="home-collection"]');
        target = (slot && slot.children.length && slot) || document.getElementById('gallery') || document.getElementById('home');
      }
      if (target) {
        target.scrollIntoView({ behavior: ProtoFx.reduced ? 'auto' : 'smooth', block: 'start' });
        var f = target.querySelector('a[href],button'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, ProtoFx.reduced ? 0 : 500);
      } else if (b && b.go && b.go.cardlist) b.go.cardlist();
    });
    document.body.insertBefore(a, document.body.firstChild);
  }

  // ---- 4) mobile menu closes once a destination is chosen ------------------------------------
  // The site's own menu items close it, but the logo / Login / Play in the bar (and any piece CTA
  // that switches screens) left it hanging open over the new page.
  var lastPage = null;
  function closeMenu() {
    var x = document.querySelector('[data-pfx="nav"] button[aria-label="Close menu"]');
    if (x) x.click();
  }
  addEventListener('ms:render', function (e) {
    var p = e && e.detail && e.detail.page;
    if (lastPage !== null && p && p !== lastPage) closeMenu();
    lastPage = p || lastPage;
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-pfx="nav"] a[href], [data-pfx="nav"] button') : null;
    if (a && !a.hasAttribute('aria-expanded') && !a.hasAttribute('aria-controls')) setTimeout(closeMenu, 0);
  });

  // ---- 5) Escape closes the site's own full-screen modals (CardModal, HeroModal, article...) -------
  // The prototype's inspector closes on Esc; several of the site's modals only close on a backdrop
  // click. Their backdrop is the fixed inset-0 z-[100] layer whose onClick is the real onClose, so
  // Esc clicks that same backdrop. Modals that already handle Esc have unmounted by the time we
  // look, so nothing is closed twice.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    var t = e.target;
    if (t && t.matches && t.matches('input,textarea,select,[contenteditable=""],[contenteditable=true]')) return;
    var list = document.querySelectorAll('div.fixed.inset-0[class*="z-[100]"]');
    var top = list.length ? list[list.length - 1] : null;
    if (!top) return;
    setTimeout(function () {
      if (!top.isConnected || getComputedStyle(top).display === 'none') return;
      top.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }, 60);
  });

  // ---- 6) Placeholder links (href="#" with no handler, e.g. the site's unset Discord / Privacy /
  // Terms) no longer throw the visitor back to the top of a long page. Runs last (window, bubble),
  // so any real handler that routes the click has already called preventDefault.
  window.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href="#"]') : null;
    if (a) e.preventDefault();
  });

  ProtoFx.links = {
    audit: function () { return scan(false); },
    urlFor: urlFor, findCard: findCard, findHero: findHero
  };

  ProtoFx.on('links', function () {
    if (!document.body) return;
    skipLink();
    syncHrefs();
    setPad();
    // Let React / other pieces lay out first, then hit-test.
    requestAnimationFrame(function () { setTimeout(guard, 120); });
  });
})();
