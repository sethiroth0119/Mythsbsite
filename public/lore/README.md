# Ashfall Story Map

An interactive lore map for **Ashfall: Cinder Doctrine**. Hover a site for a story brief,
click it to read a comic issue, finish an issue to unlock a reward code redeemable in
Mythic Spellbook.

The world is generated, not painted — it extends infinitely in every direction and never
repeats a frame.

## Running it

Open `index.html` in a browser. No build step, no server, no dependencies.

## Editing it

Two ways, and they meet in the same place.

**In the browser.** Open `index.html#admin`. The Cartographer panel lets you drop pins,
place and resize images, pick glyphs, write briefs, add issues and rewards, and recolour
the theme live. Edits autosave to your browser. When you're happy, hit **Export to file**
and paste the result into `data/content.js`.

**In the code.** Everything content-related lives in `data/content.js` — pins, briefs,
issues, comic page paths, reward codes, colours, opening camera. See `CLAUDE.md` for the
shape of each object and the common recipes.

## Adding comic pages

Drop images in `comics/<issue-slug>/01.jpg`, `02.jpg`, … then point an issue at them:

```js
pages: pagesFrom('comics/ashfall-03', 6)
```

Issues without art still work — the reader falls back to laid-out placeholder pages so
you can write and sequence an issue before it's drawn.

## Tools

```
npm install
npm run verify                                        # seam + art-direction check
npm run poster -- --x 0 --y 0 --span 4096 --out p.png # high-res render of any region
```

## Files

| path | what |
|---|---|
| `data/content.js` | all content — pins, stories, issues, rewards, theme |
| `js/worldgen.js` | the map illustration program |
| `js/map.js` | terrain tiles, pan/zoom, pins, hover brief |
| `js/reader.js` | comic reader and reward seals |
| `js/admin.js` | the Cartographer editor |
| `css/styles.css` | styling; design tokens at the top |
| `CLAUDE.md` | working notes, conventions, recipes |
