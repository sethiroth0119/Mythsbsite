/* proto-fx piece: world-lore — fills [data-pfx-slot="home-world"] with the prototype's
   "Every place holds a story" chapter (section#world-lore), using the site's real lore
   archive content (public/lore/data/content.js: Cinderfall Basin, Black River Derricks,
   The Reach of Kallix, Emberhold; comic issues unlock reward codes). The "Explore the lore
   map" link goes to the site's own ./lore/ page, same as the navbar's Lore link.
   Idempotent: the section is only built when the slot is empty (React may remount it). */
(function () {
  if (!window.ProtoFx) return;
  var HTML =
    '<section class="pfx-world-chapter world-chapter" id="world-lore" aria-labelledby="pfx-lore-title">' +
      '<div class="chapter-rule"><span>01 / Beyond the battlefield</span><span>The world of Mythic Spellbook</span></div>' +
      '<div class="world-spread">' +
        '<div class="world-illustration">' +
          '<img src="__IMG__" alt="A luminous fantasy landscape beneath a vast night sky" loading="lazy" decoding="async">' +
          '<div class="world-compass" aria-hidden="true">✧</div>' +
          '<span class="image-caption">New America · The Burnt Meridian</span>' +
        '</div>' +
        '<div class="world-prose">' +
          '<p class="eyebrow">The lore archive</p>' +
          '<h2 id="pfx-lore-title">Every place<br>holds <em>a story.</em></h2>' +
          '<p>Follow the seals across New America. The lore archive connects places on an interactive map to comic issues, from Cinderfall Basin to the Reach of Kallix.</p>' +
          '<p>Open a site, read its story, and discover what survived. Completed issues can unlock reward codes to redeem in the game.</p>' +
          '<a class="text-link" href="./lore/">Explore the lore map <span aria-hidden="true">↗</span></a>' +
          '<div class="field-note"><span>Places in the archive</span><p>Cinderfall Basin · Black River Derricks<br>The Reach of Kallix · Emberhold</p></div>' +
        '</div>' +
      '</div>' +
    '</section>';

  ProtoFx.on('world-lore', function () {
    ProtoFx.slots('home-world').forEach(function (slot) {
      if (slot.querySelector('.pfx-world-chapter')) return;
      slot.setAttribute('data-pfx-owned', '');
      slot.innerHTML = HTML.replace('__IMG__', ProtoFx.asset('distant-world.webp'));
    });
  });
})();
