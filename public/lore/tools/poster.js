/* High-resolution render of any region, using the same generator as the site.
   npm run poster -- --x 0 --y 0 --span 4096 --res 4096 --out poster.png     */
const { createCanvas } = require('canvas');
const fs = require('fs'), path = require('path');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const X = +(args.x || 0), Y = +(args.y || 0);
const SPAN = +(args.span || 4096), RES = +(args.res || SPAN);
const OUT = args.out || 'poster.png';

const root = path.join(__dirname, '..');
global.window = undefined;
new Function(fs.readFileSync(path.join(root, 'js/worldgen.js'), 'utf8'))();
const content = fs.readFileSync(path.join(root, 'data/content.js'), 'utf8');
global.Worldgen.setSeed(+(content.match(/seed:\s*(-?\d+)/) || [, 91177])[1]);

/* drawn as a grid of tiles so memory stays sane at large sizes */
const TILE = 1024, TRES = Math.round(RES / SPAN * TILE);
const cv = createCanvas(RES, RES), ctx = cv.getContext('2d');
const cols = Math.ceil(SPAN / TILE);
for (let r = 0; r < cols; r++) for (let c = 0; c < cols; c++) {
  const t = createCanvas(TRES, TRES);
  global.Worldgen.drawTile(t.getContext('2d'), X + c * TILE, Y + r * TILE, TILE, TRES,
    (w, h) => createCanvas(w, h));
  ctx.drawImage(t, c * TRES, r * TRES);
  process.stdout.write('\rtile ' + (r * cols + c + 1) + '/' + cols * cols);
}
/* a vignette, the way the printed version had one */
const v = ctx.createRadialGradient(RES / 2, RES / 2, RES * .28, RES / 2, RES / 2, RES * .78);
v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,6,8,.62)');
ctx.fillStyle = v; ctx.fillRect(0, 0, RES, RES);
fs.writeFileSync(path.join(root, OUT), cv.toBuffer('image/png'));
console.log('\nwrote ' + OUT + '  (' + RES + 'px, world ' + X + ',' + Y + ' span ' + SPAN + ')');
