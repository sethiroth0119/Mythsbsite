/* Renders nine tiles independently, stitches them, and checks that the
   seams are invisible and the art direction hasn't drifted.
   Run with:  npm run verify                                            */
const { createCanvas } = require('canvas');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
global.window = undefined;
new Function(fs.readFileSync(path.join(root, 'js/worldgen.js'), 'utf8'))();
const W = global.Worldgen;

/* pick up the seed the site actually uses */
const content = fs.readFileSync(path.join(root, 'data/content.js'), 'utf8');
const seed = (content.match(/seed:\s*(-?\d+)/) || [, 91177])[1];
W.setSeed(+seed);

const SPAN = 1024, RES = 512, N = 3;
const mk = (w, h) => createCanvas(w, h);
const out = createCanvas(RES * N, RES * N), oc = out.getContext('2d');

const t0 = Date.now();
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const t = createCanvas(RES, RES);
  W.drawTile(t.getContext('2d'), c * SPAN, r * SPAN, SPAN, RES, mk);
  oc.drawImage(t, c * RES, r * RES);
}
const ms = Date.now() - t0;
console.log('seed ' + seed + ' — 9 tiles in ' + ms + 'ms (' + (ms / 9).toFixed(0) + 'ms/tile)');

const WD = RES * N, d = oc.getImageData(0, 0, WD, WD).data;
const colStep = x => {
  let s = 0;
  for (let y = 0; y < WD; y++) {
    const a = (y * WD + x - 1) * 4, b = (y * WD + x) * 4;
    s += Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
  }
  return s / WD;
};
let interior = 0, n = 0;
for (let x = 40; x < WD - 40; x += 17) {
  if (Math.abs(x - RES) < 6 || Math.abs(x - RES * 2) < 6) continue;
  interior += colStep(x); n++;
}
interior /= n;
const seams = [colStep(RES), colStep(RES * 2)];
const seamOk = Math.max(...seams) <= interior * 1.25;
console.log('seams ' + seams.map(v => v.toFixed(2)).join(' / ') +
  '   interior ' + interior.toFixed(2) + '   ' + (seamOk ? 'PASS' : 'FAIL — tiles no longer line up'));

const s512 = createCanvas(512, 512), sc = s512.getContext('2d');
sc.drawImage(out, 0, 0, 512, 512);
const p = sc.getImageData(0, 0, 512, 512).data;
let sum = 0, m = 0, gold = 0, vio = 0, teal = 0, green = 0, neu = 0, sat = 0;
for (let i = 0; i < p.length; i += 4) {
  const r = p[i], g = p[i + 1], b = p[i + 2], l = r * .3 + g * .5 + b * .2;
  sum += l; m++;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sv = mx ? (mx - mn) / mx : 0;
  sat += sv;
  if (sv < 0.22) { neu++; continue; }
  if (r > g && g >= b && l > 45) gold++;
  else if (b > r && r > g && b - g > 22) vio++;
  else if (b >= g && g > r && b - r > 18) teal++;
  else if (g > r && g >= b) green++;
}
const f = v => (v / m * 100).toFixed(1);
console.log('colour  L ' + (sum / m).toFixed(1) + '  sat ' + (sat / m).toFixed(3) +
  '  | gold ' + f(gold) + '  violet ' + f(vio) + '  teal ' + f(teal) +
  '  green ' + f(green) + '  neutral ' + f(neu));
console.log('target  L 41.1  sat 0.313  | gold 13.1  violet 5.6  teal 9.9  green 2.1  neutral 44.6');

fs.writeFileSync(path.join(root, 'tools/verify-output.png'), out.toBuffer('image/png'));
console.log('wrote tools/verify-output.png');
process.exit(seamOk ? 0 : 1);
