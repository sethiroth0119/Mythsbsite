/* Shared helpers, DOM handles and the progress store.
   Loaded before everything except the content and the generator. */
"use strict";

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
