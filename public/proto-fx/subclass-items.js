/* proto-fx piece: subclass-items — the prototype's Survivor chapter blocks for subclass paths and held items.
   #subclass ("Pick Your Path. Never Look Back.")  -> .survivor-subhead + .subclass-grid .subclass-entry
                                                      + .subclass-notes + .survivor-end
   #items    ("Reshape The Battlefield")            -> .survivor-subhead + .survivor-items .survivor-item ledger
   The markup is rebuilt from the text and art React actually rendered (so every word, path, move, stat and
   quote stays the site's own), inserted as a [data-pfx-owned] child, and only then is the React original
   hidden (via [data-pfx-si] on the section). If anything can't be read, nothing is hidden. Idempotent. */
(function () {
  if (!window.ProtoFx) return;
  var ID = 'subclass-items';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function sentence(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

  // Keep inline emphasis from the React copy (bold -> <strong>, coloured spans / <em> -> <em>),
  // dropping every Tailwind class so the prototype typography applies.
  function rich(el) {
    if (!el) return '';
    var out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out += esc(n.textContent); return; }
      if (n.nodeType !== 1) return;
      var cls = n.getAttribute('class') || '';
      var inner = rich(n);
      if (n.tagName === 'STRONG' || n.tagName === 'B' || /font-bold/.test(cls)) out += '<strong>' + inner + '</strong>';
      else if (n.tagName === 'EM' || n.tagName === 'I' || n.tagName === 'SPAN') out += '<em>' + inner + '</em>';
      else out += inner;
    });
    return out;
  }

  function subhead(head, splitEm) {
    var kids = Array.prototype.slice.call(head.children);
    var eyebrow = kids[0] ? txt(kids[0]).replace(/^[—–-]\s*|\s*[—–-]$/g, '') : '';
    var h = kids[1] ? txt(kids[1]) : '';
    var hHtml = esc(h);
    if (splitEm) {
      var m = h.match(/^(.*?[.!?])\s+(.+)$/);
      if (m) hHtml = esc(m[1]) + ' <em>' + esc(m[2]) + '</em>';
    }
    var html = '<div class="survivor-subhead"><p class="eyebrow">' + esc(eyebrow) + '</p><h3>' + hHtml + '</h3>';
    head.querySelectorAll('p').forEach(function (p) {
      var cls = p.getAttribute('class') || '';
      var mod = /uppercase/.test(cls) ? ' class="survivor-subhead-motto"' : /italic/.test(cls) ? ' class="survivor-subhead-aside"' : '';
      html += '<p' + mod + '>' + rich(p) + '</p>';
    });
    return html + '</div>';
  }

  /* ---------------- #subclass ---------------- */
  function buildSubclass(section) {
    var inner = section.querySelector(':scope > .max-w-7xl');
    if (!inner) return null;
    var head = inner.querySelector(':scope > .text-center');
    var grid = inner.querySelector(':scope > .grid');
    if (!head || !grid || !grid.children.length) return null;
    var notes = inner.querySelector(':scope > .relative');

    var html = subhead(head, true) + '<div class="subclass-grid">', n = 0;
    Array.prototype.forEach.call(grid.children, function (card) {
      var img = card.querySelector('img');
      var h3 = card.querySelector('h3');
      var name = txt(h3);
      if (!img || !name) return;
      var heroEl = h3.previousElementSibling;
      var hero = txt(heroEl);
      var copy = card.querySelector(':scope > .p-4') || card.lastElementChild;
      var tag = txt(copy.querySelector(':scope > .inline-block'));
      var pitch = txt(copy.querySelector(':scope > p'));
      var movesLabel = txt(copy.querySelector(':scope > div:not(.inline-block)'));
      var moves = Array.prototype.map.call(copy.querySelectorAll('li'), function (li) { return txt(li).replace(/^▸\s*/, ''); });
      var pos = img.style.objectPosition || 'center top';
      var label = hero ? hero.replace(/'s$/i, '’s') + (/path/i.test(hero) ? '' : ' path') : '';
      n++;
      html += '<article class="subclass-entry">' +
        '<div class="subclass-art"><img src="' + esc(img.getAttribute('src')) + '" alt="' + esc(img.getAttribute('alt') || name) +
          '" loading="lazy" style="object-position:' + esc(pos) + '">' +
          '<div>' + (label ? '<span class="survivor-label">' + esc(label) + '</span>' : '') + '<h4>' + esc(name) + '</h4></div></div>' +
        '<div class="subclass-copy">' + (tag ? '<span class="survivor-label">' + esc(tag) + '</span>' : '') +
          (pitch ? '<p>' + esc(pitch) + '</p>' : '') +
          (moves.length ? '<h5>' + esc(movesLabel ? sentence(movesLabel) : 'Signature moves') + '</h5><ul>' +
            moves.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        '</div></article>';
    });
    if (!n) return null;
    html += '</div>';

    if (notes) {
      var cols = notes.querySelectorAll(':scope > .grid > div');
      if (cols.length) {
        html += '<div class="subclass-notes">';
        cols.forEach(function (c) {
          html += '<article><h4>' + esc(sentence(txt(c.firstElementChild))) + '</h4><p>' + rich(c.querySelector('p')) + '</p></article>';
        });
        html += '</div>';
      }
      var end = notes.querySelector(':scope > .border-t');
      if (end && end.children.length >= 2) {
        html += '<div class="survivor-end"><p class="eyebrow">' + esc(txt(end.children[0])) + '</p>' +
          '<p class="survivor-end-quote">' + esc(txt(end.children[1])) + '</p></div>';
      }
    }
    return html;
  }

  /* ---------------- #items ---------------- */
  function buildItems(section) {
    var inner = section.querySelector(':scope > .max-w-7xl');
    if (!inner) return null;
    var kids = Array.prototype.slice.call(inner.children);
    var head = kids[0];
    var grid = inner.querySelector(':scope > .grid');
    if (!head || !grid || head === grid || !grid.children.length) return null;
    var last = kids[kids.length - 1];
    var foot = last !== grid && last !== head ? last : null;

    var html = subhead(head, false) + '<div class="survivor-items">', n = 0;
    Array.prototype.forEach.call(grid.children, function (card) {
      var tags = card.querySelectorAll(':scope > .absolute');
      var rarity = txt(tags[0]), type = txt(tags[1]);
      var accent = tags[0] ? tags[0].style.color : '';
      var img = card.querySelector('img');
      var info = card.querySelector(':scope > .p-5') || card.lastElementChild;
      var nameEl = info && info.firstElementChild;
      var name = txt(nameEl);
      if (!name) return;
      var title = txt(nameEl.nextElementSibling);
      var stats = [];
      info.querySelectorAll('.flex-wrap > div').forEach(function (chip) {
        var s = chip.querySelectorAll('span');
        if (s.length >= 2) stats.push([txt(s[0]), txt(s[1])]);
      });
      var effBox = info.querySelector('.border-l-2');
      var effLabel = effBox ? txt(effBox.firstElementChild) : '';
      var effect = effBox ? txt(effBox.lastElementChild) : '';
      var flavor = txt(info.querySelector(':scope > p')).replace(/^["“]|["”]$/g, '');
      n++;
      html += '<article class="survivor-item"' + (accent ? ' style="--pfx-si-accent:' + esc(accent) + '"' : '') + '>' +
        '<div class="held-art"><span class="held-initial" aria-hidden="true">' + esc(name.charAt(0)) + '</span>' +
          (img ? '<img src="' + esc(img.getAttribute('src')) + '" alt="' + esc(img.getAttribute('alt') || name) + '" loading="lazy">' : '') +
          '<span class="survivor-label">' + esc([rarity, type].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="held-copy"><h4>' + esc(name) + '</h4>' + (title ? '<p class="held-title">' + esc(title) + '</p>' : '') +
          (stats.length ? '<dl class="survivor-stats">' + stats.map(function (s) {
            return '<div><dt>' + esc(s[0].toUpperCase()) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
          }).join('') + '</dl>' : '') +
          (effect ? '<h5>' + esc(effLabel ? sentence(effLabel) : 'Effect') + '</h5><p>' + esc(effect) + '</p>' : '') +
          (flavor ? '<blockquote>' + esc(flavor) + '</blockquote>' : '') +
        '</div></article>';
    });
    if (!n) return null;
    html += '</div>';
    if (foot) html += '<p class="source-note">' + esc(txt(foot).replace(/^◆\s*|\s*◆$/g, '')) + '</p>';
    return html;
  }

  function mount(hostId, builder, mod) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var section = host.querySelector(':scope > section');
    if (!section) return;
    var existing = section.querySelector(':scope > .pfx-si[data-pfx-owned]');
    if (!existing) {
      var html = builder(section);
      if (!html) return;
      existing = document.createElement('div');
      existing.className = 'pfx-si pfx-si--' + mod;
      existing.setAttribute('data-pfx-owned', ID);
      existing.innerHTML = html;
      existing.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('error', function () { img.parentNode.classList.add('is-missing'); });
      });
      section.appendChild(existing);
    }
    if (section.getAttribute('data-pfx-si') !== mod) section.setAttribute('data-pfx-si', mod);
  }

  ProtoFx.on(ID, function () {
    mount('subclass', buildSubclass, 'subclass');
    mount('items', buildItems, 'items');
  });
})();
