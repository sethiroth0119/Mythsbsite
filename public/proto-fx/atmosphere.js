/* proto-fx piece: atmosphere — the prototype's "✧ Atmosphere" control (aside.atmosphere) plus a light
   ambient weather layer driven by its three presets (Frostfall / Moonlit Veil / Emberfall) and five
   layer switches (Clouds, Smoke, Light rays, Falling snow, Particles).
   - Layer: fixed, pointer-events none, CSS gradients + two small canvases (DPR 1, ~110 sprites max,
     paused when the tab is hidden or the layer is off). Reduced motion => one static frame, no animation.
   - Choice is remembered per viewer in localStorage ('pfxAtmosphere'), always inside try/catch.
   - Hidden inside the Broadcast (.cbk) app, which is its own product surface. */
(function () {
  if (!window.ProtoFx) return;

  var KEY = 'pfxAtmosphere';
  var LAYERS = [['clouds', 'Clouds'], ['smoke', 'Smoke'], ['rays', 'Light rays'], ['snow', 'Falling snow'], ['particles', 'Particles']];
  var PRESETS = {
    frostfall: { name: 'Frostfall', icon: '❄', desc: 'Silver clouds · drifting snow · icy rays',
      snow: { n: 70, col: '235,242,250', vy: [22, 55], r: [0.8, 2.4], a: [0.35, 0.8], sway: 22 },
      part: { n: 26, col: '190,228,255', mode: 'glint', r: [0.6, 1.6], a: [0.2, 0.9] } },
    moonlit: { name: 'Moonlit Veil', icon: '☾', desc: 'Violet mist · moonbeams · floating motes',
      snow: { n: 34, col: '222,214,255', vy: [10, 26], r: [0.8, 2.0], a: [0.25, 0.6], sway: 30 },
      part: { n: 40, col: '196,170,255', mode: 'mote', r: [0.9, 2.4], a: [0.25, 0.85] } },
    emberfall: { name: 'Emberfall', icon: '♨', desc: 'Rolling smoke · amber light · embers',
      snow: { n: 38, col: '150,140,132', vy: [14, 34], r: [0.8, 2.2], a: [0.2, 0.5], sway: 26 },
      part: { n: 46, col: '255,160,70', mode: 'ember', r: [0.8, 2.2], a: [0.45, 1] } }
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

  var layerEl, ui, canvases = {}, raf = 0, last = 0, sprites = { snow: [], particles: [] }, W = 0, H = 0;

  function rand(a) { return a[0] + Math.random() * (a[1] - a[0]); }

  /* ---------------- ambient layer ---------------- */
  function buildLayer() {
    layerEl = document.createElement('div');
    layerEl.className = 'pfx-atmo-layer';
    layerEl.setAttribute('aria-hidden', 'true');
    layerEl.setAttribute('data-pfx-owned', 'atmosphere');
    layerEl.innerHTML =
      '<div class="pfx-atmo-tint"></div>' +
      '<div class="pfx-atmo-rays" data-layer="rays"></div>' +
      '<div class="pfx-atmo-clouds" data-layer="clouds"><i></i><i></i></div>' +
      '<div class="pfx-atmo-smoke" data-layer="smoke"><i></i><i></i></div>' +
      '<canvas data-layer="snow"></canvas>' +
      '<canvas data-layer="particles"></canvas>';
    // First child of <body>: it paints above the Wasteland backdrop / page backgrounds but below
    // every positioned section that follows it, and never takes pointer events.
    document.body.insertBefore(layerEl, document.body.firstChild);
    canvases.snow = layerEl.querySelector('canvas[data-layer=snow]');
    canvases.particles = layerEl.querySelector('canvas[data-layer=particles]');
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', loop);
    resize();
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    ['snow', 'particles'].forEach(function (k) { var c = canvases[k]; if (c) { c.width = W; c.height = H; } });
    seed();
  }

  function scaleCount(n) { return Math.round(n * Math.max(0.45, Math.min(1, (W * H) / (1440 * 900)))); }

  function seed() {
    var p = PRESETS[state.preset];
    sprites.snow = []; sprites.particles = [];
    for (var i = 0, n = scaleCount(p.snow.n); i < n; i++) {
      sprites.snow.push({ x: Math.random() * W, y: Math.random() * H, r: rand(p.snow.r), a: rand(p.snow.a),
        vy: rand(p.snow.vy), ph: Math.random() * 6.28, sw: 0.3 + Math.random() * 0.7 });
    }
    for (var j = 0, m = scaleCount(p.part.n); j < m; j++) {
      sprites.particles.push({ x: Math.random() * W, y: Math.random() * H, r: rand(p.part.r), a: rand(p.part.a),
        vx: (Math.random() - 0.5) * 14, vy: p.part.mode === 'ember' ? -rand([18, 48]) : p.part.mode === 'mote' ? -rand([3, 10]) : rand([-3, 3]),
        ph: Math.random() * 6.28, tw: 0.6 + Math.random() * 1.8 });
    }
    draw(0, 0);
  }

  function draw(dt, t) {
    var p = PRESETS[state.preset];
    var cs = canvases.snow, cp = canvases.particles;
    if (cs && state.layers.snow) {
      var g = cs.getContext('2d'); g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgb(' + p.snow.col + ')';
      sprites.snow.forEach(function (s) {
        s.y += s.vy * dt; s.x += Math.sin(t * 0.0006 * s.sw + s.ph) * p.snow.sway * dt;
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
        if (s.x > W + 4) s.x = -4; else if (s.x < -4) s.x = W + 4;
        g.globalAlpha = s.a; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.2832); g.fill();
      });
      g.globalAlpha = 1;
    }
    if (cp && state.layers.particles) {
      var c = cp.getContext('2d'); c.clearRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      sprites.particles.forEach(function (s) {
        s.x += (s.vx + Math.sin(t * 0.0009 + s.ph) * 8) * dt; s.y += s.vy * dt;
        if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
        if (s.y > H + 10) s.y = -10;
        if (s.x > W + 10) s.x = -10; else if (s.x < -10) s.x = W + 10;
        var tw = 0.55 + 0.45 * Math.sin(t * 0.002 * s.tw + s.ph);
        var alpha = s.a * (reduced ? 0.8 : tw);
        var rad = s.r * (p.part.mode === 'glint' ? 2.4 : 3.2);
        var grd = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
        grd.addColorStop(0, 'rgba(' + p.part.col + ',' + alpha + ')');
        grd.addColorStop(0.35, 'rgba(' + p.part.col + ',' + alpha * 0.45 + ')');
        grd.addColorStop(1, 'rgba(' + p.part.col + ',0)');
        c.fillStyle = grd; c.beginPath(); c.arc(s.x, s.y, rad, 0, 6.2832); c.fill();
        if (p.part.mode === 'glint' && tw > 0.85) { // icy four-point glint
          c.strokeStyle = 'rgba(' + p.part.col + ',' + alpha * 0.6 + ')'; c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(s.x - rad * 1.6, s.y); c.lineTo(s.x + rad * 1.6, s.y);
          c.moveTo(s.x, s.y - rad * 1.6); c.lineTo(s.x, s.y + rad * 1.6); c.stroke();
        }
      });
      c.globalCompositeOperation = 'source-over';
    }
  }

  function wantsAnim() {
    return !reduced && layerEl && !document.hidden && !document.documentElement.classList.contains('pfx-atmo-hidden') &&
      (state.layers.snow || state.layers.particles);
  }
  function frame(now) {
    raf = 0;
    if (!wantsAnim()) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    draw(dt, now);
    raf = requestAnimationFrame(frame);
  }
  function loop() {
    if (wantsAnim()) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function applyLayer(swap) {
    if (!layerEl) return;
    var set = function () {
      layerEl.setAttribute('data-weather', state.preset);
      Array.prototype.forEach.call(layerEl.querySelectorAll('[data-layer]'), function (el) {
        el.classList.toggle('is-off', !state.layers[el.getAttribute('data-layer')]);
      });
    };
    if (swap && !reduced) {
      // Cross-fade: dim the whole layer, switch palette + sprites, fade back in (1.2s like the layer transition).
      layerEl.classList.add('is-swapping');
      setTimeout(function () { set(); seed(); layerEl.classList.remove('is-swapping'); }, 420);
    } else { set(); }
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
    ui.querySelector('.pfx-atmo-close').addEventListener('click', function () { setOpen(false); toggle.focus(); });
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
    if (!layerEl || !layerEl.isConnected) { buildLayer(); applyLayer(false); }
    if (!ui || !ui.isConnected) buildUI();
    // Not inside the Broadcast app (.cbk): it has its own opaque surface and chrome.
    var br = ProtoFx.bridge();
    var inApp = !!document.querySelector('.cbk') || (br && br.page === 'backing');
    var root = document.documentElement;
    if (root.classList.contains('pfx-atmo-hidden') !== inApp) { root.classList.toggle('pfx-atmo-hidden', inApp); loop(); }
  });
})();
