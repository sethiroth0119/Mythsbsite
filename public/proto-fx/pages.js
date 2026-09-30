/* proto-fx piece: pages — carries the prototype's look onto the screens the home-page pieces don't
   reach: the Backing (Emergency Broadcast) dashboard, Community, Shop and RMT inside the React app,
   and the standalone pages lore/ and ethos-buy.html (which include the loader with
   data-pfx-pieces="pages"). All styling is in pages.css, keyed off html[data-pfx-page=<screen>];
   this script only keeps that attribute in sync with the screen being shown. It changes no
   behaviour, links or handlers. */
(function () {
  if (!window.ProtoFx) return;
  var root = document.documentElement;
  function staticPage() {
    var p = location.pathname;
    if (/\/lore(\/|\/index\.html)?$/.test(p)) return 'lore';
    if (/ethos-buy\.html$/.test(p)) return 'ethos';
    return '';
  }
  function sync() {
    var b = window.MSBridge;
    var page = staticPage() || (b && b.page) || (document.getElementById('root') ? 'home' : '');
    if (page && root.getAttribute('data-pfx-page') !== page) root.setAttribute('data-pfx-page', page);
  }
  sync();
  ProtoFx.on('pages', sync);
  window.addEventListener('ms:render', sync);
})();
