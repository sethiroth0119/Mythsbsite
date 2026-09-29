/* proto-fx piece: chapters — restyles the home page sections as the prototype's "chapters"
   (#all-cards .section-head, #how-to-play, #expeditions, #world-lore in the prototype; rules
   from its #mythic-brand and #reading-space style blocks).

   What this script does (all idempotent, React-safe):
   - tags each home section with .pfx-ch plus .pfx-ch--<key> so chapters.css can style it;
   - inserts a gold eyebrow before each section h2 and a prototype chapter-rule
     ("01 / label ... label") at the top of the long-form chapters. Injected nodes carry
     data-pfx-owned so the ProtoFx observer ignores them;
   - splits a titled heading into ice text + a gold <em> accent line (text kept verbatim:
     React's own text node stays in place and only its tail moves into the <em>);
   - marks the GaSteps list as the prototype's expedition ledger (numbers drawn by CSS).
   No text, button or handler of the site is removed or re-wired. */
(function () {
  if (!window.ProtoFx) return;

  // `em` is the exact tail of the real heading text that becomes the gold accent line.
  var CHAPTERS = [
    { key: 'about', sel: '#about > section', eyebrow: 'The Spellbook · Tactical card battles',
      em: 'Actually Moves' },
    { key: 'play', sel: '#play > section', eyebrow: 'Learn the battlefield',
      rule: ['01 / How a run plays out', 'Build · Survive · Expand · Conquer'], em: 'Expand. Conquer.' },
    { key: 'story', sel: '#story > section', eyebrow: 'The lore of Mythic Spellbook',
      rule: ['02 / Beyond the battlefield', 'The world of Mythic Spellbook'], em: 'Has Awakened',
      caption: 'The Flood · Abraxas returns to unmake creation' },
    { key: 'economy', title: 'Cards Worth Owning', eyebrow: 'A living player economy',
      rule: ['03 / Life after the battle', 'Trade · Craft · Withdraw'], em: 'Owning' },
    { key: 'articles', title: 'Recent Articles', eyebrow: 'Dispatches from the Spellbook',
      rule: ['04 / The chronicle', 'News · Updates · Devlogs'] },
    { key: 'signup', title: 'Open the Spellbook', eyebrow: 'Free to play · In your browser',
      em: 'Spellbook' }
  ];

  function text(h) { return (h.textContent || '').replace(/\s+/g, ' ').trim(); }

  function findSection(c) {
    if (c.sel) return document.querySelector(c.sel);
    var list = document.querySelectorAll('section[data-pfx="ga-section"]');
    for (var i = 0; i < list.length; i++) {
      var h = list[i].querySelector('h2');
      if (h && text(h) === c.title) return list[i];
    }
    return null;
  }

  function owned(tag, cls) {
    var el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('data-pfx-owned', 'chapters');
    return el;
  }

  function splitHeading(h, em) {
    if (!em || h.getAttribute('data-pfx-split')) return;
    if (h.childNodes.length !== 1 || h.firstChild.nodeType !== 3) return;  // plain text only
    var t = h.firstChild, raw = t.nodeValue, cut = raw.lastIndexOf(em);
    if (cut <= 0 || raw.slice(cut) !== em) return;
    var tail = t.splitText(cut);
    var br = owned('br', 'pfx-ch-br');
    var emEl = owned('em', 'pfx-ch-em');
    h.insertBefore(br, tail);
    h.insertBefore(emEl, tail);
    emEl.appendChild(tail);
    h.setAttribute('data-pfx-split', '1');
  }

  function addEyebrow(h, label) {
    var prev = h.previousElementSibling;
    if (prev && prev.classList.contains('pfx-ch-eyebrow')) return;
    var p = owned('p', 'pfx-ch-eyebrow');
    p.textContent = label;
    h.parentNode.insertBefore(p, h);
  }

  function addRule(container, labels) {
    if (!labels || !container) return;
    for (var k = container.firstElementChild; k; k = k.nextElementSibling) {
      if (k.classList.contains('pfx-ch-rule')) return;
    }
    var d = owned('div', 'pfx-ch-rule');
    d.setAttribute('aria-hidden', 'true');
    labels.forEach(function (l) { var s = document.createElement('span'); s.textContent = l; d.appendChild(s); });
    container.insertBefore(d, container.firstChild);
  }

  ProtoFx.on('chapters', function () {
    CHAPTERS.forEach(function (c) {
      var sec = findSection(c);
      if (!sec) return;
      sec.classList.add('pfx-ch', 'pfx-ch--' + c.key);
      var h = sec.querySelector('h2');
      if (!h) return;
      h.classList.add('pfx-ch-title');
      var inner = h.parentNode;
      inner.classList.add('pfx-ch-inner');
      var sub = h.nextElementSibling;
      var hasSub = !!(sub && sub.tagName === 'P');
      if (hasSub) sub.classList.add('pfx-ch-sub');
      if (c.em && hasSub) splitHeading(h, c.em);
      addEyebrow(h, c.eyebrow);

      if (c.key === 'story') {
        // Framed like the prototype's world-illustration: the section becomes a two-row grid
        // (chapter-rule, then the frame); its React layers are placed in row 2 by CSS.
        addRule(sec, c.rule);
        var hasCap = false, kids = sec.children;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].classList.contains('pfx-ch-caption')) hasCap = true;
          if (/The Flood/.test((kids[i].style && kids[i].style.backgroundImage) || '')) kids[i].classList.add('pfx-ch-art');
        }
        if (!hasCap) {
          var cap = owned('span', 'pfx-ch-caption');
          cap.setAttribute('aria-hidden', 'true');
          cap.textContent = c.caption;
          sec.appendChild(cap);
        }
      } else {
        addRule(inner, c.rule);
      }

      if (c.key === 'play') {
        var ledger = inner.querySelector('.space-y-7');
        if (ledger) {
          ledger.classList.add('pfx-ch-ledger');
          Array.prototype.forEach.call(ledger.children, function (row) {
            row.classList.add('pfx-ch-step');
            if (row.firstElementChild) row.firstElementChild.classList.add('pfx-ch-num');
          });
        }
      }
      if (c.key === 'economy') {
        var col = inner.querySelector('.max-w-sm');
        if (col) col.classList.add('pfx-ch-notes');
      }
      if (c.key === 'articles') {
        Array.prototype.forEach.call(sec.querySelectorAll('.ga-article'), function (a) { a.classList.add('pfx-ch-article'); });
      }
      if (c.key === 'signup') {
        var box = inner.querySelector('.max-w-md');
        if (box) box.classList.add('pfx-ch-news');
      }
    });
  });
})();
