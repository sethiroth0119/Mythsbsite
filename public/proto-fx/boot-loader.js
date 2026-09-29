/* proto-fx piece: boot-loader — the prototype's constellation loader (#boot-loader + #boot-controller), ported.
   Loads in <head>, before #boot-splash is parsed, so it watches the parser for the splash, then injects
   #pfx-boot next to it. index.html's own teardown (fade opacity -> remove) is the "ready" signal; we
   mirror it with the prototype's .is-leaving exit. It never blocks: a 'skip' appears after 12s and a
   hard failsafe clears it at 45s; if anything throws, the loader is removed. */
(function () {
  var doc = document, root = doc.documentElement;
  var reduced = false; try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var loader, bar, status, skip, splash, finished = false, timers = [], obs, creep;

  function build() {
    loader = doc.createElement('div');
    loader.className = 'pfx-boot'; loader.id = 'pfx-boot';
    loader.setAttribute('data-pfx-owned', ''); loader.setAttribute('aria-label', 'Loading Mythic Spellbook');
    loader.innerHTML =
      '<div class="boot-mark"><div class="boot-constellation" aria-hidden="true"><div class="boot-orbits"></div>' +
      '<svg class="boot-symbol" viewBox="0 0 22 34" fill="none"><path d="M11 1 21 17 11 33 1 17 11 1Z" stroke="currentColor" stroke-width=".8"></path>' +
      '<path d="M11 8v18M6 17h10" stroke="currentColor" stroke-width=".6" opacity=".5"></path></svg></div>' +
      '<p class="boot-name">MYTHIC SPELLBOOK</p><p class="boot-status" role="status">Gathering the deck</p>' +
      '<div class="boot-track" aria-hidden="true"><span></span></div></div>' +
      '<button type="button" class="boot-skip" hidden>Enter the site</button>';
    var orbits = loader.querySelector('.boot-orbits');
    for (var i = 0; i < 28; i++) {
      var p = doc.createElement('span'); p.className = 'boot-particle'; p.appendChild(doc.createElement('i'));
      p.style.cssText = '--angle:' + (i * 137.508) + 'deg;--radius:' + (40 + (i * 19 % 48)) + 'px;--size:' +
        (i % 7 === 0 ? 2.5 : 1.2 + (i % 3) * .35) + 'px;--alpha:' + (.22 + (i % 6) * .11) + ';--duration:' + (16 + i % 9 * 2) +
        's;--delay:' + (-i * 1.7) + 's;--particle-color:' + (i % 5 === 0 ? '#c6b693' : '#9ccfc9');
      orbits.appendChild(p);
    }
    bar = loader.querySelector('.boot-track span'); status = loader.querySelector('.boot-status'); skip = loader.querySelector('.boot-skip');
    skip.onclick = function () { finish('preview'); };
    return loader;
  }

  function setLoad(v) { if (bar && !finished) bar.style.setProperty('--load', String(Math.min(.94, v))); }
  function visibility() { if (loader) loader.classList.toggle('is-paused', doc.hidden); }
  function cleanup() {
    timers.forEach(clearTimeout); clearInterval(creep);
    try { obs && obs.disconnect(); } catch (e) {}
    doc.removeEventListener('visibilitychange', visibility);
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
  }
  function finish(reason) {
    if (finished || !loader) return; finished = true; clearInterval(creep);
    loader.dataset.result = reason || 'ready';
    bar.style.setProperty('--load', '1');
    status.textContent = reason === 'ready' ? 'Stories Cast a Longer Shadow' : 'Enter the world';
    loader.classList.add('is-leaving');
    timers.push(setTimeout(cleanup, reduced ? 0 : 700));
  }
  window.PfxBoot = { finish: finish };

  function splashGone() { return !splash || !splash.isConnected || splash.style.opacity === '0'; }

  function attach(s) {
    splash = s;
    try { s.parentNode.insertBefore(build(), s.nextSibling); } catch (e) { return; }
    visibility(); doc.addEventListener('visibilitychange', visibility);
    // Progress: parse -> DOMContentLoaded -> load -> Babel/React; creep toward .94 until the site hands off.
    var load = .08; setLoad(load);
    creep = setInterval(function () { load += (.94 - load) * .045; setLoad(load); }, 250);
    doc.addEventListener('DOMContentLoaded', function () { load = Math.max(load, .38); setLoad(load); });
    window.addEventListener('load', function () { load = Math.max(load, .62); setLoad(load); if (!finished) status.textContent = 'Preparing the light'; });
    // Hand-off: index.html fades #boot-splash (opacity 0) then removes it once React mounted.
    obs = new MutationObserver(function () { if (splashGone()) finish('ready'); });
    obs.observe(s, { attributes: true, attributeFilter: ['style'] });
    obs.observe(s.parentNode, { childList: true });
    timers.push(setTimeout(function () { if (!finished) { status.textContent = 'Still gathering the deck'; skip.hidden = false; } }, 12000));
    timers.push(setTimeout(function () { finish('fallback'); }, 45000));
    window.addEventListener('pagehide', function (e) { if (!e.persisted) cleanup(); });
  }

  // Only when the site boots with its splash (it is in index.html's static body).
  function find() { var s = doc.getElementById('boot-splash'); if (s && !loader) { attach(s); return true; } return !!loader; }
  try {
    if (!find()) {
      var po = new MutationObserver(function () { if (find()) po.disconnect(); });
      po.observe(root, { childList: true, subtree: true });
      doc.addEventListener('DOMContentLoaded', function () { po.disconnect(); find(); });
    }
  } catch (e) { cleanup(); }
})();
