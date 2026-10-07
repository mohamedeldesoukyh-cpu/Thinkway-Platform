// Ported from creator-list-fragment.html; brand artwork is supplied separately.

export const CREATOR_LIST_CSS = String.raw`
/* ================================================================
   BABY JOY — CREATOR LIST
   Identity carried over from the original: navy #050443, panel
   #211e5c, strip #25225f, pink #ff3da8, white cards, 1600x900.
   ================================================================ */
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#050443;color:#fff;
 font-family:'Geist','Helvetica Neue',Arial,Helvetica,sans-serif;
 -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}

:root{
 --nv:#050443; --nv2:#0b0a5c; --pnl:#211e5c; --strip:#25225f;
 --pk:#ff3da8; --pk2:#ff7cc4; --ink:#080642; --mut:#666477;
 --dim:#c4c1d6; --dim2:#aaa6cf; --line:rgba(255,255,255,.14);
 --ez:cubic-bezier(.23,1,.32,1);
}

.page{width:1600px;height:900px;padding:32px 52px 30px;position:relative;
 overflow:hidden;break-after:page;background:var(--nv)}
.page:last-child{break-after:auto}

/* ================================================================
   COVER + CLOSING — the portrait wall
   ================================================================ */
.mosaic{position:absolute;inset:0;display:grid;
 grid-template-columns:repeat(16,1fr);grid-auto-rows:1fr;gap:3px;
 transform:scale(1.06);filter:saturate(.55)}
.mosaic img{width:100%;height:100%;object-fit:cover;display:block;opacity:.42}
.mosaic s{display:block;background:#171456;text-decoration:none}

.veil{position:absolute;inset:0;
 background:
  radial-gradient(120% 95% at 8% 50%,rgba(5,4,67,.99) 26%,rgba(5,4,67,.86) 46%,rgba(5,4,67,.42) 72%,rgba(5,4,67,.26) 100%),
  linear-gradient(180deg,rgba(5,4,67,.72),rgba(5,4,67,.20) 34%,rgba(5,4,67,.86))}
.veil--end{background:
  radial-gradient(130% 110% at 50% 46%,rgba(5,4,67,.97) 30%,rgba(5,4,67,.88) 58%,rgba(5,4,67,.55) 100%),
  linear-gradient(180deg,rgba(5,4,67,.80),rgba(5,4,67,.30) 40%,rgba(5,4,67,.92))}

/* cover and closing sit over imagery, so their chrome needs more contrast */
.page--cov,.page--end{padding:36px 52px 30px}
.page--cov footer,.page--end footer{color:#d8d5ea;
 text-shadow:0 1px 3px rgba(5,4,67,.75)}
.page--cov footer s,.page--end footer s{background:rgba(255,255,255,.22)}

/* ---------------- cover ---------------- */
.cov{position:relative;height:100%;display:flex;flex-direction:column;
 justify-content:center;max-width:960px;padding-left:8px}
.cov__brand{display:flex;align-items:center;gap:10px;margin:0 0 30px}
.cov__rule{width:34px;height:1px;background:var(--line);margin:0 4px}
.cov__for{font-size:10.5px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;
 color:var(--dim2)}

.cov__client h1{font-size:104px;line-height:.95;margin:0;font-weight:800;
 letter-spacing:-3.6px;color:#fff;max-width:14ch}
.cov__client img{max-height:120px;max-width:460px;display:block;margin:0 0 6px}

.cov__strip{display:flex;align-items:center;gap:14px;margin:26px 0 0;
 padding:11px 22px;background:rgba(37,34,95,.82);border:1px solid var(--line);
 border-radius:30px;width:max-content;backdrop-filter:blur(6px)}
.cov__kind{font-size:14px;font-weight:700;letter-spacing:.3px}
.cov__dot{width:3px;height:3px;border-radius:50%;background:var(--dim2);opacity:.7}
.cov__ref,.cov__date{font-size:13px;color:var(--dim);letter-spacing:.3px;
 font-family:ui-monospace,'SF Mono',Menlo,monospace}

.cov__count{display:flex;align-items:center;gap:22px;margin:44px 0 0}
.cov__count b{font-size:132px;line-height:.84;font-weight:800;letter-spacing:-6px;
 color:var(--pk);font-variant-numeric:tabular-nums}
.cov__count span{display:block;padding-left:22px;border-left:1px solid var(--line)}
.cov__count u{display:block;text-decoration:none;font-size:27px;font-weight:700;
 letter-spacing:-.6px;color:#fff;line-height:1.1}
.cov__count i{display:block;font-style:normal;font-size:13.5px;color:var(--dim2);
 margin-top:5px;letter-spacing:.2px}

/* ================================================================
   CREATOR PAGES
   ================================================================ */
.ph{display:flex;align-items:center;gap:16px;margin:0 0 15px;height:34px}
.ph__l{display:flex;align-items:center;gap:9px;flex:0 0 auto}
.ph__c{flex:1;display:flex;align-items:baseline;gap:11px;justify-content:center;
 min-width:0;padding:0 16px}
.ph__c b{font-size:19px;font-weight:700;letter-spacing:-.4px;white-space:nowrap;
 overflow:hidden;text-overflow:ellipsis}
.ph__c span{font-size:11px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;
 color:var(--dim2);white-space:nowrap}
.ph__r{flex:0 0 auto;display:flex;align-items:baseline;gap:7px}
.ph__r em{font-style:normal;font-size:17px;font-weight:700;color:var(--pk);
 font-variant-numeric:tabular-nums}
.ph__r span{font-size:12px;color:var(--dim2);font-variant-numeric:tabular-nums}

.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:13px;
 background:linear-gradient(168deg,#262263,var(--pnl) 62%);
 border:1px solid rgba(255,255,255,.07);border-radius:20px;
 padding:15px 17px 18px;min-height:530px;align-items:start;
 box-shadow:0 22px 50px -30px rgba(0,0,0,.85)}

/* ---------------- the card ---------------- */
.creator-card{height:508px;padding:10px 10px 12px;background:#fff;border-radius:13px;
 color:var(--ink);overflow:hidden;display:flex;flex-direction:column;
 box-shadow:0 2px 0 rgba(0,0,0,.16);
 transition:transform .3s var(--ez),box-shadow .3s var(--ez)}

.portrait{position:relative;display:block;height:368px;border-radius:9px;
 overflow:hidden;background:#efedf4;text-decoration:none;color:var(--strip);flex:0 0 auto}
.portrait img{height:100%;width:100%;object-fit:cover;display:block;
 transition:transform .5s var(--ez)}
.placeholder{height:100%;display:grid;place-items:center;font-size:52px;color:#a9a3cf;
 background:linear-gradient(145deg,#eeebfa,#b9b5dd)}

/* Portraits are shown without a colour overlay. */
.creator-identity{display:flex;align-items:center;gap:8px;margin-top:10px;min-width:0}
.creator-avatar{width:32px;height:32px;flex:0 0 32px;border-radius:50%;object-fit:cover;
 background:#efedf7;color:#4b4780;display:grid;place-items:center;font-size:14px;font-weight:700}
.creator-label{min-width:0;flex:1}
.creator-label h2{margin:0;text-align:left;height:auto;max-height:38px;font-size:13px;line-height:17px}
.creator-label p{text-align:left;font-size:10px;line-height:14px}
.creator-tier{display:block;font-size:10px;line-height:14px;font-weight:700;color:#6551ad;margin-top:2px}
.creator-categories{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.creator-category{font-size:9px;line-height:12px;background:#efedf7;color:#4b4780;
 border-radius:10px;padding:3px 6px;max-width:100%;overflow-wrap:anywhere}
.creator-category--none{background:#f5f4f9;color:#77728e;font-style:italic}

/* specimen index — gives the sheet its catalogue feel */
.idx{position:absolute;top:8px;left:8px;z-index:2;
 font:700 10px/1 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.6px;
 color:#fff;background:rgba(8,6,66,.55);backdrop-filter:blur(4px);
 border:1px solid rgba(255,255,255,.22);border-radius:6px;padding:4px 6px}

/* platform mark, taken from the real destination link */
.pb{position:absolute;top:8px;right:8px;z-index:2;width:22px;height:22px;border-radius:7px;
 display:flex;align-items:center;justify-content:center;
 font:800 8.5px/1 'Geist',Arial,sans-serif;letter-spacing:-.2px;color:#fff;
 box-shadow:0 2px 6px rgba(8,6,66,.4)}
.pb--ig{background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)}
.pb--tt{background:#0B0F1A}
.pb-stack{position:absolute;top:8px;right:8px;z-index:2;display:flex;align-items:center;direction:ltr}
.pb-stack__item{position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:transparent;border:0;border-radius:0;box-shadow:none}
.pb-stack__item+.pb-stack__item{margin-left:-7px}
.portrait .pb-stack img{position:static;width:28px;height:28px;object-fit:contain;border-radius:0;transform:none;background:transparent;border:0;box-shadow:none}
.pb.pb--ig,.pb.pb--tt{background:transparent;border:0;box-shadow:none;border-radius:0;padding:0}.portrait .pb img{position:static;width:100%;height:100%;object-fit:contain;border-radius:0}

h2{font-size:15.5px;line-height:19px;text-align:center;margin:11px 0 0;height:38px;
 overflow:hidden;font-weight:700;letter-spacing:-.35px;color:var(--ink);
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
p{font-size:12px;line-height:16px;text-align:center;margin:2px 0 0;color:var(--mut);
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
 font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:-.2px}

.locs{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:8px 0 0}
.loc{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
 color:#4b4780;background:#efedf7;border-radius:20px;padding:4px 8px;
 white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.loc--none{color:#9e9ab8;background:#f5f4f9;font-weight:600;font-style:italic;
 text-transform:none;letter-spacing:.2px}

/* ---------------- footer ---------------- */
footer{position:absolute;bottom:22px;left:52px;right:52px;display:flex;
 align-items:center;gap:12px;color:var(--dim2);font-size:11px;letter-spacing:.5px;
 font-family:ui-monospace,'SF Mono',Menlo,monospace}
footer s{flex:1;height:1px;background:var(--line);text-decoration:none}

/* ================================================================
   CLOSING PAGE
   ================================================================ */
.end{position:relative;height:100%;display:flex;flex-direction:column;
 justify-content:center;align-items:center;text-align:center;padding:0 40px}
.end__eye{font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
 color:var(--pk2)}
.end__hd h1{font-size:74px;line-height:1;margin:14px 0 0;font-weight:800;
 letter-spacing:-2.4px}
.end__hd p{font-size:14.5px;line-height:1.6;color:var(--dim);margin:14px auto 0;
 max-width:60ch;text-align:center;font-family:inherit;white-space:normal}

.end__g{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:38px 0 0;
 width:100%;max-width:1180px}
.bk{background:rgba(37,34,95,.62);border:1px solid var(--line);border-radius:16px;
 padding:16px 18px 18px;text-align:left;backdrop-filter:blur(6px)}
.bk__k{display:block;font-size:9.5px;font-weight:700;letter-spacing:2px;
 text-transform:uppercase;color:var(--dim2);margin:0 0 12px}
.bk__b{display:flex;flex-wrap:wrap;gap:8px 22px}
.bk__b--col{flex-direction:column;gap:9px}
.st{display:flex;align-items:baseline;gap:7px}
.st b{font-size:25px;font-weight:800;letter-spacing:-.9px;color:#fff;
 font-variant-numeric:tabular-nums}
.st span{font-size:11.5px;color:var(--dim);letter-spacing:.2px}
.bk--note p{font-size:11.5px;line-height:1.55;color:var(--dim);margin:0;
 text-align:left;white-space:normal;font-family:inherit}
.bk--note b{color:#fff;font-weight:700}
.bk--note em{font-style:italic;color:var(--dim2)}

.report-total-cost{display:flex;align-items:center;justify-content:space-between;gap:24px;width:100%;max-width:1180px;margin-top:22px;padding:18px 24px;border:1px solid var(--line);border-radius:14px;background:rgba(37,34,95,.8)}
.report-total-cost span{font-size:16px;color:#fff;font-weight:600}
.report-total-cost strong{font-size:28px;color:#fff;font-variant-numeric:tabular-nums}
.end__ft{display:flex;align-items:center;gap:14px;width:100%;max-width:1180px;
 margin:34px 0 0;padding:16px 2px 0;border-top:1px solid var(--line)}
.end__brand{display:flex;align-items:center;gap:9px}
.end__sp{flex:1}
.end__ref{font-size:11.5px;color:var(--dim2);letter-spacing:.5px;
 font-family:ui-monospace,'SF Mono',Menlo,monospace}

/* ================================================================
   SCREEN-ONLY POLISH — print output is untouched
   ================================================================ */
@media screen{
 .creator-card:hover{transform:translateY(-6px);
  box-shadow:0 20px 34px -18px rgba(0,0,0,.8),0 0 0 2px var(--pk)}
 .creator-card:hover .portrait img{transform:scale(1.05)}
 .portrait:focus-visible{outline:3px solid var(--pk);outline-offset:2px}
}

/* ================================================================
   PRINT / PDF — 1600x900 landscape, exact colour
   ================================================================ */
@page{size:1600px 900px;margin:0}
@media print{
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .creator-card{box-shadow:none;border:1px solid #e6e3f0}
 .cards{box-shadow:none}
}

/* ================================================================
   RESPONSIVE
   ================================================================ */
@media screen and (min-width:901px) and (max-width:1599px){
 .page{zoom:calc(100vw / 1600px)}
}
@media screen and (max-width:900px){
 .page{width:100%;height:auto;min-height:100vh;padding:22px 18px 26px}
 .mosaic{grid-template-columns:repeat(8,1fr)}
 .cov{max-width:none;padding:60px 0}
 .cov__client h1{font-size:46px;letter-spacing:-1.6px}
 .cov__count{margin-top:30px;gap:16px}
 .cov__count b{font-size:74px;letter-spacing:-3px}
 .cov__count u{font-size:19px}
 .cov__strip{width:auto;flex-wrap:wrap;gap:9px;padding:10px 16px}
 .ph{height:auto;flex-wrap:wrap;gap:9px}
 .ph__c{justify-content:flex-start;padding:0}
 .cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0;padding:12px}
 .creator-card{height:auto}
 .portrait{height:auto;aspect-ratio:9/16}
 .end__hd h1{font-size:40px;letter-spacing:-1.2px}
 .end__g{grid-template-columns:1fr;margin-top:26px}
 .end__ft{flex-wrap:wrap;gap:10px}
 footer{position:static;margin-top:16px;left:auto;right:auto}
}
@media (prefers-reduced-motion:reduce){
 .creator-card,.portrait img{transition:none}
 .creator-card:hover{transform:none}
 .creator-card:hover .portrait img{transform:none}
}
`;

