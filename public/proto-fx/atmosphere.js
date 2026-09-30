/* proto-fx piece: atmosphere — the prototype's "✧ Atmosphere" control (aside.atmosphere) plus a light
   ambient weather layer driven by its three presets (Frostfall / Moonlit Veil / Emberfall) and five
   layer switches (Clouds, Smoke, Light rays, Falling snow, Particles).
   - Layer: fixed, pointer-events none: ONE half-resolution canvas that draws the preset's tints, clouds,
     smoke, rays and ~110 sprites from pre-rendered bitmaps at <=30fps; paused when the tab is hidden,
     inside the Broadcast app, or when every layer is off. Reduced motion => one static frame.
   - Choice is remembered per viewer in localStorage ('pfxAtmosphere'), always inside try/catch.
   - Hidden inside the Broadcast (.cbk) app, which is its own product surface. */
(function () {
  if (!window.ProtoFx) return;

  var KEY = 'pfxAtmosphere';
  var LAYERS = [['clouds', 'Clouds'], ['smoke', 'Smoke'], ['rays', 'Light rays'], ['snow', 'Falling snow'], ['particles', 'Particles']];
  var PRESETS = {
    frostfall: { name: 'Frostfall', icon: '❄', desc: 'Silver clouds · drifting snow · icy rays',
      snow: { n: 80, col: '235,242,250', vy: [22, 55], r: [0.8, 2.4], a: [0.35, 0.8], sway: 22 },
      part: { n: 26, col: '190,228,255', mode: 'glint', r: [0.6, 1.6], a: [0.25, 0.9] },
      cloud: ['206,222,240', 0.11], smoke: ['170,194,216', 0.09], ray: ['214,238,255', 0.09], pulse: null,
      sky: ['140,190,235', 0.12], ground: ['160,200,230', 0.10], side: ['190,225,255', 0.08], moon: false },
    moonlit: { name: 'Moonlit Veil', icon: '☾', desc: 'Violet mist · moonbeams · floating motes',
      snow: { n: 30, col: '222,214,255', vy: [10, 26], r: [0.8, 2.0], a: [0.25, 0.55], sway: 30 },
      part: { n: 48, col: '200,176,255', mode: 'mote', r: [1.0, 2.6], a: [0.35, 0.95] },
      cloud: ['150,118,232', 0.14], smoke: ['124,90,214', 0.15], ray: ['222,212,255', 0.10], pulse: null,
      sky: ['120,78,236', 0.26], ground: ['96,60,200', 0.18], side: ['164,130,255', 0.11], moon: true },
    emberfall: { name: 'Emberfall', icon: '♨', desc: 'Rolling smoke · amber light · embers',
      snow: { n: 34, col: '160,146,136', vy: [14, 34], r: [0.8, 2.2], a: [0.2, 0.45], sway: 26 },
      part: { n: 64, col: '255,164,72', mode: 'ember', r: [1.0, 2.6], a: [0.55, 1] },
      cloud: ['150,92,56', 0.12], smoke: ['112,80,62', 0.20], ray: ['255,190,110', 0.11], pulse: ['255,140,50', 0.34],
      sky: ['229,140,70', 0.10], ground: ['229,179,131', 0.24], side: ['240,140,60', 0.10], moon: false }
  };
  var reduced = !!ProtoFx.reduced;

  function load() {
    var s = { preset: 'frostfall', layers: { clouds: true, smoke: true, rays: true, snow: true, particles: true } };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && PRESETS[v.preset]) s.preset = v.preset;
        if (v && v.layers) LAYERS.forEach(function (l) { if (typeof v.layers[l[0]] === 'boolean') s.layers[l[0]] = v.layers[l[0]]; });
      }
    } catch (e) {}
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load();

  /* ---------------- ambient layer ----------------
     Performance (round 4): the whole layer is ONE canvas at half resolution (S = 0.5, upscaled by CSS),
     drawn at <=30fps over the hero and <=20fps elsewhere (adaptive, see TIERS), from bitmaps
     pre-rendered once per preset (tints, cloud banks, smoke banks, god-rays, glow pulse, snow and
     particle sprites) with plain drawImage + globalAlpha. So the page gets one composited surface, one
     small texture upload per weather frame, and no CSS animation, blend mode, blur or mask anywhere. */
  var S = 0.5;
  /* Adaptive frame rate: weather targets 30fps, but if the browser itself drops below ~24fps while
     we draw (weak GPU, software rendering, busy phone), step down 30 -> 20 -> 12 -> 8 -> 5 so the rest of
     the site's transitions and animations keep their frames. Re-evaluated on resize. */
  var TIERS = [30, 20, 12, 8, 5], tier = 0, winT = 0, winN = 0;
  var layerEl, ui, cv, ctx, raf = 0, last = 0, lastDraw = 0, W = 0, H = 0;
  var sprites = { snow: [], particles: [] }, bmp = {};
  var mid = 0, midTarget = 0;        // sprite visibility in the reading column (0.9 over the hero, 0 elsewhere)
  var vis = {};                      // per-layer eased visibility 0..1, so ticking a box fades it
  LAYERS.forEach(function (l) { vis[l[0]] = state.layers[l[0]] ? 1 : 0; });

  function rand(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function gx() {
    if (Math.random() < 0.45) return Math.random() * W;
    var g = W <= 760 ? 0.09 : 0.19, u = Math.random() * g;
    return (Math.random() < 0.5 ? u : 1 - u) * W;
  }
  // Reading-column fade: 1 in the gutters, `mid` in the column (weather falls across the scene, not the text).
  function colFade(x) {
    var f = x / W, e0 = W <= 760 ? 0.03 : 0.08, e1 = W <= 760 ? 0.09 : 0.19;
    if (f > 0.5) f = 1 - f;
    if (f <= e0) return 1;
    if (f >= e1) return mid;
    return 1 + (mid - 1) * ((f - e0) / (e1 - e0));
  }

  function buildLayer() {
    layerEl = document.createElement('div');
    layerEl.className = 'pfx-atmo-layer';
    layerEl.setAttribute('aria-hidden', 'true');
    layerEl.setAttribute('data-pfx-owned', 'atmosphere');
    layerEl.innerHTML = '<canvas></canvas>';
    document.body.insertBefore(layerEl, document.body.firstChild);
    cv = layerEl.querySelector('canvas'); ctx = cv.getContext('2d');
    window.addEventListener('resize', function () { resize(); heroCheckNow(); }, { passive: true });
    window.addEventListener('scroll', heroCheck, { passive: true });
    document.addEventListener('visibilitychange', loop);
    resize();
    heroCheckNow();
  }

  /* Host switching: while the home hero fills most of the view the layer lives inside the hero (behind
     its art and copy, above its video); otherwise it is a fixed body-level layer behind all content. */
  var heroTick = 0;
  function place(h, r) {
    if (h) {
      if (layerEl.parentNode !== h) { h.insertBefore(layerEl, h.firstChild); layerEl.classList.add('is-hero'); }
      layerEl.style.height = H + 'px';
      layerEl.style.transform = 'translate3d(0,' + Math.round(-r.top) + 'px,0)';
    } else if (layerEl.parentNode !== document.body || layerEl.classList.contains('is-hero')) {
      layerEl.classList.remove('is-hero'); layerEl.style.transform = ''; layerEl.style.height = '';
      document.body.insertBefore(layerEl, document.body.firstChild);
    }
  }
  function heroCheckNow() {
    if (!layerEl) return;
    var h = document.querySelector('[data-pfx="hero"]'), on = false, r = null;
    if (h) { r = h.getBoundingClientRect(); on = r.height > 0 && r.bottom > window.innerHeight * 0.4 && r.top < window.innerHeight * 0.5; }
    place(on ? h : null, r);
    midTarget = on ? 0.9 : 0;
    if (!raf) { mid = midTarget; draw(0, performance.now()); }
  }
  function heroCheck() {
    if (heroTick) return;
    heroTick = requestAnimationFrame(function () { heroTick = 0; heroCheckNow(); });
  }

  function resize() {
    W = document.documentElement.clientWidth || window.innerWidth; H = window.innerHeight; tier = 0; winT = 0; winN = 0;
    if (cv) { cv.width = Math.ceil(W * S); cv.height = Math.ceil(H * S); }
    seed();
  }

  function scaleCount(n) { return Math.round(n * Math.max(0.45, Math.min(1, (W * H) / (1440 * 900)))); }

  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function rgba(col, a) { return 'rgba(' + col + ',' + a + ')'; }
  // Soft elliptical blob (pre-soft: long falloff instead of a blur filter).
  function blob(g, cx, cy, rx, ry, col, a) {
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    var grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grd.addColorStop(0, rgba(col, a)); grd.addColorStop(0.45, rgba(col, a * 0.55)); grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  }
  function sprite(col, R, core) {
    var c = mk(R * 2, R * 2), g = c.getContext('2d'), grd = g.createRadialGradient(R, R, 0, R, R, R);
    grd.addColorStop(0, rgba(col, 1)); grd.addColorStop(core, rgba(col, 0.45)); grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd; g.fillRect(0, 0, R * 2, R * 2);
    return c;
  }
  function glint(col) {
    var c = sprite(col, 16, 0.3), g = c.getContext('2d');
    g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(32, 16); g.moveTo(16, 0); g.lineTo(16, 32); g.stroke();
    return c;
  }
  // Bitmaps are built in CSS px * S (the canvas scale), once per preset/resize.
  function buildBitmaps() {
    var p = PRESETS[state.preset], w, h, g, c;
    bmp.snow = sprite(p.snow.col, 8, 0.55);
    bmp.part = p.part.mode === 'glint' ? glint(p.part.col) : sprite(p.part.col, 16, 0.3);
    // Cloud bank: 160% of the view wide, 56% tall; three soft lobes (ported from the old CSS banks).
    w = W * 1.6 * S; h = H * 0.56 * S; c = mk(w, h); g = c.getContext('2d');
    blob(g, w * 0.18, h * 0.34, w * 0.40, h * 0.44, p.cloud[0], p.cloud[1]);
    blob(g, w * 0.46, h * 0.22, w * 0.32, h * 0.38, p.cloud[0], p.cloud[1] * 0.8);
    blob(g, w * 0.78, h * 0.38, w * 0.44, h * 0.42, p.cloud[0], p.cloud[1]);
    bmp.cloud = c;
    // Smoke bank along the ground: 150% wide, 55% tall.
    w = W * 1.5 * S; h = H * 0.55 * S; c = mk(w, h); g = c.getContext('2d');
    blob(g, w * 0.20, h * 0.80, w * 0.36, h * 0.56, p.smoke[0], p.smoke[1]);
    blob(g, w * 0.60, h * 0.90, w * 0.42, h * 0.52, p.smoke[0], p.smoke[1]);
    blob(g, w * 0.88, h * 0.72, w * 0.32, h * 0.46, p.smoke[0], p.smoke[1] * 0.8);
    bmp.smoke = c;
    // God-rays from above the top-left: wedges faded by a radial falloff (destination-in).
    w = W * S; h = H * 0.8 * S; c = mk(w, h); g = c.getContext('2d');
    var ox = w * 0.18, oy = -h * 0.1, R = Math.hypot(w, h) * 1.1;
    for (var i = 0; i < 26; i++) {
      var a0 = (168 + i * 15) * Math.PI / 180 - Math.PI / 2, strong = i % 2 === 0;
      var span = (strong ? 5 : 4) * Math.PI / 180;
      g.fillStyle = rgba(p.ray[0], p.ray[1] * (strong ? 1 : 0.6));
      g.beginPath(); g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(a0) * R, oy + Math.sin(a0) * R);
      g.lineTo(ox + Math.cos(a0 + span) * R, oy + Math.sin(a0 + span) * R);
      g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    g.save(); g.translate(ox, 0); g.scale(1, 1.25);
    var fall = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.62);
    fall.addColorStop(0.08, '#000'); fall.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fall; g.fillRect(-w, -h, w * 3, h * 3); g.restore();
    bmp.rays = c;
    // Static tints, one bitmap per layer group so unticking every layer returns the plain page:
    // sky glow (+ Moonlit's moon halo) rides with Light rays, the gutter wash with Clouds,
    // the ground glow with Smoke.
    w = W * S; h = H * S;
    c = mk(w, h); g = c.getContext('2d');
    blob(g, w * 0.5, h * 0.12, w * 0.40 * 1.4, h * 0.25 * 1.4, p.sky[0], p.sky[1]);
    if (p.moon) {
      var mr = Math.min(w, h) * 0.12, mx = w * 0.93 - mr, my = h * 0.14 + mr;
      var mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 1.4);
      mg.addColorStop(0, 'rgba(236,228,255,.22)'); mg.addColorStop(0.16, 'rgba(236,228,255,.22)');
      mg.addColorStop(0.34, 'rgba(170,150,255,.10)'); mg.addColorStop(0.7, 'rgba(170,150,255,0)');
      g.fillStyle = mg; g.fillRect(mx - mr * 1.4, my - mr * 1.4, mr * 2.8, mr * 2.8);
    }
    bmp.tintRays = c;
    c = mk(w, h); g = c.getContext('2d');
    var lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, rgba(p.side[0], p.side[1])); lg.addColorStop(0.18, rgba(p.side[0], 0));
    lg.addColorStop(0.82, rgba(p.side[0], 0)); lg.addColorStop(1, rgba(p.side[0], p.side[1]));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    bmp.tintClouds = c;
    c = mk(w, h); g = c.getContext('2d');
    lg = g.createLinearGradient(0, h, 0, 0);
    lg.addColorStop(0, rgba(p.ground[0], p.ground[1])); lg.addColorStop(0.34, rgba(p.ground[0], 0));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    bmp.tintSmoke = c;
    // Emberfall's low horizon glow.
    if (p.pulse) {
      w = W * 1.2 * S; h = H * 0.34 * S; c = mk(w, h); g = c.getContext('2d');
      blob(g, w * 0.5, h, w * 0.30, h * 0.70, p.pulse[0], p.pulse[1]);
      bmp.pulse = c;
    } else bmp.pulse = null;
  }

  function seed() {
    var p = PRESETS[state.preset];
    buildBitmaps();
    sprites.snow = []; sprites.particles = [];
    for (var i = 0, n = scaleCount(p.snow.n); i < n; i++) {
      sprites.snow.push({ x: gx(), y: Math.random() * H, r: rand(p.snow.r), a: rand(p.snow.a),
        vy: rand(p.snow.vy), ph: Math.random() * 6.28, sw: 0.3 + Math.random() * 0.7 });
    }
    for (var j = 0, m = scaleCount(p.part.n); j < m; j++) {
      sprites.particles.push({ x: gx(), y: Math.random() * H, r: rand(p.part.r), a: rand(p.part.a),
        vx: (Math.random() - 0.5) * 6, vy: p.part.mode === 'ember' ? -rand([18, 48]) : p.part.mode === 'mote' ? -rand([3, 10]) : rand([-3, 3]),
        ph: Math.random() * 6.28, tw: 0.6 + Math.random() * 1.8 });
    }
    draw(0, performance.now());
  }

  // Ease 0 -> 1 -> 0 over a period (like `alternate` + ease-in-out in the old CSS keyframes).
  function wave(t, period, ph) { return 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2 + (ph || 0)); }

  function draw(dt, t) {
    if (!ctx) return;
    var p = PRESETS[state.preset], i, s, f, d, v;
    if (reduced) t = 20000; // one fixed, calm frame
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(S, 0, 0, S, 0, 0); // draw in CSS px

    // Static tints.
    if (vis.rays > 0.01) { ctx.globalAlpha = vis.rays; ctx.drawImage(bmp.tintRays, 0, 0, W, H); }
    if (vis.clouds > 0.01) { ctx.globalAlpha = vis.clouds; ctx.drawImage(bmp.tintClouds, 0, 0, W, H); }
    if (vis.smoke > 0.01) { ctx.globalAlpha = vis.smoke; ctx.drawImage(bmp.tintSmoke, 0, 0, W, H); }
    // Light rays: breathing opacity (.6 -> 1 over 14s).
    if ((v = vis.rays) > 0.01) {
      // Full strength over the hero scene; softer over reading chapters so shafts never cross the text.
      ctx.globalAlpha = v * (0.6 + 0.4 * wave(t, 28000)) * (0.4 + 0.6 * Math.min(1, mid / 0.9));
      ctx.drawImage(bmp.rays, 0, 0, W, H * 0.8);
    }
    // Clouds: two banks drifting ±6% sideways over 80s / 120s; the second mirrored and fainter.
    if ((v = vis.clouds) > 0.01) {
      var cw = W * 1.6, ch = H * 0.56, x1 = -W * 0.3 + cw * (-0.06 + 0.12 * wave(t, 160000)), y1 = H * 0.06 + ch * 0.02 * wave(t, 160000);
      ctx.globalAlpha = v; ctx.drawImage(bmp.cloud, x1, y1, cw, ch);
      var x2 = -W * 0.3 + cw * (0.06 - 0.12 * wave(t, 240000));
      ctx.save(); ctx.globalAlpha = v * 0.7; ctx.translate(x2 + cw, H * 0.06 + ch * 0.08); ctx.scale(-1, 1);
      ctx.drawImage(bmp.cloud, 0, 0, cw, ch); ctx.restore();
    }
    // Smoke: low banks rolling ±5% along the ground (46s / 64s).
    if ((v = vis.smoke) > 0.01) {
      var sw = W * 1.5, sh = H * 0.55, sy = H + H * 0.12 - sh, k1 = wave(t, 92000), k2 = wave(t, 128000, Math.PI);
      ctx.globalAlpha = v; ctx.drawImage(bmp.smoke, -W * 0.25 + sw * (0.05 - 0.10 * k1), sy - sh * 0.04 * k1, sw, sh * (1 + 0.08 * k1));
      ctx.globalAlpha = v * 0.65; ctx.drawImage(bmp.smoke, -W * 0.25 + sw * (0.05 - 0.10 * k2), sy - sh * 0.04 * k2, sw, sh * (1 + 0.08 * k2));
      if (bmp.pulse) { // Emberfall horizon pulse (.55 -> 1 over 5.5s)
        ctx.globalAlpha = v * (0.55 + 0.45 * wave(t, 11000));
        ctx.drawImage(bmp.pulse, -W * 0.1, H * 0.76, W * 1.2, H * 0.34);
      }
    }
    // Falling snow (ash in Emberfall).
    if ((v = vis.snow) > 0.01) {
      for (i = 0; i < sprites.snow.length; i++) {
        s = sprites.snow[i];
        s.y += s.vy * dt; s.x += Math.sin(t * 0.0006 * s.sw + s.ph) * p.snow.sway * dt;
        if (s.y > H + 4) { s.y = -4; s.x = gx(); }
        if (s.x > W + 4) s.x = -4; else if (s.x < -4) s.x = W + 4;
        f = v * s.a * colFade(s.x); if (f < 0.02) continue;
        d = s.r * 2.6; ctx.globalAlpha = f; ctx.drawImage(bmp.snow, s.x - d, s.y - d, d * 2, d * 2);
      }
    }
    // Particles: glints / motes / embers, additive.
    if ((v = vis.particles) > 0.01) {
      var kk = p.part.mode === 'glint' ? 3.8 : 3.2;
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < sprites.particles.length; i++) {
        s = sprites.particles[i];
        s.x += (s.vx + Math.sin(t * 0.0009 + s.ph) * 8) * dt; s.y += s.vy * dt;
        if (s.y < -10) { s.y = H + 10; s.x = gx(); }
        if (s.y > H + 10) s.y = -10;
        if (s.x > W + 10) s.x = -10; else if (s.x < -10) s.x = W + 10;
        f = v * s.a * (0.55 + 0.45 * Math.sin(t * 0.002 * s.tw + s.ph)) * colFade(s.x); if (f < 0.02) continue;
        d = s.r * kk; ctx.globalAlpha = Math.min(1, f); ctx.drawImage(bmp.part, s.x - d, s.y - d, d * 2, d * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function anyOn() { return LAYERS.some(function (l) { return state.layers[l[0]] || vis[l[0]] > 0.01; }); }
  function wantsAnim() {
    return !reduced && layerEl && !document.hidden && !document.documentElement.classList.contains('pfx-atmo-hidden') && anyOn();
  }
  function frame(now) {
    raf = 0;
    if (!wantsAnim()) { loop(); return; }
    raf = requestAnimationFrame(frame);
    // Browser frame-rate watchdog (1s windows).
    if (!winT) winT = now;
    winN++;
    if (now - winT >= 1000) {
      var bfps = winN * 1000 / (now - winT);
      if (bfps < 24 && tier < TIERS.length - 1) tier++;
      winT = now; winN = 0;
    }
    // ~30fps over the hero scene (or the adaptive tier), at most 20fps once only the gutters show weather.
    var fps = Math.min(TIERS[tier], midTarget > 0 ? 30 : 20);
    if (now - lastDraw < 1000 / fps - 1) return;
    lastDraw = now;
    var dt = last ? Math.min(0.15, (now - last) / 1000) : 0; last = now;
    var e = Math.min(1, dt * 3);
    mid += (midTarget - mid) * e;
    LAYERS.forEach(function (l) { var k = l[0], to = state.layers[k] ? 1 : 0; vis[k] += (to - vis[k]) * Math.min(1, dt * 4); if (Math.abs(to - vis[k]) < 0.01) vis[k] = to; });
    draw(dt, now);
  }
  function loop() {
    if (wantsAnim()) { if (!raf) { last = 0; lastDraw = 0; winT = 0; winN = 0; raf = requestAnimationFrame(frame); } }
    else {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      LAYERS.forEach(function (l) { vis[l[0]] = state.layers[l[0]] ? 1 : 0; });
      mid = midTarget;
      if (ctx) draw(0, performance.now()); // static frame (reduced motion / hidden) or a cleared canvas
    }
  }

  function applyLayer(swap) {
    if (!layerEl) return;
    var set = function () { layerEl.setAttribute('data-weather', state.preset); };
    if (swap && !reduced) {
      // Cross-fade: dim the layer (.42s), switch palette + bitmaps + sprites, fade back in.
      layerEl.classList.add('is-swapping');
      setTimeout(function () { set(); seed(); layerEl.classList.remove('is-swapping'); }, 420);
    } else { set(); if (swap) seed(); else draw(0, performance.now()); }
    loop();
  }

  /* ---------------- control (port of aside.atmosphere) ---------------- */
  function buildUI() {
    ui = document.createElement('aside');
    ui.className = 'pfx-atmo';
    ui.setAttribute('aria-label', 'World atmosphere');
    ui.setAttribute('data-pfx-owned', 'atmosphere');
    var presets = Object.keys(PRESETS).map(function (k) {
      var p = PRESETS[k];
      return '<button type="button" class="pfx-atmo-preset" data-weather="' + k + '" aria-pressed="false"><i aria-hidden="true">' + p.icon +
        '</i><span><strong>' + p.name + '</strong><small>' + p.desc + '</small></span></button>';
    }).join('');
    var layers = LAYERS.map(function (l) {
      return '<label><input type="checkbox" data-weather-layer="' + l[0] + '">' + l[1] + '</label>';
    }).join('');
    ui.innerHTML =
      '<button type="button" class="pfx-atmo-toggle" id="pfx-atmo-toggle" aria-expanded="false" aria-controls="pfx-atmo-panel"><span aria-hidden="true">✧</span> Atmosphere <span class="pfx-atmo-current"></span></button>' +
      '<div class="pfx-atmo-panel" id="pfx-atmo-panel" role="dialog" aria-label="Set the atmosphere" hidden>' +
      '<div class="pfx-atmo-heading"><h2>Set the atmosphere</h2><button type="button" class="pfx-atmo-close" aria-label="Close atmosphere">×</button></div>' +
      '<div class="pfx-atmo-presets" role="group" aria-label="Background choices">' + presets + '</div>' +
      '<fieldset class="pfx-atmo-layers"><legend>LAYERS</legend>' + layers + '</fieldset>' +
      '<p class="pfx-atmo-note">Choose a world, then make it your own.</p></div>';
    document.body.appendChild(ui);

    var toggle = ui.querySelector('.pfx-atmo-toggle'), panel = ui.querySelector('.pfx-atmo-panel');
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    }
    toggle.addEventListener('click', function () { setOpen(panel.hasAttribute('hidden')); });
    // Return focus to the pill only for keyboard closes (e.detail === 0), so a mouse close leaves no ring.
    ui.querySelector('.pfx-atmo-close').addEventListener('click', function (e) { setOpen(false); if (e.detail === 0) toggle.focus(); else toggle.blur(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hasAttribute('hidden')) { setOpen(false); toggle.focus(); } });
    document.addEventListener('pointerdown', function (e) { if (!panel.hasAttribute('hidden') && !ui.contains(e.target)) setOpen(false); });
    Array.prototype.forEach.call(ui.querySelectorAll('.pfx-atmo-preset'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-weather');
        if (k === state.preset) return;
        state.preset = k; save(); syncUI(); applyLayer(true);
      });
    });
    Array.prototype.forEach.call(ui.querySelectorAll('input[data-weather-layer]'), function (inp) {
      inp.addEventListener('change', function () {
        state.layers[inp.getAttribute('data-weather-layer')] = inp.checked; save(); applyLayer(false);
      });
    });
    syncUI();
  }

  function syncUI() {
    if (!ui) return;
    ui.querySelector('.pfx-atmo-current').textContent = PRESETS[state.preset].name;
    Array.prototype.forEach.call(ui.querySelectorAll('.pfx-atmo-preset'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-weather') === state.preset ? 'true' : 'false');
    });
    Array.prototype.forEach.call(ui.querySelectorAll('input[data-weather-layer]'), function (inp) {
      inp.checked = !!state.layers[inp.getAttribute('data-weather-layer')];
    });
  }

  /* ---------------- mount (idempotent; re-run after every React render) ---------------- */
  ProtoFx.on('atmosphere', function () {
    if (!document.body) return;
    if (!layerEl) { buildLayer(); applyLayer(false); }
    else if (!layerEl.isConnected) { // its hero was unmounted by a page switch: back to the body
      layerEl.classList.remove('is-hero'); layerEl.style.transform = ''; layerEl.style.height = '';
      document.body.insertBefore(layerEl, document.body.firstChild);
    }
    if (!ui || !ui.isConnected) buildUI();
    // Not inside the Broadcast app (.cbk): it has its own opaque surface and chrome.
    var br = ProtoFx.bridge();
    var inApp = !!document.querySelector('.cbk') || (br && br.page === 'backing');
    var root = document.documentElement;
    if (root.classList.contains('pfx-atmo-hidden') !== inApp) { root.classList.toggle('pfx-atmo-hidden', inApp); loop(); }
    heroCheck();
  });
})();
