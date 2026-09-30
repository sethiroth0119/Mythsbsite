/* proto-fx loader — brings the prototype's look & effects onto mythicspellbook.xyz.
   Included once from index.html <head>. Each piece is a CSS + JS pair in this folder
   (proto-fx/<id>.css, proto-fx/<id>.js), owned by one piece only. Pieces ENHANCE the
   React site; they never replace its features. The site exposes its real data and
   navigation on window.MSBridge (see App() in index.html) and fires 'ms:render'
   after every React render.

   Switches (for before/after captures and for bisecting problems):
     ?pfx=off                  or localStorage.protoFx = 'off'        -> no pieces at all
     ?pfxOff=a,b               or localStorage.protoFxOff = 'a,b'     -> skip these pieces
     ?pfxOnly=a,b              or localStorage.protoFxOnly = 'a,b'    -> load only these

   Helper API for piece JS (window.ProtoFx):
     ProtoFx.on(id, fn)        run fn(root=document) once the DOM exists and again (debounced)
                               after every React render / DOM change. fn must be idempotent.
     ProtoFx.slots(name)       -> [...elements with data-pfx-slot=name] currently on the page
     ProtoFx.bridge()          -> window.MSBridge or null (real cards, heroes, openCard, go.*)
     ProtoFx.reduced           -> true when the viewer prefers reduced motion
     ProtoFx.asset(p)          -> URL of a file in assets/proto/ (the prototype's art)
     ProtoFx.status()          -> { enabled, pieces: {id: 'loaded'|'error'|'off'} }  (used by the capture harness)
*/
(function () {
  var VERSION = '1';
  var PIECES = [
    'boot-loader', 'header-band', 'angle-buttons', 'hero-title', 'hero-covers', 'card-hover',
    'inspector', 'collection-showcase', 'chapters', 'scroll-reveal', 'world-lore',
    'survivor-portraits', 'faction-tabs', 'subclass-items', 'archive-gallery', 'atmosphere',
    'realm-footer', 'links', 'pages'
  ];
  // Standalone pages (lore/, ethos-buy.html) include this loader with data-pfx-pieces="pages" so they
  // only get the shared tokens plus the page restyle, not the home page's React-bound pieces.
  var me = document.currentScript;
  var scoped = me && me.getAttribute('data-pfx-pieces');
  if (scoped) PIECES = scoped.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  var q = {}; try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) {}
  var ls = function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  var list = function (s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
  var off = q.pfx === 'off' || ls('protoFx') === 'off';
  var skip = list(q.pfxOff || ls('protoFxOff'));
  var only = list(q.pfxOnly || ls('protoFxOnly'));
  var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/loader\.js.*$/, '') : './proto-fx/';
  var status = {};
  var handlers = [];
  var reduced = false; try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var api = window.ProtoFx = {
    version: VERSION, enabled: !off, base: base, reduced: reduced,
    status: function () { return { enabled: !off, pieces: status }; },
    bridge: function () { return window.MSBridge || null; },
    asset: function (p) { return base.replace(/proto-fx\/$/, '') + 'assets/proto/' + p; },
    slots: function (name) { return Array.prototype.slice.call(document.querySelectorAll('[data-pfx-slot="' + name + '"]')); },
    on: function (id, fn) {
      handlers.push({ id: id, fn: fn });
      if (document.readyState !== 'loading') run(handlers[handlers.length - 1]);
    }
  };
  function run(h) { try { h.fn(document); } catch (e) { status[h.id] = 'error'; console.error('[proto-fx] ' + h.id + ':', e); } }
  var t = null, running = false;
  function runAll() { t = null; running = true; handlers.forEach(run); running = false; }
  function schedule() { if (!t && !running) t = setTimeout(runAll, 60); }
  document.addEventListener('DOMContentLoaded', function () {
    runAll();
    try { new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { var n = muts[i].target; if (!(n.closest && n.closest('[data-pfx-owned]'))) { schedule(); return; } }
    }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  });
  window.addEventListener('ms:render', schedule);

  if (off) { PIECES.forEach(function (id) { status[id] = 'off'; }); return; }
  var root = document.documentElement;
  root.classList.add('pfx');
  document.write('<link rel="stylesheet" href="' + base + 'base.css?v=' + VERSION + '">');
  PIECES.forEach(function (id) {
    if (skip.indexOf(id) >= 0 || (only.length && only.indexOf(id) < 0)) { status[id] = 'off'; return; }
    status[id] = 'loading';
    root.classList.add('pfx-' + id);
    document.write('<link rel="stylesheet" href="' + base + id + '.css?v=' + VERSION + '">');
    document.write('<script src="' + base + id + '.js?v=' + VERSION + '" onload="ProtoFx.status().pieces[\'' + id + '\']=(ProtoFx.status().pieces[\'' + id + '\']===\'error\'?\'error\':\'loaded\')" onerror="ProtoFx.status().pieces[\'' + id + '\']=\'error\'"><\/script>');
  });
})();
