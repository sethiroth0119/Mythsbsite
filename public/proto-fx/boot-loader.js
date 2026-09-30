/* proto-fx piece: boot-loader — the Foundation access screen: the white logo spins while an access code is
   typed in and granted, styled in the prototype's loader language (dark ground, gold, hairline track).
   The lifecycle below is the prototype's #boot-controller, ported.
   Loads in <head>, before #boot-splash is parsed, so it watches the parser for the splash, then injects
   #pfx-boot next to it. index.html's own teardown (fade opacity -> remove) is the "ready" signal; we
   mirror it with the prototype's .is-leaving exit. It never blocks: a 'skip' appears after 12s and a
   hard failsafe clears it at 45s; if anything throws, the loader is removed. */
(function () {
  var doc = document, root = doc.documentElement;
  var reduced = false; try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var loader, bar, status, skip, splash, finished = false, timers = [], obs, creep;

  // First visit this session plays the whole access sequence; later page loads skip the wait.
  var seen = false; try { seen = sessionStorage.getItem('pfxBootSeen') === '1'; sessionStorage.setItem('pfxBootSeen', '1'); } catch (e) {}
  var seqDone = seen || reduced, pending = null;
  // The "someone is typing a password" sequence. The site compiles its whole app with Babel while this
  // screen is up, a multi-second main-thread task, so JS timers would freeze and every dot would land at
  // once. Everything visible is therefore a CSS opacity animation with a precomputed delay (compositor
  // driven, keeps running through the compile); JS only builds the markup and keeps the exit gate.
  var CODE = 10, T0 = 450, KEYS = [], t = T0, i;
  for (i = 1; i <= CODE; i++) { t += 90 + (i * 53 % 70) + (i === 4 || i === 7 ? 140 : 0); KEYS.push(t); }
  var T_VERIFY = t + 320, T_GRANT = T_VERIFY + 700, SEQ_MS = T_GRANT + 350;

  function build() {
    loader = doc.createElement('div');
    loader.className = 'pfx-boot' + (seqDone ? ' is-instant' : ''); loader.id = 'pfx-boot';
    loader.setAttribute('data-pfx-owned', ''); loader.setAttribute('aria-label', 'Loading Mythic Spellbook');
    var ms = function (v) { return 'animation-delay:' + v + 'ms'; };
    var dots = KEYS.map(function (k) { return '<i class="boot-dot" style="' + ms(k) + '">\u2022</i>'; }).join('');
    var lines = [['Awaiting credentials', 0, T0], ['Entering access code', T0, T_VERIFY], ['Verifying\u2026', T_VERIFY, T_GRANT]]
      .map(function (l) { return '<span class="boot-msg" style="animation-delay:' + l[1] + 'ms,' + l[2] + 'ms">' + l[0] + '</span>'; }).join('');
    // Logo: the Foundation mark the site already uses in the game (SCP Foundation logo, CC BY-SA 3.0,
    // scp-wiki.wikidot.com), recoloured white on transparent in assets/proto/scp-logo-white.png.
    loader.innerHTML =
      '<div class="boot-mark" style="--grant:' + T_GRANT + 'ms">' +
      '<div class="boot-logo" aria-hidden="true"><img src="' + (window.ProtoFx ? ProtoFx.asset('scp-logo-white.png') : 'assets/proto/scp-logo-white.png') + '" alt=""></div>' +
      '<p class="boot-name">MYTHIC SPELLBOOK</p>' +
      '<div class="boot-term" aria-hidden="true">' +
      '<p class="boot-row"><span>SURVIVOR ID</span><b>GUEST \u00b7 SEASON 1</b></p>' +
      '<p class="boot-row"><span>ACCESS CODE</span><b class="boot-code">' + dots + '<i class="boot-caret"></i></b></p>' +
      '<p class="boot-line">' + lines + '<span class="boot-msg is-grant">ACCESS GRANTED</span></p></div>' +
      '<p class="boot-status" role="status">Requesting access</p>' +
      '<div class="boot-track" aria-hidden="true"><span></span></div></div>' +
      '<button type="button" class="boot-skip" hidden>Enter preview</button>';
    bar = loader.querySelector('.boot-track span'); status = loader.querySelector('.boot-status'); skip = loader.querySelector('.boot-skip');
    skip.onclick = function () { seqDone = true; finish('preview'); };
    // A click on the screen jumps straight to "granted" and lets the site in as soon as it is ready.
    loader.addEventListener('click', function (e) { if (e.target !== skip && !seqDone) { seqDone = true; loader.classList.add('is-instant'); if (pending) finish(pending); } });
    return loader;
  }

  function sequence() {
    if (seqDone) return;
    // Counted from when the screen was inserted, the same zero the CSS delays use.
    timers.push(setTimeout(function () { seqDone = true; if (pending) finish(pending); }, SEQ_MS));
  }

  function setLoad(v) { if (bar && !finished) bar.style.setProperty('--load', String(Math.min(.94, v))); }
  function visibility() { if (loader) loader.classList.toggle('is-paused', doc.hidden); }
  function cleanup() {
    timers.forEach(clearTimeout); clearInterval(creep);
    try { obs && obs.disconnect(); } catch (e) {}
    doc.removeEventListener('visibilitychange', visibility); window.removeEventListener('error', fail);
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
  }
  // Exit, ported 1:1 from the prototype's #boot-controller finish(): --load 1, the status text and
  // .is-leaving land in the same tick (the .35s bar fill and the .65s fade/scale(1.22) run together as CSS
  // transitions), then the loader is removed 700ms later (0 with reduced motion).
  function finish(reason) {
    if (finished || !loader) return;
    reason = reason || 'ready';
    if (!seqDone && reason !== 'preview') { pending = reason; return; }   // let the access sequence finish first
    finished = true; clearInterval(creep);
    loader.dataset.result = reason;
    bar.style.setProperty('--load', '1');
    status.textContent = reason === 'ready' ? 'Welcome, Survivor' : 'Enter the world';
    loader.classList.add('is-leaving');
    if (reduced) { timers.push(setTimeout(cleanup, 0)); return; }
    powerOn();
    // A hidden tab gets no frames: the prototype only pauses the particles there, and the 700ms settle
    // timer (below, via the failsafe when rAF is throttled) still removes it.
    // The prototype removes the loader 700ms after .is-leaving. Here the hand-off lands inside React's
    // first commit, so a blind 700ms timer can expire before the browser paints a single frame and the
    // fade would never be seen. Count the 700ms from the first frame that paints the .is-leaving state
    // (when the CSS transitions actually start); a hard failsafe still clears it.
    requestAnimationFrame(function () { timers.push(setTimeout(cleanup, 700)); });
    timers.push(setTimeout(cleanup, 4000));
  }
  // CRT power-on. The login panel collapses to a line (.is-leaving, CSS), then this screen takes over:
  // a glowing dot at the centre stretches into a line, the line opens to the full screen, and the site
  // appears through it with a white flash, scanlines and a short flicker. The black around the opening is
  // one huge box-shadow on the .crt-tube box, so the site underneath is never transformed or re-laid out.
  // All CSS animation (keeps running if the main thread is busy); a timer removes it, with a failsafe.
  function powerOn() {
    var crt = doc.createElement('div');
    crt.className = 'pfx-crt'; crt.setAttribute('data-pfx-owned', ''); crt.setAttribute('aria-hidden', 'true');
    crt.innerHTML = '<div class="crt-tube"></div><div class="crt-flash"></div><div class="crt-lines"></div>';
    (doc.body || root).appendChild(crt);
    var gone = false;
    var drop = function () { if (!gone) { gone = true; if (crt.parentNode) crt.parentNode.removeChild(crt); } };
    setTimeout(drop, 1500);
    setTimeout(drop, 5000);
  }
  function fail() { finish('fallback'); }
  window.PfxBoot = { finish: finish };

  function splashGone() { return !splash || !splash.isConnected || splash.style.opacity === '0'; }

  function attach(s) {
    splash = s;
    try { s.parentNode.insertBefore(build(), s.nextSibling); } catch (e) { return; }
    visibility(); doc.addEventListener('visibilitychange', visibility);
    sequence();
    // Progress: parse -> DOMContentLoaded -> load -> Babel/React; creep toward .94 until the site hands off.
    var load = .08; setLoad(load);
    creep = setInterval(function () { load += (.94 - load) * .045; setLoad(load); }, 250);
    doc.addEventListener('DOMContentLoaded', function () { load = Math.max(load, .38); setLoad(load); });
    window.addEventListener('load', function () { load = Math.max(load, .62); setLoad(load); if (!finished) status.textContent = 'Opening the archive'; });
    // Hand-off: index.html fades #boot-splash (opacity 0) then removes it once React mounted.
    obs = new MutationObserver(function () { if (splashGone()) finish('ready'); });
    obs.observe(s, { attributes: true, attributeFilter: ['style'] });
    obs.observe(s.parentNode, { childList: true });
    // The prototype's 12s 'slow' timer starts with the page, so count it from navigation, not from insertion.
    var since = 0; try { since = performance.now(); } catch (e) {}
    timers.push(setTimeout(function () { if (!finished) { status.textContent = 'Still opening the archive'; skip.hidden = false; } }, Math.max(0, 12000 - since)));
    timers.push(setTimeout(function () { finish('fallback'); }, 45000));
    window.addEventListener('error', fail);
    window.addEventListener('pagehide', function (e) { if (!e.persisted) cleanup(); });
  }

  // First frame. The site compiles its whole JSX app with Babel standalone on DOMContentLoaded, a multi-second
  // main-thread task that starts right after the parser reaches </html>, so the browser never got to paint the
  // splash first and showed white. The prototype's loader is on screen within ~0.3s. Babel's public API lets
  // us take over that trigger: stop the DOMContentLoaded auto-run and start the same transformScriptTags()
  // once the dark loader frame has painted (first-paint), with short timeouts so the app is never held back
  // by more than a few frames, and exactly once.
  var B = window.Babel, compiled = false;
  function compile() {
    if (compiled) return; compiled = true;
    try { B.transformScriptTags(); } catch (e) { setTimeout(function () { throw e; }); }
  }
  function afterPaint() {
    var done = false; function go() { if (!done) { done = true; setTimeout(compile, 0); } }
    try {
      var po2 = new PerformanceObserver(function (l) { if (l.getEntries().length) { po2.disconnect(); go(); } });
      po2.observe({ type: 'paint', buffered: true });
    } catch (e) {}
    try { requestAnimationFrame(function () { setTimeout(function () { requestAnimationFrame(function () { setTimeout(go, 0); }); }, 0); }); } catch (e) {}
    setTimeout(go, doc.hidden ? 0 : 250);
  }
  try {
    if (B && typeof B.disableScriptTags === 'function' && typeof B.transformScriptTags === 'function' && doc.readyState === 'loading') {
      B.disableScriptTags();
      doc.addEventListener('DOMContentLoaded', function () { if (loader) afterPaint(); else compile(); });
      setTimeout(function () { if (doc.readyState !== 'loading') compile(); }, 2500);
    }
  } catch (e) { compile(); }

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
