/* proto-fx piece: card-hover — prototype cover hover for every site card.
   The prototype's grid covers never tilt with the pointer (only rotate(-1deg) on hover), so the
   React Card's 22deg inline tilt is overridden in card-hover.css and no pointer tilt is added here.
   This script only feeds the light band its clipping:
     - full-card art (<img> is the whole card): --pfx-card-mask = the image, so the band follows
       the card's own silhouette (thumbs are flagged data-pfx-mask);
     - framed/cover art: --pfx-thumb-r = the art box's inner radius for a rounded clip-path.
   No clicks are touched: the existing onClick handlers still open CardModal / the detail modal. */
(function () {
  if (!window.ProtoFx) return;

  function maskUrl(src) { return 'url("' + src.replace(/"/g, '%22') + '")'; }
  function setVar(el, k, v) { if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); }
  // The mask alone lets the band through faint alpha (soft shadows) around a card image, so the band
  // is also clipped to the image's opaque card. The band carries the same zoom as the <img>
  // (archive-gallery's --pfx-ag-*), so in its own coordinates the card sits where the contained
  // image puts it: measure the opaque bounds once per src and clip to them.
  var bounds = {}, waiting = {};
  function measure(src, cb) {
    if (bounds[src]) return cb(bounds[src]);
    if (waiting[src]) return waiting[src].push(cb);
    waiting[src] = [cb];
    var im = new Image();
    im.onload = function () {
      var res = { l: 0, t: 0, r: 1, b: 1, ar: im.naturalWidth / im.naturalHeight || 2 / 3 };
      try {
        var W = 96, H = Math.max(1, Math.round(96 / res.ar));
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, W, H);
        var d = cx.getImageData(0, 0, W, H).data, l = W, r = -1, t = H, bt = -1;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 140) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y; }
        }
        if (r > l && bt > t) { res.l = l / W; res.r = (r + 1) / W; res.t = t / H; res.b = (bt + 1) / H; }
      } catch (e) {}
      bounds[src] = res;
      waiting[src].forEach(function (f) { f(res); }); delete waiting[src];
    };
    im.onerror = function () { bounds[src] = { l: 0, t: 0, r: 1, b: 1, ar: 2 / 3 }; delete waiting[src]; };
    im.src = src;
  }
  function bandClip(el, box, src, radiusPx) {
    measure(src, function (bb) {
      var w = box.offsetWidth, h = box.offsetHeight;
      if (!w || !h) return;
      var boxAr = w / h, dw = Math.min(1, bb.ar / boxAr), dh = Math.min(1, boxAr / bb.ar);
      var L = (1 - dw) / 2 + bb.l * dw, R = (1 - dw) / 2 + bb.r * dw;
      var T = (1 - dh) / 2 + bb.t * dh, B = (1 - dh) / 2 + bb.b * dh;
      var s = parseFloat(el.style.getPropertyValue('--pfx-ag-s')) || 1;
      function p(n) { return (Math.max(0, n) * 100).toFixed(2) + '%'; }
      setVar(el, '--pfx-band-clip', 'inset(' + p(T) + ' ' + p(1 - R) + ' ' + p(1 - B) + ' ' + p(L) +
        ' round ' + (radiusPx / s).toFixed(1) + 'px)');
    });
  }

  ProtoFx.on('card-hover', function (root) {
    var cards = root.querySelectorAll('[data-pfx="card"]');
    for (var i = 0; i < cards.length; i++) {
      var img = cards[i].querySelector(':scope > img');
      if (img && img.src) {
        setVar(cards[i], '--pfx-card-mask', maskUrl(img.src));
        bandClip(cards[i], cards[i], img.src, parseFloat(getComputedStyle(cards[i]).borderTopRightRadius) || 12);
      }
    }
    var thumbs = root.querySelectorAll('[data-pfx="card-thumb"]');
    for (var j = 0; j < thumbs.length; j++) {
      var t = thumbs[j];
      // Hand the button's rarity border colour to the art box frame.
      var c = t.style.borderColor;
      if (c && t.__pfxRarity !== c) { t.__pfxRarity = c; t.style.setProperty('--pfx-rarity', c); }
      var box = t.querySelector(':scope > div:first-child');
      if (!box) continue;
      var im = box.querySelector(':scope > img');
      var full = !!(im && im.src && im.style.display !== 'none' &&
        (/\bobject-contain\b/.test(im.className) || t.getAttribute('data-pfx-ag-kind') === 'full'));
      if (full) {
        setVar(t, '--pfx-card-mask', maskUrl(im.src));
        if (!t.hasAttribute('data-pfx-mask')) t.setAttribute('data-pfx-mask', '');
        bandClip(t, box, im.src, parseFloat(getComputedStyle(box).borderTopRightRadius) || 12);
      } else {
        if (t.hasAttribute('data-pfx-mask')) t.removeAttribute('data-pfx-mask');
        var cs = getComputedStyle(box);
        var r = Math.max(0, (parseFloat(cs.borderTopRightRadius) || 8) - (parseFloat(cs.borderTopWidth) || 0));
        setVar(t, '--pfx-thumb-r', r.toFixed(1) + 'px');
      }
    }
  });
})();