export const CREATOR_LIST_WALL_SCRIPT = String.raw`
/* ================================================================
   Portrait wall for the cover and closing pages.

   Built at runtime by REUSING the srcs already in the document, so
   the wall costs zero extra bytes in the file. The browser decodes
   each unique portrait once and shares it across every use.

   Deterministic shuffle: the wall is identical on every open and in
   every PDF export. No Math.random.
   ================================================================ */
(function () {
  var COLS = 16, ROWS = 9;

  var srcs = [];
  var imgs = document.querySelectorAll('.creator-card .portrait > img');
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].src) srcs.push(imgs[i].src);
  }

  var walls = document.querySelectorAll('[data-mosaic]');
  if (!walls.length) return;

  if (!srcs.length) {                    // no portraits at all — leave a flat ground
    for (var w = 0; w < walls.length; w++) walls[w].style.display = 'none';
    return;
  }

  /* fixed-seed LCG, so the layout never changes between renders */
  function order(n, seed) {
    var idx = [], s = seed;
    for (var i = 0; i < n; i++) idx.push(i);
    for (var j = n - 1; j > 0; j--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var k = s % (j + 1);
      var t = idx[j]; idx[j] = idx[k]; idx[k] = t;
    }
    return idx;
  }

  for (var p = 0; p < walls.length; p++) {
    var wall = walls[p];
    var cells = COLS * ROWS;
    var seq = order(srcs.length, p === 0 ? 20260929 : 19750413);
    var frag = document.createDocumentFragment();

    for (var c = 0; c < cells; c++) {
      var src = srcs[seq[c % seq.length]];
      if (!src) { frag.appendChild(document.createElement('s')); continue; }
      var im = document.createElement('img');
      im.src = src;
      im.alt = '';
      im.setAttribute('aria-hidden', 'true');
      im.loading = 'eager';             /* must be painted before print */
      frag.appendChild(im);
    }
    wall.appendChild(frag);
  }
})();

/* Flatten gradient colours into a PNG overlay before printing. Some PDF viewers
   cannot render Chromium's ShadingType 1 gradients and paint them hot pink.
   This leaves portraits, text and links untouched and
   adds no embedded portrait copies to the downloaded HTML. */
(function () {
  function sample(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
      }
    }
    return stops[stops.length - 1][1];
  }
  document.querySelectorAll('.veil').forEach(function (veil) {
    var end = veil.classList.contains('veil--end');
    var canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 900;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var pixels = ctx.createImageData(1600, 900), data = pixels.data;
    var radial = end ? [[.30,.97],[.58,.88],[1,.55]] : [[.26,.99],[.46,.86],[.72,.42],[1,.26]];
    var linear = end ? [[0,.80],[.40,.30],[1,.92]] : [[0,.72],[.34,.20],[1,.86]];
    for (var y = 0; y < 900; y++) {
      var underneath = sample(linear, (y + .5) / 900);
      for (var x = 0; x < 1600; x++) {
        var dx = ((x + .5) / 1600 - (end ? .50 : .08)) / (end ? 1.30 : 1.20);
        var dy = ((y + .5) / 900 - (end ? .46 : .50)) / (end ? 1.10 : .95);
        var top = sample(radial, Math.sqrt(dx * dx + dy * dy));
        var offset = (y * 1600 + x) * 4;
        data[offset] = 5; data[offset + 1] = 4; data[offset + 2] = 67;
        data[offset + 3] = Math.round((top + underneath * (1 - top)) * 255);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    // An eager image participates in the report's existing decode-before-PDF gate.
    var overlay = document.createElement('img');
    overlay.src = canvas.toDataURL('image/png');
    overlay.alt = ''; overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'display:block;width:100%;height:100%';
    veil.style.background = 'none';
    veil.appendChild(overlay);
  });
})();
`;
