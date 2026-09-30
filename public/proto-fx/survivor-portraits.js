/* proto-fx piece: survivor-portraits — replaces the React "Choose Your Survivor" filter row + grid
   inside #champions with the prototype's .survivor-filters / .survivor-roster markup, built from the
   site's real HEROES (MSBridge.heroes). Portraits open the real HeroModal via MSBridge.openHero.
   If the bridge or heroes are missing the React originals stay visible (nothing is hidden). */
(function () {
  if (!window.ProtoFx) return;
  var ID = 'survivor-portraits';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function findReact(section) {
    // The React grid: the .grid whose buttons carry the hero names; filter row = its previous sibling with buttons.
    var grids = section.querySelectorAll('.grid');
    for (var i = 0; i < grids.length; i++) {
      var g = grids[i];
      if (g.closest('[data-pfx-owned]')) continue;
      if (g.querySelector(':scope > button img, :scope > button')) {
        var f = g.previousElementSibling;
        while (f && !f.querySelector('button')) f = f.previousElementSibling;
        return { grid: g, filters: f };
      }
    }
    return null;
  }

  function resultsText(n, cls) {
    var noun = n === 1 ? 'survivor' : 'survivors';
    return cls === 'All' ? n + ' ' + noun + ' in the archive' : n + ' ' + cls + ' ' + noun + ' in the archive';
  }

  function build(heroes, bridge) {
    var classes = ['All'];
    heroes.forEach(function (h) { if (h.faction && classes.indexOf(h.faction) < 0) classes.push(h.faction); });
    var wrap = document.createElement('div');
    wrap.className = 'pfx-sv';
    wrap.setAttribute('data-pfx-owned', ID);
    var html = '<div class="survivor-filters" role="group" aria-label="Filter survivors by class">';
    classes.forEach(function (c, i) {
      var n = c === 'All' ? heroes.length : heroes.filter(function (h) { return h.faction === c; }).length;
      html += '<button type="button" data-survivor-filter="' + esc(c) + '" aria-pressed="' + (i === 0) + '">' + esc(c) + ' <span>' + n + '</span></button>';
    });
    html += '</div><div class="survivor-roster">';
    heroes.forEach(function (h, i) {
      var els = (h.elements || []).join(' · ');
      html += '<button type="button" class="survivor-portrait" data-survivor="' + esc(h.id) + '" data-survivor-index="' + i +
        '" data-survivor-class="' + esc(h.faction) + '" aria-label="Explore ' + esc(h.name) + '">' +
        '<span class="survivor-photo' + (h.image ? '' : ' is-missing') + '"><span class="survivor-initial" aria-hidden="true">' + esc((h.name || '?').charAt(0)) + '</span>' +
        (h.image ? '<img src="' + esc(h.image) + '" alt="' + esc(h.name) + '" loading="lazy">' : '') +
        (h.rarity ? '<span class="survivor-rarity">' + esc(h.rarity) + '</span>' : '') +
        (els ? '<span class="survivor-elements">' + esc(els) + '</span>' : '') +
        '</span><span class="survivor-identity"><span class="survivor-label">' + esc(h.faction) + '</span>' +
        '<strong>' + esc(h.name) + '</strong><em>' + esc(h.title) + '</em>' +
        '<span class="survivor-open">Explore survivor <span aria-hidden="true">↗</span></span></span></button>';
    });
    html += '</div><p class="survivor-results" aria-live="polite">' + resultsText(heroes.length, 'All') + '</p>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.survivor-photo img').forEach(function (img) {
      img.addEventListener('error', function () { img.parentNode.classList.add('is-missing'); });
    });
    wrap.addEventListener('click', function (e) {
      var fb = e.target.closest('[data-survivor-filter]');
      if (fb) {
        var cls = fb.getAttribute('data-survivor-filter'), n = 0;
        wrap.querySelectorAll('[data-survivor-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === fb)); });
        wrap.querySelectorAll('.survivor-portrait').forEach(function (p) {
          var show = cls === 'All' || p.getAttribute('data-survivor-class') === cls;
          p.hidden = !show; if (show) n++;
        });
        wrap.querySelector('.survivor-results').textContent = resultsText(n, cls);
        return;
      }
      var pb = e.target.closest('.survivor-portrait');
      if (pb) {
        var b = ProtoFx.bridge() || bridge;
        var list = (b && b.heroes) || heroes;
        var h = list[+pb.getAttribute('data-survivor-index')] || heroes[+pb.getAttribute('data-survivor-index')];
        if (b && typeof b.openHero === 'function') b.openHero(h);
      }
    });
    return wrap;
  }

  ProtoFx.on(ID, function () {
    var section = document.getElementById('champions');
    if (!section) return;
    var existing = section.querySelector('.pfx-sv[data-pfx-owned]');
    var react = findReact(section);
    if (!react) return;
    var bridge = ProtoFx.bridge();
    if (!existing) {
      if (!bridge || !bridge.heroes || !bridge.heroes.length || typeof bridge.openHero !== 'function') return;
      existing = build(bridge.heroes, bridge);
      var anchor = react.filters || react.grid;
      anchor.parentNode.insertBefore(existing, anchor);
    }
    if (react.grid.getAttribute('data-pfx-sv-hide') == null) react.grid.setAttribute('data-pfx-sv-hide', '');
    if (react.filters && react.filters.getAttribute('data-pfx-sv-hide') == null) react.filters.setAttribute('data-pfx-sv-hide', '');
  });
})();
