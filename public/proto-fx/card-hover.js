/* proto-fx piece: card-hover — restrained pointer tilt for every site card.
   The React Card tilts up to 22deg; card-hover.css overrides its inline transform and
   reads --pfx-rx / --pfx-ry, which this script writes (max 8deg, like the prototype's
   calm covers). Card List thumbs get the same lift without tilt. No clicks are touched:
   the existing onClick handlers still open CardModal / the card detail modal. */
(function () {
  if (!window.ProtoFx) return;
  var MAX = 8;
  var fine = true; try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}

  function move(e) {
    var el = e.currentTarget;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    px = Math.max(-0.5, Math.min(0.5, px)); py = Math.max(-0.5, Math.min(0.5, py));
    el.style.setProperty('--pfx-rx', (-py * 2 * MAX).toFixed(2) + 'deg');
    el.style.setProperty('--pfx-ry', (px * 2 * MAX).toFixed(2) + 'deg');
  }
  function leave(e) {
    var el = e.currentTarget;
    el.style.setProperty('--pfx-rx', '0deg');
    el.style.setProperty('--pfx-ry', '0deg');
  }

  ProtoFx.on('card-hover', function (root) {
    var cards = root.querySelectorAll('[data-pfx="card"]');
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (el.__pfxCardHover) continue;
      el.__pfxCardHover = true;
      // Full-card art: let the light band follow the art's own silhouette.
      var img = el.querySelector(':scope > img');
      if (img && img.src) el.style.setProperty('--pfx-card-mask', 'url("' + img.src.replace(/"/g, '%22') + '")');
      if (ProtoFx.reduced || !fine) continue;
      el.addEventListener('pointermove', move, { passive: true });
      el.addEventListener('pointerleave', leave, { passive: true });
    }
  });
})();
