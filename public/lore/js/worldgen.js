/* ═══════════════════════════════════════════════════════════════
   ASHFALL WORLDGEN — the same drawing program as the printed map,
   but every mark is a pure function of world coordinates. Any tile
   can be drawn on its own and still line up exactly with the tiles
   beside it, so the world has no edge and never repeats.
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var SEED = 91177;

  /* ── deterministic hashing ──────────────────────────────── */
  function hsh(a, b, c) {
    var n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((c | 0) + SEED, 362437);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  /* a small local stream, seeded from coordinates — lets objects be
     drawn with sequential randomness while staying reproducible */
  function stream(a, b, c) {
    var s = (hsh(a, b, c) * 4294967295) >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hsh(xi, yi, s), b = hsh(xi + 1, yi, s), c = hsh(xi, yi + 1, s), d = hsh(xi + 1, yi + 1, s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, y, oct, s) {
    var sum = 0, amp = .5, f = 1, n = 0;
    for (var i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); n += amp; amp *= .5; f *= 2; }
    return sum / n;
  }

  /* ── palette (matched to the reference) ─────────────────── */
  var C = {
    forestDark: '#171A15', forestMid: '#23271E', forestLit: '#2E3620', forestHi: '#3A4523',
    urban: 'rgba(36,40,46,.80)', vioGround: 'rgba(74,30,120,.20)',
    vioDark: '#231A31', vioLit: 'rgba(126,64,182,.30)',
    waterDeep: '#16282B', waterMid: '#20373A', waterRim: 'rgba(66,120,122,.48)',
    bSide: '#0E1216', bTop: '#232A32', bTopLit: '#2E3742', win: '#F7C86E'
  };

  /* ── rivers: parallel families in fixed directions, each lane
        meandering, so any lane can be generated for any range ── */
  var FAM = [
    { ang: 0.62, spacing: 3000, wlo: 46, whi: 110, salt: 11 },
    { ang: -0.42, spacing: 3900, wlo: 32, whi: 72, salt: 23 },
    { ang: 1.15, spacing: 2500, wlo: 16, whi: 34, salt: 37 }
  ];
  function lanePoint(f, k, t) {
    var ca = Math.cos(f.ang), sa = Math.sin(f.ang);
    var nx = -sa, ny = ca;
    var m = (fbm(t * 0.00034, k * 3.7, 3, f.salt) - 0.5) * 1400
          + (fbm(t * 0.0016, k * 1.3 + 9, 2, f.salt + 5) - 0.5) * 260;
    var d = k * f.spacing + m;
    var w = f.wlo + (f.whi - f.wlo) * fbm(t * 0.0007, k * 2.1, 2, f.salt + 9);
    return [ca * t + nx * d, sa * t + ny * d, w];
  }
  /* lanes whose corridor can reach the given rect */
  function lanesFor(f, x0, y0, x1, y1) {
    var ca = Math.cos(f.ang), sa = Math.sin(f.ang), nx = -sa, ny = ca;
    var lo = 1e9, hi = -1e9, tlo = 1e9, thi = -1e9;
    var pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    for (var i = 0; i < 4; i++) {
      var d = pts[i][0] * nx + pts[i][1] * ny;
      var t = pts[i][0] * ca + pts[i][1] * sa;
      lo = Math.min(lo, d); hi = Math.max(hi, d);
      tlo = Math.min(tlo, t); thi = Math.max(thi, t);
    }
    var pad = 1900;
    var out = [];
    for (var k = Math.floor((lo - pad) / f.spacing); k <= Math.ceil((hi + pad) / f.spacing); k++)
      out.push({ k: k, t0: tlo - 900, t1: thi + 900 });
    return out;
  }
  function lanePolyline(f, k, t0, t1) {
    var step = 150, pts = [];
    for (var t = Math.floor(t0 / step) * step; t <= t1 + step; t += step) pts.push(lanePoint(f, k, t));
    return pts;
  }
  function ribbon(ctx, pts, ox, oy, sc, wscale) {
    wscale = wscale || 1;
    var L = [], R = [], i;
    for (i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var nx = -(b[1] - a[1]), ny = (b[0] - a[0]);
      var m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      var w = pts[i][2] * wscale / 2;
      L.push([(pts[i][0] + nx * w - ox) * sc, (pts[i][1] + ny * w - oy) * sc]);
      R.push([(pts[i][0] - nx * w - ox) * sc, (pts[i][1] - ny * w - oy) * sc]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (i = 0; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  function eachRiver(x0, y0, x1, y1, fn) {
    for (var fi = 0; fi < FAM.length; fi++) {
      var f = FAM[fi], ls = lanesFor(f, x0, y0, x1, y1);
      for (var i = 0; i < ls.length; i++) fn(f, lanePolyline(f, ls[i].k, ls[i].t0, ls[i].t1));
    }
  }
  /* perpendicular distance from a point to the nearest river centre */
  function waterDist(x, y) {
    var best = 1e9;
    for (var fi = 0; fi < FAM.length; fi++) {
      var f = FAM[fi], ca = Math.cos(f.ang), sa = Math.sin(f.ang), nx = -sa, ny = ca;
      var t = x * ca + y * sa, d = x * nx + y * ny;
      var k0 = Math.floor((d - 1900) / f.spacing), k1 = Math.ceil((d + 1900) / f.spacing);
      for (var k = k0; k <= k1; k++) {
        var p = lanePoint(f, k, t);
        var dd = Math.abs((p[0] - x) * nx + (p[1] - y) * ny) - p[2] / 2;
        if (dd < best) best = dd;
      }
    }
    return best;
  }

  /* ── territory cells ────────────────────────────────────── */
  var SP = 620;
  function siteAt(cx, cy) {
    return [(cx + 0.24 + hsh(cx, cy, 5) * 0.52) * SP, (cy + 0.24 + hsh(cx, cy, 6) * 0.52) * SP];
  }
  function nearestSite(x, y) {
    var cx = Math.floor(x / SP), cy = Math.floor(y / SP), best = 1e18, bx = 0, by = 0, f2 = 1e18;
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
      var s = siteAt(cx + i, cy + j);
      var d = (s[0] - x) * (s[0] - x) + (s[1] - y) * (s[1] - y);
      if (d < best) { f2 = best; best = d; bx = cx + i; by = cy + j; }
      else if (d < f2) f2 = d;
    }
    return { cx: bx, cy: by, edge: Math.sqrt(f2) - Math.sqrt(best) };
  }
  function clipHalf(p, mx, my, nx, ny) {
    var out = [];
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length];
      var da = (a[0] - mx) * nx + (a[1] - my) * ny;
      var db = (b[0] - mx) * nx + (b[1] - my) * ny;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) {
        var t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  var cellCache = {};
  function cell(cx, cy) {
    var key = cx + ',' + cy;
    if (cellCache[key]) return cellCache[key];
    var s = siteAt(cx, cy);
    var p = [[s[0] - SP * 2, s[1] - SP * 2], [s[0] + SP * 2, s[1] - SP * 2],
             [s[0] + SP * 2, s[1] + SP * 2], [s[0] - SP * 2, s[1] + SP * 2]];
    for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) {
      if (!i && !j) continue;
      var o = siteAt(cx + i, cy + j);
      p = clipHalf(p, (s[0] + o[0]) / 2, (s[1] + o[1]) / 2, o[0] - s[0], o[1] - s[1]);
      if (p.length < 3) break;
    }
    /* organic border jitter, driven by position so both neighbours agree */
    var dense = [];
    for (var q = 0; q < p.length; q++) {
      var a = p[q], b = p[(q + 1) % p.length];
      var seg = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 50));
      for (var t2 = 0; t2 < seg; t2++) {
        var u = t2 / seg;
        var px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u;
        var n = (fbm(px * 0.0026, py * 0.0026, 2, 71) - 0.5) * 2;
        dense.push([px + n * 13, py + n * 11]);
      }
    }
    var dw = waterDist(s[0], s[1]);
    var roll = hsh(cx, cy, 41);
    var kind = 'wild';
    if (hsh(cx, cy, 88) > 0.972) kind = 'corrupt';
    else if (dw < SP * 0.9 && roll < 0.75) kind = 'urban';
    else if (roll > 0.55) kind = 'urban';
    var rec = {
      site: s, poly: dense, kind: kind,
      node: hsh(cx, cy, 55) < 0.66 && waterDist(s[0], s[1]) > 40,
      cx: cx, cy: cy
    };
    var mx = 0, my = 0;
    for (var z = 0; z < dense.length; z++) { mx += dense[z][0]; my += dense[z][1]; }
    rec.mid = [mx / dense.length, my / dense.length];
    rec.inner = dense.map(function (q) {
      return [rec.mid[0] + (q[0] - rec.mid[0]) * 0.82, rec.mid[1] + (q[1] - rec.mid[1]) * 0.82];
    });
    cellCache[key] = rec;
    if (Object.keys(cellCache).length > 900) cellCache = {};
    return rec;
  }
  function cellsFor(x0, y0, x1, y1, pad) {
    pad = pad || 1;
    var out = [];
    for (var cy = Math.floor(y0 / SP) - pad; cy <= Math.floor(y1 / SP) + pad; cy++)
      for (var cx = Math.floor(x0 / SP) - pad; cx <= Math.floor(x1 / SP) + pad; cx++)
        out.push(cell(cx, cy));
    return out;
  }

  function pathPoly(ctx, p, ox, oy, sc) {
    ctx.beginPath();
    ctx.moveTo((p[0][0] - ox) * sc, (p[0][1] - oy) * sc);
    for (var i = 1; i < p.length; i++) ctx.lineTo((p[i][0] - ox) * sc, (p[i][1] - oy) * sc);
    ctx.closePath();
  }

  var ICONS = [
    'M5 5 L19 19 M19 5 L5 19',
    'M9 21 L9 8 L12 3 L15 8 L15 21 M6.5 21 L17.5 21 M10.5 13 L13.5 13',
    'M6 20 L6 6 L15 6 L15 20 M4.5 20 L16.5 20 M9 10 L13 10',
    'M4.5 7.5 L19.5 7.5 L19.5 19.5 L4.5 19.5 Z M4.5 7.5 L6.5 4 L17.5 4 L19.5 7.5 M12 7.5 L12 19.5',
    'M12 3 L14.2 9.5 L21 9.5 L15.4 13.6 L17.6 20 L12 16 L6.4 20 L8.6 13.6 L3 9.5 L9.8 9.5 Z',
    'M5 9 L12 5 L19 9 M5 14 L12 10 L19 14 M5 19 L12 15 L19 19'
  ];
  function strokeIcon(ctx, d) {
    ctx.beginPath();
    var toks = d.replace(/([MLZ])/g, ' $1 ').trim().split(/[\s,]+/), mode = 'M';
    for (var i = 0; i < toks.length;) {
      var t = toks[i];
      if (t === 'M' || t === 'L') { mode = t; i++; continue; }
      if (t === 'Z') { ctx.closePath(); i++; continue; }
      var x = +toks[i], y = +toks[i + 1]; i += 2;
      if (mode === 'M') { ctx.moveTo(x, y); mode = 'L'; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /* ═══════════ the tile drawing program ═══════════════════ */
  /* ctx must be a canvas of RES x RES; it will be filled with the
     world rect [ox, oy] .. [ox + SPAN, oy + SPAN]  */
  function drawTile(ctx, ox, oy, SPAN, RES, makeCanvas) {
    var sc = RES / SPAN;
    var x0 = ox, y0 = oy, x1 = ox + SPAN, y1 = oy + SPAN;
    var cells = cellsFor(x0, y0, x1, y1, 1);
    var i, j, k;

    /* 1 ─ ground */
    var GR = 160, gc = makeCanvas(GR, GR), gx2 = gc.getContext('2d');
    var img = gx2.createImageData(GR, GR), d = img.data;
    var nz = function (x, y, f) { return Math.sin(x * f) * Math.cos(y * f * 1.13) + Math.sin((x + y) * f * 0.61); };
    for (var py = 0; py < GR; py++) {
      var wy = oy + py * SPAN / GR;
      for (var px = 0; px < GR; px++) {
        var wx = ox + px * SPAN / GR;
        var n = (nz(wx, wy, 0.0029) + nz(wx, wy, 0.0105) * 0.5 + nz(wx, wy, 0.041) * 0.22) / 1.72;
        var p = (py * GR + px) * 4;
        d[p] = 17 + n * 7; d[p + 1] = 18 + n * 8; d[p + 2] = 17 + n * 7; d[p + 3] = 255;
      }
    }
    gx2.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(gc, 0, 0, RES, RES);

    /* 2 ─ urban and corrupted ground */
    for (i = 0; i < cells.length; i++) {
      if (cells[i].kind === 'urban') { ctx.fillStyle = C.urban; pathPoly(ctx, cells[i].inner, ox, oy, sc); ctx.fill(); }
    }
    for (i = 0; i < cells.length; i++) {
      if (cells[i].kind === 'corrupt') { ctx.fillStyle = C.vioGround; pathPoly(ctx, cells[i].poly, ox, oy, sc); ctx.fill(); }
    }

    /* 3 ─ water */
    var rivers = [];
    eachRiver(x0, y0, x1, y1, function (f, pts) { rivers.push(pts); });
    for (i = 0; i < rivers.length; i++) {
      ribbon(ctx, rivers[i], ox, oy, sc);
      /* gradient anchored to world space so it never breaks at a tile edge */
      var period = 4200;
      var off = (((ox + oy) % period) + period) % period;
      var gr = ctx.createLinearGradient(-off * sc, -off * sc, (period - off) * sc, (period - off) * sc);
      gr.addColorStop(0, C.waterMid); gr.addColorStop(.5, C.waterDeep); gr.addColorStop(1, C.waterMid);
      ctx.fillStyle = gr; ctx.fill();
    }
    for (i = 0; i < rivers.length; i++) {
      ribbon(ctx, rivers[i], ox, oy, sc);
      ctx.strokeStyle = C.waterRim; ctx.lineWidth = 6 * sc; ctx.stroke();
      ctx.strokeStyle = 'rgba(66,120,122,.12)'; ctx.lineWidth = 24 * sc; ctx.stroke();
    }

    /* water mask, used to keep canopy, roads and buildings off the river */
    var MW = 128, mc = makeCanvas(MW, MW), mx = mc.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, MW, MW);
    mx.fillStyle = '#fff';
    for (i = 0; i < rivers.length; i++) { ribbon(mx, rivers[i], ox, oy, MW / SPAN); mx.fill(); }
    var md = mx.getImageData(0, 0, MW, MW).data;
    var wet = function (wx, wy) {
      var ix = ((wx - ox) * MW / SPAN) | 0, iy = ((wy - oy) * MW / SPAN) | 0;
      if (ix < 0 || iy < 0 || ix >= MW || iy >= MW) return waterDist(wx, wy) < 0;
      return md[(iy * MW + ix) * 4] > 90;
    };

    /* 4 ─ canopy */
    (function () {
      var step = 13, dark = [], lit = [], hi = [], vd = [], vl = [];
      var gx0 = Math.floor(x0 / step) - 1, gx1 = Math.ceil(x1 / step) + 1;
      var gy0 = Math.floor(y0 / step) - 1, gy1 = Math.ceil(y1 / step) + 1;
      for (var gy = gy0; gy <= gy1; gy++) for (var gx = gx0; gx <= gx1; gx++) {
        var jx = (hsh(gx, gy, 101) - .5) * step * 1.1, jy = (hsh(gx, gy, 102) - .5) * step * 1.1;
        var wx = gx * step + jx, wy = gy * step + jy;
        if (wet(wx, wy)) continue;
        var ns = nearestSite(wx, wy), cc = cell(ns.cx, ns.cy);
        var r5 = hsh(gx, gy, 103);
        if (cc.kind === 'urban' && ns.edge > 118 && r5 < .94) continue;
        if (ns.edge < 44 && r5 < .82) continue;
        var rad = 3.6 + hsh(gx, gy, 104) * 4.0;
        var vio = cc.kind === 'corrupt';
        var X = (wx - ox) * sc, Y = (wy - oy) * sc, RD = rad * sc;
        (vio ? vd : dark).push([X, Y, RD]);
        (vio ? vl : lit).push([X - RD * .3, Y - RD * .34, RD * .58]);
        if (!vio && hsh(gx, gy, 105) < .11) hi.push([X - RD * .38, Y - RD * .42, RD * .38]);
      }
      var blobs = function (arr, fill) {
        if (!arr.length) return;
        ctx.fillStyle = fill; ctx.beginPath();
        for (var q = 0; q < arr.length; q++) { ctx.moveTo(arr[q][0] + arr[q][2], arr[q][1]); ctx.arc(arr[q][0], arr[q][1], arr[q][2], 0, 6.283); }
        ctx.fill();
      };
      blobs(dark, C.forestDark); blobs(lit, C.forestMid);
      blobs(hi, C.forestLit); blobs(vd, C.vioDark); blobs(vl, C.vioLit);
    })();

    /* 5 ─ ruined city blocks */
    for (i = 0; i < cells.length; i++) {
      var cc2 = cells[i];
      if (cc2.kind !== 'urban') continue;
      var mid = cc2.mid, R = stream(cc2.cx, cc2.cy, 201);
      var rad2 = 0;
      for (j = 0; j < cc2.inner.length; j++) rad2 = Math.max(rad2, Math.hypot(cc2.inner[j][0] - mid[0], cc2.inner[j][1] - mid[1]));
      var ang = (hsh(cc2.cx, cc2.cy, 202) - .5) * 1.0;
      ctx.save();
      pathPoly(ctx, cc2.inner, ox, oy, sc); ctx.clip();
      ctx.translate((mid[0] - ox) * sc, (mid[1] - oy) * sc);
      ctx.rotate(ang);
      ctx.scale(sc, sc);
      var BLK = 126, ST = 30, reach = rad2 * 1.15;
      var bi = 0;
      for (var by = -reach; by < reach; by += BLK + ST) {
        for (var bx = -reach; bx < reach; bx += BLK + ST) {
          bi++;
          var bh = hsh(cc2.cx * 71 + ((bx / 100) | 0), cc2.cy * 53 + ((by / 100) | 0), 203);
          var wxw = mid[0] + Math.cos(ang) * bx - Math.sin(ang) * by;
          var wyw = mid[1] + Math.sin(ang) * bx + Math.cos(ang) * by;
          if (wet(wxw, wyw)) continue;
          var dc = Math.hypot(bx, by) / rad2;
          if (bh < dc * 0.55) continue;
          var cols = 2 + ((hsh(bi, cc2.cx + cc2.cy, 204) * 2) | 0);
          var rows = 2 + ((hsh(bi, cc2.cx - cc2.cy, 205) * 2) | 0);
          var uw = BLK / cols, uh = BLK / rows;
          for (var rj = 0; rj < rows; rj++) for (var ri = 0; ri < cols; ri++) {
            var s1 = hsh(bi * 17 + ri, cc2.cy * 13 + rj, 206);
            if (s1 < 0.18) continue;
            var s2 = hsh(bi * 29 + ri, cc2.cx * 7 + rj, 207);
            var s3 = hsh(bi * 41 + rj, cc2.cy * 19 + ri, 208);
            var w = uw * (.62 + s2 * .3), h = uh * (.62 + s3 * .3);
            var x = bx + ri * uw + (uw - w) / 2, y = by + rj * uh + (uh - h) / 2;
            var tall = s3 < 0.30 - dc * 0.2;
            var ht = tall ? 18 + s2 * 28 : 4 + s2 * 9;
            var oxx = -ht * 0.42, oyy = -ht * 0.58;
            ctx.fillStyle = C.bSide;
            ctx.beginPath();
            ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w + oxx, y + h + oyy); ctx.lineTo(x + oxx, y + h + oyy); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w + oxx, y + h + oyy); ctx.lineTo(x + w + oxx, y + oyy); ctx.closePath(); ctx.fill();
            ctx.fillStyle = tall ? C.bTopLit : C.bTop;
            ctx.fillRect(x + oxx, y + oyy, w, h);
            ctx.strokeStyle = 'rgba(6,8,10,.85)'; ctx.lineWidth = 1.1;
            ctx.strokeRect(x + oxx, y + oyy, w, h);
            if (tall && s1 > 0.3) {
              ctx.fillStyle = C.win;
              for (k = 0; k < 3; k++)
                ctx.fillRect(x + oxx + (.15 + hsh(ri + k, rj + bi, 209) * .65) * w,
                             y + oyy + (.15 + hsh(rj + k, ri + bi, 210) * .65) * h, 1.7, 1.7);
            }
          }
        }
      }
      ctx.restore();
    }

    /* 6 ─ gold territory network, punched out where it crosses water */
    var rc = makeCanvas(RES, RES), rg = rc.getContext('2d');
    rg.lineJoin = rg.lineCap = 'round';
    var passes = [['rgba(206,118,24,.065)', 70], ['rgba(226,144,42,.15)', 40],
                  ['rgba(244,178,84,.32)', 16], ['rgba(255,212,140,.70)', 4.4]];
    for (var pi = 0; pi < passes.length; pi++) {
      rg.strokeStyle = passes[pi][0]; rg.lineWidth = passes[pi][1] * sc;
      for (i = 0; i < cells.length; i++) { pathPoly(rg, cells[i].poly, ox, oy, sc); rg.stroke(); }
    }
    rg.globalCompositeOperation = 'destination-out';
    for (i = 0; i < rivers.length; i++) { ribbon(rg, rivers[i], ox, oy, sc, 1.02); rg.fill(); }
    ctx.drawImage(rc, 0, 0);

    /* 7 ─ settlement nodes */
    for (i = 0; i < cells.length; i++) {
      var cn = cells[i];
      if (!cn.node) continue;
      var sx = (cn.site[0] - ox) * sc, sy = (cn.site[1] - oy) * sc;
      var rad3 = (38 + hsh(cn.cx, cn.cy, 301) * 30) * sc;
      var g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad3 * 2.3);
      g2.addColorStop(0, 'rgba(216,146,44,.22)'); g2.addColorStop(1, 'rgba(216,146,44,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, rad3 * 2.3, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,206,132,.78)'; ctx.lineWidth = 2.6 * sc;
      ctx.beginPath(); ctx.arc(sx, sy, rad3, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,206,126,.42)'; ctx.lineWidth = 1.7 * sc;
      ctx.beginPath(); ctx.arc(sx, sy, rad3 * .58, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,140,.32)'; ctx.lineWidth = 1.5 * sc;
      ctx.beginPath();
      for (k = 0; k < 8; k++) {
        var a2 = k / 8 * 6.283 + .3;
        ctx.moveTo(sx + Math.cos(a2) * rad3 * .58, sy + Math.sin(a2) * rad3 * .58);
        ctx.lineTo(sx + Math.cos(a2) * rad3, sy + Math.sin(a2) * rad3);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(250,214,150,.7)';
      ctx.beginPath(); ctx.arc(sx, sy, 4.6 * sc, 0, 6.283); ctx.fill();
    }

    /* 8 ─ corruption sigils and spires */
    for (i = 0; i < cells.length; i++) {
      var cq = cells[i];
      if (cq.kind !== 'corrupt') continue;
      for (var n2 = 0; n2 < 2; n2++) {
        var cxw = cq.site[0] + (hsh(cq.cx, cq.cy + n2, 401) - .5) * 380;
        var cyw = cq.site[1] + (hsh(cq.cx + n2, cq.cy, 402) - .5) * 380;
        if (wet(cxw, cyw)) continue;
        var CX = (cxw - ox) * sc, CY = (cyw - oy) * sc;
        var rad4 = (90 + hsh(cq.cx, cq.cy + n2, 403) * 65) * sc;
        var g3 = ctx.createRadialGradient(CX, CY, 0, CX, CY, rad4 * 2);
        g3.addColorStop(0, 'rgba(126,54,194,.18)'); g3.addColorStop(1, 'rgba(126,54,194,0)');
        ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(CX, CY, rad4 * 2, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(206,138,255,.85)'; ctx.lineWidth = 2.6 * sc;
        ctx.beginPath(); ctx.arc(CX, CY, rad4, 0, 6.283); ctx.stroke();
        ctx.lineWidth = 1.6 * sc; ctx.strokeStyle = 'rgba(206,138,255,.55)';
        ctx.beginPath(); ctx.arc(CX, CY, rad4 * .64, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(CX, CY, rad4 * .3, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = 'rgba(224,168,255,.45)'; ctx.lineWidth = 1.4 * sc;
        ctx.beginPath();
        for (k = 0; k < 12; k++) {
          var a3 = k / 12 * 6.283;
          ctx.moveTo(CX + Math.cos(a3) * rad4 * .3, CY + Math.sin(a3) * rad4 * .3);
          ctx.lineTo(CX + Math.cos(a3) * rad4, CY + Math.sin(a3) * rad4);
        }
        ctx.stroke();
      }
      for (var n3 = 0; n3 < 9; n3++) {
        var sxw = cq.site[0] + (hsh(cq.cx * 3 + n3, cq.cy, 404) - .5) * 520;
        var syw = cq.site[1] + (hsh(cq.cx, cq.cy * 3 + n3, 405) - .5) * 520;
        if (wet(sxw, syw)) continue;
        var SX = (sxw - ox) * sc, SY = (syw - oy) * sc;
        var hh = (20 + hsh(n3, cq.cx + cq.cy, 406) * 34) * sc, ww = hh * .24;
        ctx.fillStyle = 'rgba(112,50,176,.62)';
        ctx.beginPath(); ctx.moveTo(SX, SY - hh); ctx.lineTo(SX + ww, SY); ctx.lineTo(SX - ww, SY); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(206,138,255,.6)';
        ctx.beginPath(); ctx.moveTo(SX, SY - hh); ctx.lineTo(SX + ww * .35, SY); ctx.lineTo(SX - ww * .1, SY); ctx.closePath(); ctx.fill();
      }
    }

    /* 9 ─ gold field icons, one per district that rolls for it */
    var D = 380;
    for (var dy = Math.floor(y0 / D) - 1; dy <= Math.floor(y1 / D) + 1; dy++) {
      for (var dx = Math.floor(x0 / D) - 1; dx <= Math.floor(x1 / D) + 1; dx++) {
        if (hsh(dx, dy, 501) > 0.16) continue;
        var ix = (dx + .2 + hsh(dx, dy, 502) * .6) * D;
        var iy = (dy + .2 + hsh(dx, dy, 503) * .6) * D;
        if (wet(ix, iy)) continue;
        var nse = nearestSite(ix, iy);
        if (nse.edge < 70) continue;
        var IX = (ix - ox) * sc, IY = (iy - oy) * sc, szi = 46 * sc;
        ctx.save(); ctx.translate(IX, IY);
        var g4 = ctx.createRadialGradient(0, 0, 0, 0, 0, szi * 1.5);
        g4.addColorStop(0, 'rgba(226,158,54,.20)'); g4.addColorStop(1, 'rgba(226,158,54,0)');
        ctx.fillStyle = g4; ctx.beginPath(); ctx.arc(0, 0, szi * 1.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(12,15,18,.9)';
        ctx.beginPath();
        for (k = 0; k < 6; k++) {
          var a4 = k / 6 * 6.283 + Math.PI / 6;
          var hx = Math.cos(a4) * szi / 2, hy = Math.sin(a4) * szi / 2;
          k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,140,.9)'; ctx.lineWidth = 2.2 * sc; ctx.stroke();
        ctx.save();
        ctx.scale(szi / 46, szi / 46);
        ctx.translate(-13, -13); ctx.scale(26 / 24, 26 / 24);
        ctx.strokeStyle = 'rgba(255,224,158,.95)'; ctx.lineWidth = 1.7;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        strokeIcon(ctx, ICONS[(hsh(dx, dy, 504) * ICONS.length) | 0]);
        ctx.restore(); ctx.restore();
      }
    }
  }

  function pointIn(p, x, y) {
    var inside = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) &&
          x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    }
    return inside;
  }

  root.Worldgen = {
    drawTile: drawTile, waterDist: waterDist, cell: cell, cellsFor: cellsFor,
    nearestSite: nearestSite, setSeed: function (s) { SEED = s; cellCache = {}; }
  };
})(typeof window !== 'undefined' ? window : global);
