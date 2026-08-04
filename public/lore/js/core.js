/* Shared helpers, DOM handles and the progress store.
   Loaded before everything except the content and the generator. */
"use strict";

/* Does this string actually point at a page image? Used by BOTH the reader (so
   prose never renders as a broken <img>) and the editor (so prose never gets
   stored as a page in the first place). http(s) URL, data: image, or a path
   that ends in an image extension. */
function isPageImageRef(s) {
  s = String(s || '').trim();
  if (!s) return false;
  if (/^data:image\//i.test(s)) return true;
  if (/^(https?:)?\/\//i.test(s)) return true;
  return /\.(png|jpe?g|webp|gif|avif|bmp)(\?|#|$)/i.test(s);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const $ = s => document.querySelector(s);
const stage = $('#stage'), world = $('#world'), veil = $('#veil');
const briefEl = $('#brief'), reader = $('#reader'), toastEl = $('#toast');
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ── Progress store (persists on your site, memory-only in preview) ── */
const Store = (() => {
  const KEY = 'ashfall.storymap.v1';
  let data = { read: [], claimed: [] }, live = false;
  try {
    localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe');
    live = true;
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { live = false; }
  const save = () => { if (live) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} } };
  return {
    isRead: id => data.read.includes(id),
    markRead: id => { if (!data.read.includes(id)) { data.read.push(id); save(); } },
    isClaimed: c => data.claimed.includes(c),
    markClaimed: c => { if (!data.claimed.includes(c)) { data.claimed.push(c); save(); } }
  };
})();
