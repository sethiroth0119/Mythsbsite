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
  var LOGO = './assets/artwork/Mythic%20Spellbook%20Gold%20Logo.png';

  function B() { return window.MSBridge || null; }
  function playUrl() { var b = B(); return (b && b.playUrl) || FALLBACK_PLAY; }
  function loginUrl() { var b = B(); return (b && b.loginUrl) || FALLBACK_LOGIN; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // In-app destinations: `go` names a MSBridge.go.* screen; `sec` scrolls to a home-page section.
  function goTo(go, sec) {
    var b = B(); if (!b) return;
    if (sec) {
      var wasHome = b.page === 'home';
      if (b.scrollTo) b.scrollTo(sec);
      if (!wasHome) { // the home page needs a render or two before the section exists
        var tries = 0;
        (function retry() {
          var el = document.getElementById(sec);
          if (el) { el.scrollIntoView({ behavior: ProtoFx.reduced ? 'auto' : 'smooth' }); return; }
          if (++tries < 25) setTimeout(retry, 100);
        })();
      }
      return;
    }
    if (b.go && typeof b.go[go] === 'function') b.go[go]();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function link(item) {
    if (item.href) return '<a href="' + esc(item.href) + '"' + (item.ext ? ' data-rf-ext="' + item.ext + '"' : '') + '>' + esc(item.label) + '</a>';
    return '<a href="#" data-rf-go="' + (item.go || '') + '" data-rf-sec="' + (item.sec || '') + '">' + esc(item.label) + '</a>';
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
        { label: 'Card gallery', sec: 'gallery' },
        { label: 'Survivors', go: 'survivor' },
        { label: 'Gameplay', sec: 'play' },
        { label: 'News & updates', go: 'news' }
      ] },
      { title: 'Your journey', items: [
        { label: 'Choose your path', sec: 'factions' },
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
      ] }
    ];
  }

  function finaleHTML() {
    return '' +
      '<div class="rf-realm" data-pfx-owned>' +
        '<div class="rf-backdrop" aria-hidden="true">' +
          '<img class="rf-landscape" data-footer-speed="0.12" src="' + ProtoFx.asset('distant-world.webp') + '" alt="" loading="lazy" decoding="async">' +
          '<div class="rf-mist" data-footer-speed="0.19"></div>' +
          '<img class="rf-relics rf-relics-l" data-footer-speed="-0.055" src="' + ProtoFx.asset('cliff-left.webp') + '" alt="" loading="lazy" decoding="async">' +
          '<img class="rf-relics rf-relics-r" data-footer-speed="-0.055" src="' + ProtoFx.asset('cliff-right.webp') + '" alt="" loading="lazy" decoding="async">' +
        '</div>' +
        '<section class="rf-finale" id="join-the-hunt" aria-labelledby="rf-finale-title">' +
          '<p class="rf-marginalia">Worlds<br>live<br>better<br>in stories</p>' +
          '<div class="rf-copy">' +
            '<h2 id="rf-finale-title"><img src="' + LOGO + '" alt="Mythic Spellbook" width="1000" height="1000" loading="lazy" decoding="async"></h2>' +
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
          '<a class="rf-news" href="#" data-rf-go="news" data-rf-sec="">News from the realm <span aria-hidden="true">→</span></a>' +
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

  // Parallax for the realm backdrop layers (the prototype's [data-footer-speed] contract):
  // each layer drifts by (realm centre - viewport centre) * speed. Off for reduced motion.
  var ticking = false;
  function parallax() {
    ticking = false;
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
  if (!ProtoFx.reduced) {
    document.documentElement.classList.add('rf-parallax-active');
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
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
    });
    req();
  });
})();
