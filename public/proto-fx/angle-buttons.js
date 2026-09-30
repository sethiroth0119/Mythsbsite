/* proto-fx piece: angle-buttons — tags the site's primary ember CTAs so angle-buttons.css can give them
   the prototype's engraved .angle-button look. .ga-btn / .ga-btn--ghost are styled by CSS alone; this only
   adds a class to the orange->red gradient CTAs (deck builder, card/hero modal "Play", news "Read Full",
   hub sign-in, coliseum). It never changes handlers, hrefs or text, so every button still goes where it did. */
(function () {
  if (!window.ProtoFx) return;
  var SEL = 'a[class*="from-orange-600"], button[class*="from-orange-600"]';
  function isPrimary(el) {
    var c = ' ' + (el.getAttribute('class') || '') + ' ';
    if (c.indexOf('bg-gradient-to-') < 0) return false;
    if (!/ to-red-[678]00(\/\d+)? /.test(c)) return false;
    if (/ (fixed|absolute) /.test(c)) return false;             // floating FAB / hover-revealed "+ Load card" keep their placement
    var p = el.parentElement;                                   // filter/toggle rows (active chip uses the same gradient)
    if (p && p.querySelectorAll(':scope > button, :scope > a').length >= 3) return false;
    if (el.closest('.cbk, [data-pfx-owned]')) return false;     // Broadcast platform + other pieces' UI
    return true;
  }
  ProtoFx.on('angle-buttons', function (root) {
    var els = (root || document).querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('pfx-ab') || !isPrimary(el)) continue;
      el.classList.add('pfx-ab');
      if (/ (block|w-full|flex) /.test(' ' + el.getAttribute('class') + ' ')) el.classList.add('pfx-ab--block');
    }
  });
})();
