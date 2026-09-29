/* proto-fx piece: archive-gallery — lays out the Card List page and the Deck Builder "Card Database" as the
   prototype's custom gallery (section#all-cards: .section-head + 3-column .custom-grid of .custom-card covers).
   Everything React renders stays React's: search, type/rarity filters, faction filters, Coming Drops,
   "+ Load card" and the detail modals keep working untouched. This script only
     - marks the real nodes with data-pfx-archive* attributes (the CSS does the layout), and
     - injects one owned section head (eyebrow "The Spellbook · N cards", headline, subtitle) in place of
       the old header, which the CSS hides.
   Idempotent: ProtoFx runs it after every render / DOM change. */
(function () {
  if (!window.ProtoFx) return;

  var RARITY = { Common: '#9aa3b2', Uncommon: '#5aa855', Rare: '#4a90d9', Epic: '#a855f7', Legendary: '#f0a030', Mythic: '#e0457b', Starter: '#78716c' };
  var seen = { cardlist: 0, deck: 0 };
  var lastPage = null;

  function mark(el, attr, val) {
    if (el && el.getAttribute(attr) !== String(val)) el.setAttribute(attr, val);
  }
  function uniqueNames(scope, sel) {
    var names = {};
    Array.prototype.forEach.call(scope.querySelectorAll(sel), function (n) {
      var k = (n.getAttribute('data-card-name') || '').toLowerCase();
      if (k) names[k] = 1;
    });
    return Object.keys(names).length;
  }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }

  // One owned section head inside the React header wrapper (first child); the wrapper's own
  // children are hidden by CSS. Returns the head so the count can be refreshed.
  function head(wrap, title, subtitle) {
    mark(wrap, 'data-pfx-archive-headwrap', '');
    var h = wrap.querySelector(':scope > [data-pfx-archive-head]');
    if (!h) {
      h = document.createElement('div');
      h.setAttribute('data-pfx-owned', '');
      h.setAttribute('data-pfx-archive-head', '');
      h.innerHTML = '<p class="pfx-ag-eyebrow"></p><h2></h2><p class="pfx-ag-subtitle"></p>';
      wrap.insertBefore(h, wrap.firstChild);
    }
    setText(h.querySelector('h2'), title);
    setText(h.querySelector('.pfx-ag-subtitle'), subtitle);
    return h;
  }
  function eyebrow(h, n) {
    setText(h.querySelector('.pfx-ag-eyebrow'), 'The Spellbook · ' + n + ' card' + (n === 1 ? '' : 's'));
  }

  // ---------- Card List page ----------
  function cardList(br) {
    var search = document.querySelector('input[placeholder^="Search cards"]');
    if (!search) return false;
    var section = search.closest('section');
    if (!section || section.closest('#gallery')) return false;
    mark(section, 'data-pfx-archive', 'cardlist');
    var inner = section.querySelector(':scope > .max-w-7xl');
    if (!inner) return true;

    var filters = search.parentElement;
    mark(filters, 'data-pfx-archive-filters', '');
    Array.prototype.forEach.call(filters.querySelectorAll('button'), function (b) {
      var t = (b.textContent || '').trim();
      if (RARITY[t]) {
        mark(b, 'data-pfx-rarity', t);
        if (b.style.getPropertyValue('--pfx-rc') !== RARITY[t]) b.style.setProperty('--pfx-rc', RARITY[t]);
        // React paints the chosen rarity with an inline background.
        var on = !!(b.style.background || b.style.backgroundColor);
        if (on) mark(b, 'data-pfx-on', ''); else if (b.hasAttribute('data-pfx-on')) b.removeAttribute('data-pfx-on');
      }
    });

    var count = filters.nextElementSibling;
    if (count && /card/.test(count.textContent || '')) mark(count, 'data-pfx-archive-count', '');

    Array.prototype.forEach.call(inner.querySelectorAll('div.grid'), function (g) {
      if (!g.querySelector('[data-pfx="card-thumb"]')) return;
      var coming = g.parentElement && g.parentElement !== inner;
      mark(g, 'data-pfx-archive-grid', coming ? 'coming' : 'main');
      if (coming) mark(g.parentElement, 'data-pfx-archive-coming', '');
    });

    var n = uniqueNames(inner, '[data-pfx="card-thumb"]');
    seen.cardlist = Math.max(seen.cardlist, n);

    var wrap = inner.querySelector(':scope > .text-center');
    if (wrap) {
      var h = head(wrap, 'The archive is growing.',
        'Explore ' + seen.cardlist + ' artworks from the Spellbook. Search, filter, and select a card to inspect its detail, depth, and light.');
      eyebrow(h, seen.cardlist);
    }
    return true;
  }

  // ---------- Deck Builder: Card Database ----------
  function deckGallery(br) {
    var host = document.getElementById('gallery');
    var section = host && host.querySelector(':scope > section');
    if (!section) return false;
    mark(section, 'data-pfx-archive', 'deck');
    var inner = section.querySelector(':scope > .max-w-7xl');
    if (!inner) return true;
    var kids = inner.children;
    var wrap = null, factions = null, grid = null;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (!wrap && k.classList.contains('text-center')) wrap = k;
      else if (!factions && k.querySelector(':scope > button')) factions = k;
      else if (k.querySelector('[data-pfx="card"]') || (factions && k !== factions && k !== wrap)) grid = k;
    }
    if (factions) mark(factions, 'data-pfx-archive-factions', '');
    if (grid) {
      mark(grid, 'data-pfx-archive-grid', 'deck');
      Array.prototype.forEach.call(grid.children, function (cell) {
        var c = cell.querySelector('[data-pfx="card"]');
        mark(cell, 'data-pfx-archive-cell', '');
        if (c) mark(cell, 'data-pfx-name', c.getAttribute('data-card-name') || '');
      });
    }
    var n = grid ? uniqueNames(grid, '[data-pfx="card"]') : 0;
    seen.deck = Math.max(seen.deck, n, (br && br.cards) ? br.cards.length : 0);
    if (wrap) {
      var sub = wrap.querySelector(':scope > p');
      var h = head(wrap, 'Card Database',
        (sub && sub.textContent.trim()) || 'Every card recovered from the field. Hover to inspect. Click to add to your loadout.');
      eyebrow(h, seen.deck);
    }
    return true;
  }

  ProtoFx.on('archive-gallery', function () {
    var br = ProtoFx.bridge();
    var page = br && br.page;
    if (page !== lastPage) { seen.cardlist = 0; seen.deck = 0; lastPage = page; }
    cardList(br);
    deckGallery(br);
  });
})();
