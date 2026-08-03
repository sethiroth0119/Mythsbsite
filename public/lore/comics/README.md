# Comic pages

One folder per issue. Name the folder after the issue, number the pages from `01`.

```
comics/
  ashfall-01/        01.jpg  02.jpg  03.jpg  …
  blackriver-01/     01.jpg  02.jpg  …
```

Point an issue at a folder in `data/content.js`:

```js
pages: pagesFrom('comics/ashfall-01', 5)          // 01.jpg … 05.jpg
pages: pagesFrom('comics/ashfall-01', 5, 'webp')  // 01.webp … 05.webp
```

Or list paths explicitly if the numbering isn't sequential:

```js
pages: ['comics/ashfall-01/cover.jpg', 'comics/ashfall-01/01.jpg']
```

## Format

Any web image format. Portrait pages around **1000 × 1540** match the reader's layout
best, but the reader fits whatever you give it and has a fit-width toggle for tall pages.
The next page preloads while you read, so keep individual files reasonable — under about
400KB each keeps page turns instant.

## Before the art exists

An issue can ship with placeholder pages instead of images, so the writing and sequencing
can be finished first:

```js
pages: [
  { layout: 'splash', sfx: 'ASHFALL', cap: ['Day one. The sky went the colour of a closed eye.'] },
  { layout: 'grid',   cap: ['Caption for panel one.', 'Caption for panel two.'] }
]
```

Layouts: `splash` (one full page), `hero` (large panel over a wide one), `grid` (2×2),
`strip` (three stacked). `cap` holds one caption per panel; `sfx` is the big lettering.
