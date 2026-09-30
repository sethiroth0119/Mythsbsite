/* proto-fx piece: faction-tabs — turns the Survivor page's "Choose Your Faction" five-tile grid (#factions)
   into the prototype's faction chapter: eyebrow + "One world. / Many ways to belong." head, a tab row with
   faction icons and a gold underline on the selected tab, a circular gold stage whose card lifts 9px on
   hover, and a story panel (motto, name, description, strength/playstyle ledger, faction ability).

   Data comes from MSBridge.factions (the site's real FACTIONS array), so every faction and every line of
   faction text the old tiles showed (name, motto, description) is still here, plus the strength, playstyle
   and perk fields the tiles never displayed. Actions are real:
     - stage click: opens the real HeroModal (MSBridge.openHero) for a survivor of that faction, when one
       exists in HEROES; otherwise it takes you to the survivors below
     - "Meet the survivors": scrolls to the real #champions section on this same page
   The chapter is injected as a [data-pfx-owned] sibling inside #factions; the old <section> is only hidden
   (by CSS, once #factions has .pfx-ft-ready), never removed, so React keeps owning it. */
(function () {
  if (!window.ProtoFx) return;

  var selected = 0;                 // remembered across re-renders / page switches
  var reduced = !!ProtoFx.reduced;
  try {
    var mq = matchMedia('(prefers-reduced-motion: reduce)');
    var upd = function () { reduced = mq.matches; };
    if (mq.addEventListener) mq.addEventListener('change', upd); else if (mq.addListener) mq.addListener(upd);
  } catch (e) {}

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function heroesOf(f) {
    var b = ProtoFx.bridge();
    var hs = (b && b.heroes) || [];
    var out = [];
    for (var i = 0; i < hs.length; i++) if (hs[i] && (hs[i].faction === f.short || hs[i].faction === f.name)) out.push(hs[i]);
    return out;
  }
  function splitPerk(perk) {
    var s = String(perk || '');
    var i = s.indexOf(':');
    if (i > 0 && i < 40) {
      var d = s.slice(i + 1).trim();
      return { name: s.slice(0, i).trim(), desc: d.charAt(0).toUpperCase() + d.slice(1) };
    }
    return { name: 'Faction ability', desc: s };
  }
  function scrollToSurvivors() {
    var t = document.getElementById('champions');
    if (t) t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function build(host, factions) {
    var sec = el('section', 'pfx-ft');
    sec.setAttribute('data-pfx-owned', '');
    sec.setAttribute('aria-labelledby', 'pfx-ft-title');

    var head = el('div', 'section-head');
    head.appendChild(el('p', 'eyebrow', 'The five that survived'));
    var h2 = el('h2');
    h2.id = 'pfx-ft-title';
    h2.appendChild(document.createTextNode('One world.'));
    h2.appendChild(document.createElement('br'));
    h2.appendChild(el('em', null, 'Many ways to belong.'));
    head.appendChild(h2);
    head.appendChild(el('p', 'section-subtitle',
      'Choose your faction. Five of the game’s 39 survived, and each carries a passive synergy that grows with every ally of its kind.'));
    sec.appendChild(head);

    var tabs = el('div', 'faction-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Factions');
    factions.forEach(function (f, i) {
      var b = el('button', 'faction-tab');
      b.type = 'button';
      b.id = 'pfx-ft-tab-' + i;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'pfx-ft-panel');
      b.setAttribute('data-faction', String(i));
      var ic = el('img', 'faction-icon');
      ic.src = f.image; ic.alt = ''; ic.width = 32; ic.height = 36; ic.decoding = 'async';
      b.appendChild(ic);
      b.appendChild(document.createTextNode(f.short || f.name));
      tabs.appendChild(b);
    });
    sec.appendChild(tabs);

    var panel = el('div', 'faction-panel');
    panel.id = 'pfx-ft-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;

    var art = el('button', 'faction-art card-stage');
    art.type = 'button';
    var lift = el('div', 'faction-lift');
    var card = el('div', 'faction-card');
    var cardImg = el('img');
    cardImg.decoding = 'async';
    var cardName = el('b');
    var cardMotto = el('small');
    card.appendChild(cardImg); card.appendChild(cardName); card.appendChild(cardMotto);
    lift.appendChild(card);
    art.appendChild(lift);
    var hint = el('span', 'stage-hint');
    art.appendChild(hint);
    panel.appendChild(art);

    var story = el('div', 'faction-story');
    var motto = el('div', 'eyebrow');
    var name = el('h3');
    var desc = el('p');
    var ledger = el('dl', 'faction-ledger');
    var lStr = el('div'), lPlay = el('div');
    lStr.appendChild(el('dt', null, 'Strength')); var ddStr = el('dd'); lStr.appendChild(ddStr);
    lPlay.appendChild(el('dt', null, 'Playstyle')); var ddPlay = el('dd'); lPlay.appendChild(ddPlay);
    ledger.appendChild(lStr); ledger.appendChild(lPlay);
    var ability = el('div', 'faction-ability');
    var abName = el('strong');
    var abDesc = el('p');
    ability.appendChild(abName); ability.appendChild(abDesc);
    var cta = el('button', 'ft-cta', 'Meet the survivors');
    cta.type = 'button';
    cta.addEventListener('click', scrollToSurvivors);
    ability.appendChild(cta);
    story.appendChild(motto); story.appendChild(name); story.appendChild(desc);
    story.appendChild(ledger); story.appendChild(ability);
    panel.appendChild(story);
    sec.appendChild(panel);

    var current = null;
    function show(i, animate) {
      i = Math.max(0, Math.min(factions.length - 1, i));
      selected = i;
      var f = factions[i];
      var btns = tabs.querySelectorAll('.faction-tab');
      for (var k = 0; k < btns.length; k++) {
        var on = k === i;
        btns[k].setAttribute('aria-selected', on ? 'true' : 'false');
        btns[k].tabIndex = on ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', 'pfx-ft-tab-' + i);
      sec.style.setProperty('--ft-glow', f.glowColor || 'rgba(212,160,23,.35)');
      cardImg.src = f.image; cardImg.alt = f.name;
      cardName.textContent = f.short || f.name;
      cardMotto.textContent = f.motto || '';
      motto.textContent = f.motto || '';
      name.textContent = f.name;
      desc.textContent = f.desc || '';
      ddStr.textContent = f.strength || '—';
      ddPlay.textContent = f.playstyle || '—';
      var perk = splitPerk(f.perk);
      abName.textContent = perk.name;
      abDesc.textContent = perk.desc;
      var hs = heroesOf(f);
      current = hs.length ? hs[0] : null;
      art.classList.add('is-link');
      if (current) {
        hint.textContent = 'Hover to lift · Click to inspect ' + current.name;
        art.setAttribute('aria-label', f.name + ' — inspect ' + current.name);
      } else {
        hint.textContent = 'Hover to lift · Click to meet the survivors';
        art.setAttribute('aria-label', f.name + ' — meet the survivors');
      }
      if (animate && !reduced) {
        panel.classList.remove('is-switching');
        void panel.offsetWidth;
        panel.classList.add('is-switching');
      }
    }
    art.addEventListener('click', function () {
      var b = ProtoFx.bridge();
      if (current && b && b.openHero) b.openHero(current);
      else scrollToSurvivors();
    });
    tabs.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.faction-tab');
      if (!t) return;
      var i = +t.getAttribute('data-faction');
      if (i !== selected) show(i, true);
    });
    // prototype tablist keyboard model: arrows / Home / End move + select, roving tabindex
    tabs.addEventListener('keydown', function (e) {
      var n = factions.length, i = selected;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (selected + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (selected - 1 + n) % n;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      else return;
      e.preventDefault();
      show(i, true);
      var b = document.getElementById('pfx-ft-tab-' + i);
      if (b) b.focus();
    });
    panel.addEventListener('animationend', function (e) {
      if (e.target === story) panel.classList.remove('is-switching');
    });

    show(selected, false);
    host.appendChild(sec);
    host.classList.add('pfx-ft-ready');
  }

  ProtoFx.on('faction-tabs', function () {
    var host = document.getElementById('factions');
    if (!host) return;
    if (host.querySelector(':scope > .pfx-ft')) { host.classList.add('pfx-ft-ready'); return; }
    var b = ProtoFx.bridge();
    var factions = b && b.factions;
    if (!factions || !factions.length) return;   // no bridge yet: leave the original tiles visible
    build(host, factions);
  });
})();
