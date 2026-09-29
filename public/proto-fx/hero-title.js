/* proto-fx piece: hero-title — prototype hero copy treatment + word-by-word reveal.
   Tags the React Hero's existing elements (no content is added or removed; the video,
   logo, both CTAs, season line and stat strip stay exactly as the site renders them),
   splits the pitch line into .pfx-ht-word spans, and reveals them once the boot loader
   has left — like the prototype, which waits for HUNTBoot.revealed before its hero enters. */
(function () {
  if (!window.ProtoFx) return;
  var ENTER = 120;           // ms before the first word (prototype --enter-delay on the hero)
  var WORD_GAP = 65;         // ms between words (prototype .motion-word)

  function bootBusy() {
    var b = document.querySelector('.pfx-boot');
    if (b && !b.classList.contains('is-leaving')) return true;
    var s = document.getElementById('boot-splash');
    if (s && s.isConnected && s.style.opacity !== '0' && getComputedStyle(s).display !== 'none' && !document.querySelector('html.pfx-boot-loader')) return true;
    return false;
  }

  function reveal(sec) {
    if (sec.__pfxHtRevealing) return;
    sec.__pfxHtRevealing = true;
    var start = Date.now();
    (function wait() {
      if (!sec.isConnected) return;
      if (bootBusy() && Date.now() - start < 15000) { setTimeout(wait, 90); return; }
      // two frames so the hidden state is painted before the transition starts
      requestAnimationFrame(function () { requestAnimationFrame(function () { sec.classList.add('is-visible'); }); });
    })();
  }

  function splitWords(el, enterDelay) {
    if (el.hasAttribute('data-pfx-ht-split')) return el.querySelectorAll('.pfx-ht-word').length;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    el.setAttribute('data-pfx-owned', '');       // our own mutations below are ignored by ProtoFx
    el.setAttribute('data-pfx-ht-split', '');
    el.style.setProperty('--enter-delay', enterDelay + 'ms');
    var words = text.split(' ');
    var frag = document.createDocumentFragment();
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'pfx-ht-word';
      s.style.setProperty('--word-index', String(i));
      s.textContent = w;
      frag.appendChild(s);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(frag);
    return words.length;
  }

  function motion(el, delay) {
    if (!el) return;
    el.setAttribute('data-pfx-ht-motion', '');
    el.style.setProperty('--enter-delay', Math.round(delay) + 'ms');
  }

  ProtoFx.on('hero-title', function () {
    var sec = document.querySelector('section[data-pfx="hero"]');
    if (!sec) return;
    if (sec.hasAttribute('data-pfx-ht-armed') && sec.querySelector('[data-pfx-ht-split]')) return;

    // Overlays: the flat 55% black and the bottom fade (direct div children before the copy)
    var copy = null;
    Array.prototype.forEach.call(sec.children, function (c) {
      if (c.tagName !== 'DIV' || c.hasAttribute('data-pfx-slot')) return;
      var bg = c.style && c.style.background || '';
      if (/0\.55\)/.test(bg)) c.setAttribute('data-pfx-ht', 'overlay');
      else if (/linear-gradient/.test(bg) && c.classList.contains('bottom-0')) c.setAttribute('data-pfx-ht', 'fade');
      else if (c.querySelector('a') || c.querySelector('img')) copy = c;
    });
    if (!copy) return;
    copy.setAttribute('data-pfx-ht', 'copy');

    var logo = copy.querySelector(':scope > img');
    var ps = copy.querySelectorAll(':scope > p');
    var headline = ps[0], tagline = ps[1];
    var ctas = null, stats = null;
    Array.prototype.forEach.call(copy.children, function (c) {
      if (c.tagName !== 'DIV') return;
      if (c.querySelector('a')) ctas = c; else if (c.children.length >= 3) stats = c;
    });
    if (logo) logo.setAttribute('data-pfx-ht', 'logo');
    if (headline) headline.setAttribute('data-pfx-ht', 'headline');
    if (tagline) tagline.setAttribute('data-pfx-ht', 'tagline');
    if (ctas) ctas.setAttribute('data-pfx-ht', 'ctas');
    if (stats) stats.setAttribute('data-pfx-ht', 'stats');

    var n = headline ? splitWords(headline, ENTER) : 0;
    var wordsEnd = ENTER + Math.max(0, n - 1) * WORD_GAP;   // when the last word starts
    motion(logo, 0);
    motion(tagline, wordsEnd + 120);
    motion(ctas, wordsEnd + 260);
    motion(stats, wordsEnd + 400);

    if (!ProtoFx.reduced) {
      sec.setAttribute('data-pfx-ht-armed', '');
      reveal(sec);
    } else {
      sec.classList.add('is-visible');
    }
  });
})();
