# Ashfall Story Map — working notes

An interactive lore map for the Ashfall / Cinder Doctrine setting. Hover a pin for a
story brief, click it to read a comic issue, finish an issue to unlock a reward code
that redeems in Mythic Spellbook.

## Run it

Open `index.html`. That's it — no build step, no bundler, no server. Plain classic
`<script>` tags, works straight off the filesystem.

Admin editor: open it with `#admin` on the URL, e.g. `index.html#admin`.

## Layout

```
index.html          markup only — DOM ids the JS binds to
css/styles.css      all styling; design tokens are the :root vars at the top
data/content.js     ← ALL CONTENT. Pins, stories, issues, rewards, theme, camera.
js/worldgen.js      the map illustration program (see rules below)
js/core.js          $, escapeHtml, toast, progress Store, DOM handles
js/map.js           theme, terrain tiles, pan/zoom, pins, hover brief
js/reader.js        comic reader, placeholder pages, reward seals
js/admin.js         Cartographer — the in-browser editor
comics/             comic page images, one folder per issue
tools/              node scripts for verification and poster export
```

**Everything a non-engineer would want to change lives in `data/content.js`.** Keep it
that way — content does not belong in `js/`.

## Conventions that matter

**No modules.** These are classic scripts sharing one global scope. A top-level `const`
in one file is visible to every later file. Two consequences:

1. Script order in `index.html` is load-bearing. Content and worldgen first, then core,
   then map, reader, admin.
2. Never declare the same top-level name in two files — it throws at load. If you add a
   helper, check it isn't already declared elsewhere.

If a function in an earlier file needs one from a later file, call it lazily (inside an
event handler) or guard it — `map.js` does this with
`if (typeof adminSync === "function")`.

## Common tasks

### Add a comic issue

1. Drop the page images in `comics/<slug>/01.jpg`, `02.jpg`, …
2. Add an issue object to the right location's `issues` array in `data/content.js`:

```js
{
  no: 'III',
  title: 'The Ledger Burns',
  blurb: 'One line, shown on the issue chip.',
  pages: pagesFrom('comics/ashfall-03', 6),   // or an explicit array of paths
  reward: {                                    // omit for an issue with no reward
    code: 'ASHFALL-LEDGERBURNS',
    title: 'Ledger Ash Sleeve',
    desc: '400 ₵ Cinder and the Ledger Ash card sleeve.',
    note: 'One redemption per account.'
  }
}
```

`pages` accepts image paths **or** placeholder specs (`{ layout, cap, sfx }`) so an issue
can be laid out and read before the art exists. Layouts: `splash`, `hero`, `grid`, `strip`.

When a reader reaches the last page the issue is marked read and, if it has a reward, a
seal page appears with the code and a link to `CONFIG.redeemUrl?code=…`. Wire that
endpoint to read the query param.

### Add or move a pin

Easiest path: open `index.html#admin`, hit **Add pin**, click the map, fill in the panel,
then **Export to file** and paste the result over the matching blocks in
`data/content.js`. The export lists any image files you need to add.

By hand, add to `LOCATIONS`:

```js
{
  id: 'newsite', name: 'Site Name', region: 'Sector label',
  x: -1554, y: -1415,          // world pixels — press ` on the map for a live readout
  state: 'open',               // or 'sealed' for a published-but-locked site
  glyph: 'tower',              // key from GLYPHS, or set `icon:` to an image path
  brief: 'Hover text. <em>Inline HTML is fine.</em>',
  meta: { era: 'Year 14', pov: 'Who recorded it' },
  issues: [ /* … */ ]
}
```

Coordinates are unbounded in both directions — the world is infinite, so negative values
are normal. There is no map edge to stay inside.

### Change the look

`THEME` in `data/content.js` drives every accent colour; `applyTheme()` pushes it into CSS
variables at boot. Structural styling is in `css/styles.css` under the `:root` tokens.
Admin mode has live colour pickers for the theme.

### Change the world

`CONFIG.seed` regenerates the entire infinite world. `CONFIG.res` is canvas pixels per
tile — raise for sharpness, lower for speed. Pin coordinates are tied to the terrain of
whatever seed you keep, so re-check pin placement after changing it.

## Rules for `js/worldgen.js`

This file draws the map. Its one hard constraint:

> **Every mark must be a pure function of world coordinates.**

Tiles are drawn independently and must line up exactly with neighbours that may be drawn
seconds later or never. That means:

- Use `hsh(a, b, salt)` for all randomness, keyed on the coordinates of the thing being
  drawn (cell index, district index, grid cell). **Never** use a sequential `Math.random()`
  or a running PRNG — the same object would come out differently depending on which tile
  is drawing it, and the seams would show.
- Anchor gradients to world space, not the tile. The water gradient does this with a
  modulo of `ox + oy` against a fixed period; copy that pattern.
- Objects near a tile edge must be drawn by **both** adjacent tiles. Iterate over the
  covering range plus a margin (`cellsFor(..., pad)`), and let the canvas clip.
- Anything anchored to a cell (city street grids, block rotation) anchors to the cell's
  centroid, never to the tile origin.

After any change here, run the verifier.

## Verifying

```
npm install          # only needs `canvas`, only for the node tools
npm run verify
```

`tools/verify.js` renders nine tiles completely independently, stitches them, and reports:

- **Seam metric** — mean pixel step across the tile boundaries versus across ordinary
  interior columns. Seams should measure at or below the interior value. If the seam
  number climbs above interior, something in worldgen stopped being coordinate-pure.
- **Colour statistics** — mean luminance, saturation, and the share of gold / violet /
  teal / green / neutral pixels, against the reference targets the art direction was
  tuned to. Large drift here means the map has wandered off style.

Reference targets: `L 41.1, sat 0.313, gold 13.1%, violet 5.6%, teal 9.9%, green 2.1%,
neutral 44.6%`. Small variation between runs is expected — a single sample of an infinite
world genuinely differs region to region.

```
npm run poster -- --x 0 --y 0 --span 4096 --out poster.png
```

Renders any region at high resolution, using the same generator, for marketing art or
loading screens.

## Things to know

- Read progress and claimed reward codes are per-browser via `localStorage`. If you want
  one-redemption-per-account rather than per-device, that needs a backend — Supabase is
  already in use elsewhere in this stack.
- Admin edits autosave to `localStorage` as a draft and only reach the repo when you
  export and paste. The draft loads only in `#admin`, never for visitors.
- Tiles render one per animation frame and the queue pauses while dragging, so panning
  stays smooth and tiles fill in when you stop. Roughly 120ms per tile.
- Off-screen tiles are evicted above ~80 cached, so memory stays flat however far you pan.
