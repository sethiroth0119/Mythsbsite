/* The comic reader: issue rail, pages, placeholder layouts, rewards. */
"use strict";

/* ── Placeholder comic pages (swap in real art any time) ───── */
const PANELS = {
  splash: [[60, 60, 880, 1180]],
  hero: [[60, 60, 880, 700], [60, 790, 880, 450]],
  grid: [[60, 60, 420, 560], [520, 60, 420, 560], [60, 660, 420, 580], [520, 660, 420, 580]],
  strip: [[60, 60, 880, 380], [60, 470, 880, 380], [60, 880, 880, 360]]
};
function placeholderPage(spec, issue, idx) {
  const boxes = PANELS[spec.layout] || PANELS.hero;
  const caps = spec.cap || [];
  let inner = '<rect width="1000" height="1540" fill="#080B0D"/>';
  boxes.forEach((b, i) => {
    const g = 'g' + idx + '_' + i;
    inner += '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + (i % 2 ? '#1A222A' : '#141B21') + '"/>' +
      '<stop offset="1" stop-color="#0A0E11"/></linearGradient></defs>' +
      '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" fill="url(#' + g + ')" stroke="#2A343C" stroke-width="2"/>' +
      '<rect x="' + (b[0] + 10) + '" y="' + (b[1] + 10) + '" width="' + (b[2] - 20) + '" height="' + (b[3] - 20) + '" fill="none" stroke="#C4923A" stroke-opacity=".1"/>';
    const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
    inner += '<circle cx="' + cx + '" cy="' + cy + '" r="' + Math.min(b[2], b[3]) * 0.26 + '" fill="none" stroke="#FFC15E" stroke-opacity=".12" stroke-width="1.5"/>' +
      '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="4" fill="#5F6A62" fill-opacity=".7">PANEL ' + (i + 1) + '</text>';
    const cap = caps[i];
    if (cap) {
      const w = Math.min(b[2] - 44, 12 + cap.length * 10.2);
      inner += '<rect x="' + (b[0] + 22) + '" y="' + (b[1] + 22) + '" width="' + w + '" height="46" fill="#DFE4DE"/>' +
        '<text x="' + (b[0] + 36) + '" y="' + (b[1] + 52) + '" font-family="Spectral, Georgia, serif" font-size="19" fill="#0A0E11">' + escapeHtml(cap) + '</text>';
    }
  });
  if (spec.sfx) {
    inner += '<text x="500" y="1330" text-anchor="middle" font-family="Grenze Gotisch, serif" font-weight="800" font-size="104" letter-spacing="6" fill="#FFC15E" stroke="#06080A" stroke-width="7" paint-order="stroke">' + escapeHtml(spec.sfx) + '</text>';
  }
  inner += '<text x="60" y="1500" font-family="JetBrains Mono, monospace" font-size="15" letter-spacing="4" fill="#5F6A62">ASHFALL · ' + escapeHtml(issue.title.toUpperCase()) + '</text>' +
    '<text x="940" y="1500" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="15" letter-spacing="4" fill="#5F6A62">' + (idx + 1) + '</text>';
  return '<svg id="page" viewBox="0 0 1000 1540" width="1000" height="1540" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

/* ── Reader ────────────────────────────────────────────────── */
let cur = { loc: null, issue: null, ix: 0, page: 0, pages: [] };

function openReader(loc, issueIndex) {
  closeBrief();
  cur.loc = loc;
  selectIssue(issueIndex, true);
  reader.classList.add('on');
  document.body.style.overflow = 'hidden';
  $('#closeBtn').focus();
}
function selectIssue(ix, first) {
  const loc = cur.loc, issue = loc.issues[ix];
  if (!issue || issue.locked) return;
  cur.issue = issue; cur.ix = ix; cur.page = 0;
  cur.pages = issue.pages.slice();
  if (issue.reward) cur.pages.push({ type: 'reward', reward: issue.reward });
  $('#readerId').textContent = 'ISSUE ' + issue.no;
  $('#readerName').textContent = issue.title;
  buildRail();
  renderPage();
  if (!first) $('#pageWrap').scrollTop = 0;
}
function buildRail() {
  const rail = $('#issueRail');
  rail.innerHTML = '';
  cur.loc.issues.forEach((iss, i) => {
    const b = document.createElement('button');
    b.className = 'issue-chip' + (iss.locked ? ' locked' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-current', i === cur.ix ? 'true' : 'false');
    b.innerHTML = '<span class="n">' + escapeHtml(iss.no) + '</span>' + escapeHtml(iss.title) +
      (iss.reward ? '<span class="r">◆ REWARD</span>' : '') +
      (iss.locked ? '<span class="r">SEALED</span>' : '');
    if (!iss.locked) b.addEventListener('click', () => selectIssue(i));
    rail.appendChild(b);
  });
}
function renderPage() {
  const slot = $('#pageSlot'), p = cur.pages[cur.page];
  slot.innerHTML = '';
  if (!p) {
    slot.innerHTML = '<div class="reward-page"><div class="reward-kicker">No pages yet</div>' +
      '<div class="reward-title">Record sealed</div>' +
      '<p class="reward-desc">This issue has not been recovered. Check back when the next drop lands.</p></div>';
  } else if (p.type === 'reward') {
    slot.appendChild(rewardPage(p.reward));
  } else if (typeof p === 'string') {
    /* A string page is meant to be an IMAGE reference. If it is plain prose
       (easy to do — it goes in a textarea) we used to hand it to <img> and the
       reader showed a broken-image icon with no clue why. Show the words and
       say what happened instead. */
    if (!isPageImageRef(p)) {
      slot.innerHTML = '<div class="reward-page">' +
        '<div class="reward-kicker">Page ' + (cur.page + 1) + '</div>' +
        '<p class="reward-desc">' + escapeHtml(p) + '</p>' +
        '<p class="reward-desc" style="opacity:.6;font-size:.85em">This page has no artwork yet — in the editor use <b>⬆ Upload comic pages</b> to attach the art.</p></div>';
    } else {
      const img = document.createElement('img');
      img.id = 'page'; img.alt = cur.issue.title + ' — page ' + (cur.page + 1);
      img.onerror = () => {
        slot.innerHTML = '<div class="reward-page">' +
          '<div class="reward-kicker">Page ' + (cur.page + 1) + '</div>' +
          '<div class="reward-title">This page did not load</div>' +
          '<p class="reward-desc" style="word-break:break-all;opacity:.7">' + escapeHtml(p) + '</p></div>';
      };
      img.src = p;
      slot.appendChild(img);
      /* preload the next page so turns are instant */
      const nx = cur.pages[cur.page + 1];
      if (typeof nx === 'string' && isPageImageRef(nx)) { const pre = new Image(); pre.src = nx; }
    }
  } else {
    slot.innerHTML = placeholderPage(p, cur.issue, cur.page);
  }
  /* pips */
  $('#pips').innerHTML = cur.pages.map((pg, i) =>
    '<button class="pip' + (pg && pg.type === 'reward' ? ' reward' : '') + '" data-i="' + i + '" aria-current="' +
    (i === cur.page ? 'true' : 'false') + '" aria-label="Page ' + (i + 1) + '"></button>').join('');
  $('#pageCount').textContent = cur.pages.length ? (cur.page + 1) + ' / ' + cur.pages.length : '—';
  $('#prevZone').disabled = cur.page === 0;
  $('#nextZone').disabled = cur.page >= cur.pages.length - 1;
  if (cur.page >= cur.pages.length - 1 && cur.pages.length) {
    Store.markRead(cur.loc.id + ':' + cur.issue.no);
    refreshAllMarkers();
    buildRail();
  }
}
function rewardPage(rw) {
  const wrap = document.createElement('div');
  wrap.className = 'reward-page';
  wrap.innerHTML =
    '<svg class="reward-seal" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="44" fill="none" stroke="#C4923A" stroke-width="1.2"/>' +
    '<circle cx="50" cy="50" r="36" fill="none" stroke="#C4923A" stroke-width=".5" stroke-opacity=".5"/>' +
    '<path d="M50 22 L64 50 L50 78 L36 50 Z" fill="none" stroke="#FFC15E" stroke-width="1.6"/>' +
    '<circle cx="50" cy="50" r="7" fill="#FFC15E"/></svg>' +
    '<div class="reward-kicker">Issue reward unlocked</div>' +
    '<h3 class="reward-title">' + escapeHtml(rw.title) + '</h3>' +
    '<p class="reward-desc">' + escapeHtml(rw.desc) + '</p>' +
    '<div class="code-field"><div class="code-val">' + escapeHtml(rw.code) + '</div>' +
    '<button class="code-copy">Copy</button></div>' +
    '<a class="redeem-btn" target="_blank" rel="noopener" href="' +
    CONFIG.redeemUrl + '?code=' + encodeURIComponent(rw.code) + '">Redeem in Mythic Spellbook</a>' +
    '<div class="reward-fine">' + escapeHtml(rw.note || '') + '</div>';
  const claim = () => { Store.markClaimed(rw.code); };
  wrap.querySelector('.code-copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(rw.code); } catch (err) {}
    e.target.textContent = 'Copied';
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
    toast('Code copied — ' + rw.code);
    claim();
  });
  wrap.querySelector('.redeem-btn').addEventListener('click', claim);
  return wrap;
}
function turn(d) {
  const n = cur.page + d;
  if (n < 0 || n >= cur.pages.length) return;
  cur.page = n; renderPage();
  $('#pageWrap').scrollTop = 0;
}
function closeReader() {
  reader.classList.remove('on');
  document.body.style.overflow = '';
}
$('#prevZone').addEventListener('click', () => turn(-1));
$('#nextZone').addEventListener('click', () => turn(1));
$('#closeBtn').addEventListener('click', closeReader);
$('#pips').addEventListener('click', e => {
  const b = e.target.closest('.pip'); if (!b) return;
  cur.page = +b.dataset.i; renderPage();
});
$('#fitBtn').addEventListener('click', e => {
  const on = $('#pageWrap').classList.toggle('fitw');
  e.target.setAttribute('aria-pressed', String(on));
  e.target.textContent = on ? 'Fit page' : 'Fit width';
});
addEventListener('keydown', e => {
  if (reader.classList.contains('on')) {
    if (e.key === 'Escape') closeReader();
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft') turn(-1);
    return;
  }
  if (e.key === 'Escape') closeBrief();
});
/* swipe */
let sx0 = 0, sy0 = 0;
$('#pageWrap').addEventListener('touchstart', e => { sx0 = e.touches[0].clientX; sy0 = e.touches[0].clientY; }, { passive: true });
$('#pageWrap').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - sx0, dy = e.changedTouches[0].clientY - sy0;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
}, { passive: true });
