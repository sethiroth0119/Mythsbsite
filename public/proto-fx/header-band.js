/* proto-fx piece: header-band — behaviour for the prototype header band on the real Navbar.
   The band itself is pure CSS (header-band.css). This script only:
     1. toggles html.pfx-hb-compact when the page is scrolled or when an inner page is showing
        (inner pages start their content ~90px down, so the full 120px rest band would cover it);
     2. marks the link for the current page with data-hb-active (gold, like the prototype's hover);
     3. drops the emoji prefixes from link labels (the prototype header is text-only).
   Every button keeps its own React onClick / href; nothing here navigates. */
(function () {
  if (!window.ProtoFx) return;
  var root = document.documentElement;
  var EMOJI = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?\s*/u;

  function page() {
    var b = window.MSBridge;
    return (b && b.page) || 'home';
  }
  function updateCompact() {
    var compact = page() !== 'home' || (window.scrollY || 0) > 40;
    root.classList.toggle('pfx-hb-compact', compact);
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; updateCompact(); });
  }, { passive: true });

  function isActive(el) {
    // The Navbar marks the current page with a standalone `text-white` class, the
    // #e8d5a8 inline colour (Broadcast / RMT / Shop) or the gold hub border (Profile).
    if (el.classList.contains('text-white')) return true;
    var c = el.style && el.style.color;
    if (el.tagName === "BUTTON" && c && /232,\s*213,\s*168/.test(c)) return true;
    if (el.classList.contains('border-[#c9a86a]')) return true;
    return false;
  }

  // Phones: the prototype header carries only crest + CTA + menu glyph, so the bar's
  // Login / Profile button is hidden by CSS at <=760px and mirrored as the last entry of the
  // drop panel. The mirror just clicks the real React button (same onSignIn / onShowHub
  // handler) and then closes the panel through the real hamburger.
  function syncAccount(nav) {
    var bar = nav.querySelector(':scope > div:first-child > div:last-child');
    var list = nav.querySelector(':scope > div:nth-child(2) > div');
    if (!bar || !list) return;
    var real = null, kids = bar.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.tagName !== 'BUTTON' || k.hasAttribute('aria-expanded')) continue;
      if (k.getAttribute('title') && /City Nodes/.test(k.getAttribute('title'))) continue; // Shop (already in panel)
      real = k;
    }
    var mirror = list.querySelector('[data-hb-account]');
    if (!real) { if (mirror) mirror.remove(); return; }
    var label = real.getAttribute('title') ? 'Profile' : 'Login';
    var full = real.querySelector('span');
    if (full && full.textContent && full.textContent !== 'Me') label = full.textContent;
    if (!mirror) {
      mirror = document.createElement('button');
      mirror.type = 'button';
      mirror.setAttribute('data-hb-account', '');
      mirror.setAttribute('data-pfx-owned', '');
      mirror.className = 'text-left';
      mirror.addEventListener('click', function () {
        var target = mirror._hbReal;
        var burger = nav.querySelector('button[aria-expanded="true"]');
        if (target) target.click();
        if (burger) burger.click();
      });
      list.appendChild(mirror);
    }
    mirror._hbReal = real;
    if (mirror.textContent !== label) mirror.textContent = label;
    if (real.hasAttribute('data-hb-active')) mirror.setAttribute('data-hb-active', '');
    else mirror.removeAttribute('data-hb-active');
  }

  ProtoFx.on('header-band', function () {
    updateCompact();
    var nav = document.querySelector('nav[data-pfx="nav"]');
    if (!nav) return;
    syncAccount(nav);
    var items = nav.querySelectorAll('a, button');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.hasAttribute('aria-expanded')) continue;
      var on = isActive(el);
      if (on && !el.hasAttribute('data-hb-active')) el.setAttribute('data-hb-active', '');
      else if (!on && el.hasAttribute('data-hb-active')) el.removeAttribute('data-hb-active');
      // Strip a leading emoji from single-text-node labels ("🗺 Lore" -> "Lore").
      var t = el.firstChild;
      if (t && t.nodeType === 3 && el.childNodes.length === 1 && EMOJI.test(t.nodeValue)) {
        t.nodeValue = t.nodeValue.replace(EMOJI, '');
      }
    }
  });
})();
