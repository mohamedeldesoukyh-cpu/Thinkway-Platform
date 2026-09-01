/** Thinkway Report Design System v2 — used by performance report HTML/PDF. */
export const PERFORMANCE_REPORT_DESIGN_V2_STYLES = `

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+Arabic:wght@400;500;700&display=swap');

/* ============================================================
   THINKWAY REPORT DESIGN SYSTEM v2
   Tokens
   ============================================================ */
:root{
  --navy:#070C1B;      --navy-2:#0C1530;     --navy-3:#13204A;
  --blue:#0057FF;      --blue-600:#0047D6;   --blue-300:#5C8DFF;
  --blue-tint:#EFF4FF; --blue-tint-2:#DCE6FF;
  --ink:#111726;       --ink-2:#3A4358;      --muted:#767F92;
  --rule:#E4E8F0;      --rule-2:#EFF2F7;     --paper:#FFFFFF;  --shell:#B9C4DA;
  --green:#04785A;     --green-tint:#E8F7F1;
  --ig:#D62976; --tt:#111111; --fb:#1877F2; --yt:#EF1B24;
  --pw:210mm; --ph:297mm; --pad:15mm;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

html{-webkit-text-size-adjust:100%}
body{
  font-family:'Inter','Noto Sans Arabic',-apple-system,BlinkMacSystemFont,'Segoe UI',
              'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
  font-size:12px; line-height:1.5; color:var(--ink);
  background:var(--shell);
  font-feature-settings:'kern' 1,'liga' 1,'cv11' 1;
  -webkit-font-smoothing:antialiased;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
img{max-width:100%}
a{color:var(--blue);text-decoration:none}
strong{font-weight:600}
.num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
.bidi{unicode-bidi:plaintext}

/* ============================================================
   Page shell
   ============================================================ */
@page{size:A4;margin:0}
.sheet{
  position:relative; width:var(--pw); height:var(--ph);
  margin:22px auto; background:var(--paper);
  box-shadow:0 2px 6px rgba(8,12,26,.10),0 14px 40px rgba(8,12,26,.16);
  overflow:hidden; display:flex; flex-direction:column;
  page-break-after:always; break-after:page;
}
.sheet:last-child{page-break-after:auto;break-after:auto}

.sheet__head{
  flex:none; height:16mm; padding:0 var(--pad);
  display:flex; align-items:center; justify-content:space-between;
  border-bottom:1px solid var(--rule);
}
.sheet__head .hm{font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);font-weight:600}
.sheet__body{flex:1;padding:9mm var(--pad) 3mm;display:flex;flex-direction:column;min-height:0;overflow:hidden}
/* explicit spacer — auto margins are unreliable in print engines */
.grow{flex:1 1 auto;min-height:6px}
.sheet__foot{
  flex:none; height:13mm; padding:0 var(--pad);
  display:flex; align-items:center; justify-content:space-between;
  border-top:1px solid var(--rule-2);
  font-size:8.5px; color:var(--muted); letter-spacing:.4px;
  position:relative; z-index:2; background:var(--paper);
}
.sheet__foot .pg{font-weight:700;color:var(--ink-2);font-variant-numeric:tabular-nums}
.sheet--dark{background:var(--navy);color:#fff}

/* wordmark */
.wm{display:inline-flex;align-items:baseline;font-weight:800;letter-spacing:-.5px;line-height:1;white-space:nowrap}
.wm i{font-style:normal;color:var(--blue)}
.wm--sm{font-size:13px}
.wm--md{font-size:19px}
.wm--lg{font-size:30px}
.wm--light{color:#fff}
.wm--dark{color:var(--ink)}

/* micro label */
.ml{font-size:8.5px;letter-spacing:1.7px;text-transform:uppercase;color:var(--muted);font-weight:600;line-height:1.3}
.ml--blue{color:var(--blue)}
.ml--faint{color:rgba(255,255,255,.45)}

/* ============================================================
   Cover
   ============================================================ */
.cover{
  color:#fff;padding:0;position:relative;overflow:hidden;
  background:
    radial-gradient(120% 90% at 108% -8%, rgba(0,87,255,.55) 0%, rgba(0,87,255,0) 58%),
    radial-gradient(90% 70% at -14% 108%, rgba(35,74,190,.42) 0%, rgba(35,74,190,0) 62%),
    var(--navy);
}
.cover__in{position:relative;z-index:2;height:100%;flex:1;display:flex;flex-direction:column;
  justify-content:space-between;padding:18mm var(--pad) 12mm}
.cover__top{display:flex;align-items:flex-start;justify-content:space-between}
.cover__badge{
  border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 12px;
  font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:#C6D5FF;font-weight:600;
}
.cover__mid{padding-top:10mm}
.cover__kicker{font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:var(--blue-300);font-weight:700}
.cover__rule{width:56px;height:3px;background:var(--blue);border-radius:2px;margin:14px 0 18px}
.cover__title{font-size:40px;line-height:1.06;font-weight:800;letter-spacing:-1.4px;max-width:15.5ch}
.cover__lede{margin-top:14px;font-size:12.5px;line-height:1.6;color:#B7C6E8;max-width:46ch}

.cover__meta{margin-top:11mm;display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid rgba(255,255,255,.16)}
.cover__meta .mi{padding:12px 16px 12px 0;border-bottom:1px solid rgba(255,255,255,.10)}
.cover__meta .mi:nth-child(3n+2),.cover__meta .mi:nth-child(3n){padding-left:16px;border-left:1px solid rgba(255,255,255,.10)}
.cover__meta .mk{font-size:8px;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.42);font-weight:600}
.cover__meta .mv{font-size:13px;font-weight:600;color:#fff;margin-top:5px;line-height:1.35}

.cover__bot{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.cover__plat{display:flex;gap:10px;align-items:center}
.cover__plat .pi{width:34px;height:34px;display:flex;align-items:center;justify-content:center;
  border-radius:9px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
.cover__plat .pi svg{width:17px;height:17px;fill:#fff}
.cover__qr{display:flex;flex-direction:column;align-items:center;gap:7px}
.cover__qr .qb{background:#fff;padding:7px;border-radius:9px}
.cover__qr img{display:block;width:76px;height:76px}
.cover__qr .ql{font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.5);text-align:center}
.cover__foot{margin-top:8mm;padding-top:12px;border-top:1px solid rgba(255,255,255,.14);
  display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.5);letter-spacing:.6px}

/* ============================================================
   Contents
   ============================================================ */
.toc__hd{margin-bottom:9mm}
.toc__title{font-size:29px;font-weight:800;letter-spacing:-.9px;line-height:1.1}
.toc__sub{font-size:11.5px;color:var(--muted);margin-top:7px;max-width:60ch;line-height:1.6}
.toc__list{list-style:none}
.toc__row{display:flex;align-items:baseline;gap:14px;padding:13px 0;border-bottom:1px solid var(--rule-2)}
.toc__row:first-child{border-top:1px solid var(--rule)}
.toc__n{font-size:10px;font-weight:800;color:var(--blue);width:26px;flex:none;letter-spacing:.5px;font-variant-numeric:tabular-nums}
.toc__t{font-size:13.5px;font-weight:600;color:var(--ink)}
.toc__d{flex:1;border-bottom:1px dotted var(--rule);transform:translateY(-3px)}
.toc__p{font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:600}
.toc__note{padding:14px 16px;background:var(--blue-tint);border-left:2px solid var(--blue);
  font-size:9.5px;line-height:1.65;color:var(--ink-2);margin-bottom:6mm}
/* compact stat strip (contents page) */
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule);
  border:1px solid var(--rule);border-radius:8px;overflow:hidden;margin-bottom:14px}
.strip .t{background:#fff;padding:14px 16px}
.strip .tk{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:600}
.strip .tv{font-size:24px;font-weight:800;letter-spacing:-1px;margin-top:6px;line-height:1;font-variant-numeric:tabular-nums}
.strip .ts{font-size:8.5px;color:var(--muted);margin-top:5px}

/* ============================================================
   Section header
   ============================================================ */
.sec{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:7mm;flex:none}
.sec__l{min-width:0}
.sec__t{font-size:24px;font-weight:800;letter-spacing:-.7px;line-height:1.15;margin-top:6px}
.sec__s{font-size:10.5px;color:var(--muted);margin-top:6px;line-height:1.6;max-width:66ch}
.sec__n{font-size:52px;font-weight:900;letter-spacing:-2px;line-height:.8;color:var(--blue-tint-2);flex:none}

/* ============================================================
   Hero metric band
   ============================================================ */
/* NB: decorative gradients live on the element's own background — a ::before on a
   grid/flex container becomes a box in the layout in some print engines. */
.hero{border-radius:10px;padding:22px 24px;display:grid;grid-template-columns:repeat(3,1fr);
  overflow:hidden;
  background:radial-gradient(120% 140% at 100% 0%,rgba(0,87,255,.42),rgba(0,87,255,0) 62%),var(--navy)}
.hero .h{padding:0 20px}
.hero .h:first-child{padding-left:0}
.hero .h+.h{border-left:1px solid rgba(255,255,255,.14)}
.hero .hk{font-size:8.5px;letter-spacing:1.7px;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:600}
.hero .hv{font-size:42px;font-weight:800;letter-spacing:-1.8px;color:#fff;line-height:1.05;margin-top:11px;font-variant-numeric:tabular-nums}
.hero .hs{font-size:9.5px;color:#9FB2DA;margin-top:9px;line-height:1.5}

/* stat grid */
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--rule);
  border:1px solid var(--rule);border-radius:8px;overflow:hidden;margin-top:5mm;flex:none}
.stats .s{background:#fff;padding:14px 14px 15px}
.stats .sk{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:600}
.stats .sv{font-size:22px;font-weight:800;letter-spacing:-.8px;margin-top:7px;line-height:1;font-variant-numeric:tabular-nums}
.stats .ss{font-size:8.5px;color:var(--muted);margin-top:6px}
.stats .s--accent .sv{color:var(--blue)}
.stats .s--green .sv{color:var(--green)}

.notes{padding-top:6mm;padding-bottom:5mm;display:grid;gap:8px}
.note{font-size:8.5px;line-height:1.6;color:var(--muted);padding-left:16px;position:relative}
.note::before{content:'';position:absolute;left:0;top:6px;width:8px;height:1px;background:var(--blue)}
.note strong{color:var(--ink-2);font-weight:600}

/* ============================================================
   Highlight cards
   ============================================================ */
.hl{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.hl__c{border:1px solid var(--rule);border-radius:10px;padding:15px 16px 14px;position:relative;overflow:hidden;background:#fff}
.hl__c::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--blue)}
.hl__c--ig::before{background:var(--ig)} .hl__c--tt::before{background:var(--tt)}
.hl__c--fb::before{background:var(--fb)} .hl__c--yt::before{background:var(--yt)}
.hl__k{display:flex;align-items:center;gap:8px}
.hl__t{font-size:8.5px;letter-spacing:1.7px;text-transform:uppercase;color:var(--muted);font-weight:600}
.hl__n{font-size:17.5px;font-weight:700;letter-spacing:-.5px;margin-top:10px;line-height:1.25}
.hl__v{font-size:27px;font-weight:800;letter-spacing:-1.1px;color:var(--blue);margin-top:8px;line-height:1;font-variant-numeric:tabular-nums}
.hl__s{font-size:9px;color:var(--muted);margin-top:8px;line-height:1.5}
.hl__c--wide{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:24px}

/* leaderboard */
.lead{border:1px solid var(--rule);border-radius:9px;overflow:hidden}
.lead__r{display:grid;grid-template-columns:22px 1fr 96px 62px;align-items:center;gap:12px;
  padding:9px 14px;border-bottom:1px solid var(--rule-2)}
.lead__r:last-child{border-bottom:none}
.lead__r--h{background:var(--blue-tint);border-bottom:1px solid var(--rule)}
.lead__r--h span{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:600}
.lead__n{font-size:9px;font-weight:800;color:var(--blue);font-variant-numeric:tabular-nums}
.lead__nm{font-size:11px;font-weight:600;unicode-bidi:plaintext;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lead__b{height:6px;background:var(--rule-2);border-radius:999px;overflow:hidden}
.lead__b i{display:block;height:100%;background:var(--blue);border-radius:999px}
.lead__v{text-align:right;font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums}

/* ============================================================
   Tables
   ============================================================ */
.tbl{width:100%;border-collapse:collapse;font-size:11px}
.tbl thead th{
  font-size:8px;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);font-weight:600;
  text-align:left;padding:0 10px 9px;border-bottom:1px solid var(--ink);
}
.tbl thead th.r{text-align:right}
.tbl tbody td{padding:11px 10px;border-bottom:1px solid var(--rule-2);vertical-align:middle}
.tbl tbody tr:last-child td{border-bottom:1px solid var(--rule)}
.tbl td.r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.tbl td:first-child,.tbl th:first-child{padding-left:0}
.tbl td:last-child,.tbl th:last-child{padding-right:0}
.tbl .pl{display:flex;align-items:center;gap:9px;font-weight:600}
.tbl .pl .dot{width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex:none}
.tbl .pl .dot svg{width:10px;height:10px;fill:#fff}
.tbl tfoot td{padding:11px 10px;font-weight:700;font-size:11px;border-top:1px solid var(--ink)}

.minibar{display:inline-flex;align-items:center;gap:9px;justify-content:flex-end;width:100%}
.minibar .mt{width:74px;height:5px;background:var(--rule-2);border-radius:999px;overflow:hidden;flex:none}
.minibar .mf{height:100%;background:var(--blue);border-radius:999px;display:block}
.minibar .mv{width:52px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}

/* insights */
.ins{display:grid;gap:8px;margin-top:5mm}
.ins__i{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--rule);border-radius:9px;padding:11px 14px;background:#fff}
.ins__n{width:20px;height:20px;flex:none;border-radius:6px;background:var(--blue-tint);color:var(--blue);
  font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center}
.ins__x{font-size:10.5px;line-height:1.6;color:var(--ink-2)}
.ins__x b{color:var(--ink);font-weight:600}

/* callout */
.callout{margin-top:5mm;border:1px solid var(--rule);border-radius:9px;padding:14px 16px;background:var(--blue-tint);
  display:flex;align-items:center;justify-content:space-between;gap:16px}
.callout .ck{font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--blue);font-weight:700}
.callout .cv{font-size:15px;font-weight:700;margin-top:5px;letter-spacing:-.3px}
.callout .cn{font-size:26px;font-weight:800;color:var(--blue);letter-spacing:-1px;font-variant-numeric:tabular-nums}

/* ============================================================
   Bar charts
   ============================================================ */
.chart+.chart{margin-top:7mm}
.chart__h{display:flex;align-items:baseline;justify-content:space-between;gap:20px;
  padding-bottom:9px;border-bottom:1px solid var(--rule);margin-bottom:12px}
.chart__t{font-size:13px;font-weight:700;letter-spacing:-.2px;white-space:nowrap;flex:none}
.chart__u{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);
  font-weight:600;white-space:nowrap;flex:none;text-align:right}
.bars{display:grid;gap:9px}
.bars--tall{gap:15px}
.bars--tall .bar__t{height:13px}
.bars--tall .bar__l,.bars--tall .bar__v{font-size:10.5px}
.bar{display:grid;grid-template-columns:150px 1fr 60px;align-items:center;gap:12px}
.bar__l{font-size:9.5px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;unicode-bidi:plaintext}
.bar__t{height:9px;background:var(--rule-2);border-radius:999px;overflow:hidden}
.bar__f{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--blue-600),var(--blue-300));display:block}
.bar__f--flat{background:var(--blue)}
.bar__v{font-size:10px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.bar--rank .bar__l{display:flex;align-items:center;gap:8px}
.bar--rank .bar__l i{font-style:normal;font-size:8.5px;font-weight:800;color:var(--blue);width:14px;flex:none;font-variant-numeric:tabular-nums}

/* share bars */
.share{display:grid;gap:12px}
.share__r{display:grid;grid-template-columns:24px 92px 1fr 84px;align-items:center;gap:12px}
.share__i{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center}
.share__i svg{width:13px;height:13px;fill:#fff}
.share__n{font-size:11.5px;font-weight:600}
.share__t{height:11px;background:var(--rule-2);border-radius:999px;overflow:hidden}
.share__f{height:100%;border-radius:999px;display:block}
.share__v{text-align:right;font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums}
.share__v em{font-style:normal;color:var(--muted);font-weight:500;font-size:9.5px}

/* ============================================================
   Publication cards
   ============================================================ */
.pgrid{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,minmax(0,1fr));
  gap:10px;align-content:stretch;flex:1 1 auto;min-height:0}
.pcard{border:1px solid var(--rule);border-radius:10px;overflow:hidden;background:#fff;
  display:flex;flex-direction:column;min-height:0;height:100%;
  break-inside:avoid;page-break-inside:avoid}
.pcard .grow{display:none}
.pcard__media{position:relative;width:100%;flex:1 1 0;min-height:72px;height:auto;padding-top:0;
  background:#EDF0F6;overflow:hidden}
.pcard__media img{position:absolute;top:0;left:0;right:0;bottom:0;
  width:100%;height:100%;object-fit:cover;display:block}
.pcard__ph{position:absolute;top:0;left:0;right:0;bottom:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  background:linear-gradient(135deg,#F2F5FA,#E4EAF5)}
.pcard__ph svg{width:26px;height:26px;fill:#B4BECF}
.pcard__ph span{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#9AA5B8;font-weight:600}
.pcard__chip{position:absolute;left:9px;bottom:9px;display:inline-flex;align-items:center;gap:6px;
  padding:4px 9px 4px 6px;border-radius:999px;background:rgba(7,12,27,.82);color:#fff;
  font-size:8px;font-weight:700;letter-spacing:.9px;text-transform:uppercase}
.pcard__chip svg{width:10px;height:10px;fill:#fff}
.pcard__av{position:absolute;right:9px;bottom:9px;padding:3px 8px;border-radius:999px;
  background:var(--green);color:#fff;font-size:7.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
.pcard__b{padding:8px 11px 9px;display:flex;flex-direction:column;gap:4px;flex:none;min-height:0;overflow:hidden}
.pcard__hd{display:flex;align-items:center;gap:9px;min-width:0}
.pcard__ava{width:26px;height:26px;border-radius:50%;flex:none;position:relative;overflow:hidden;
  background:var(--navy-3);color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:9px;font-weight:700;letter-spacing:.3px}
.pcard__ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
.pcard__nm{font-size:11.5px;font-weight:700;letter-spacing:-.1px;line-height:1.25;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:plaintext}
.pcard__mt{font-size:8.5px;color:var(--muted);letter-spacing:.3px}
.pcard__cap{font-size:9px;line-height:1.45;color:var(--ink-2);unicode-bidi:plaintext;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-height:26px}
.pcard__tg{font-size:8px;line-height:1.4;color:var(--blue);unicode-bidi:plaintext;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;max-height:12px;word-break:break-word}
.pcard__tg .mn{color:var(--muted)}
.pcard__url{font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcard__url a{color:var(--blue);text-decoration:underline;font-weight:600}
.pcard__media--link{display:block;color:inherit;text-decoration:none;cursor:pointer}
.pcard__media--link:hover img{opacity:.92}
.pcard__foot{margin-top:2px}
.pcard__k{padding-top:8px;border-top:1px solid var(--rule-2);
  display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.pcard__k .k span{display:block;font-size:7px;letter-spacing:1.1px;text-transform:uppercase;
  color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden}
.pcard__k .k strong{display:block;font-size:12.5px;font-weight:700;letter-spacing:-.3px;margin-top:3px;font-variant-numeric:tabular-nums}
.pcard__k .k--er strong{color:var(--blue)}
.pcard__k2{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding-top:6px;margin-top:6px;border-top:1px dashed var(--rule)}
.pcard__k2 .k span{display:block;font-size:6.5px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);font-weight:600}
.pcard__k2 .k strong{display:block;font-size:9.5px;font-weight:600;margin-top:2px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.pcard__src{font-size:7px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-top:4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ============================================================
   Divider page
   ============================================================ */
.divider{color:#fff;position:relative;overflow:hidden;
  background:radial-gradient(110% 90% at 100% 100%,rgba(4,120,90,.5),rgba(4,120,90,0) 60%),
             radial-gradient(90% 80% at 0% 0%,rgba(0,87,255,.42),rgba(0,87,255,0) 62%),var(--navy)}
.divider__in{position:relative;z-index:2;height:100%;flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 var(--pad)}
.divider__k{font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:var(--blue-300);font-weight:700}
.divider__t{font-size:46px;font-weight:800;letter-spacing:-1.8px;margin-top:16px;line-height:1.05}
.divider__rule{width:56px;height:3px;background:var(--blue);border-radius:2px;margin:22px 0}
.divider__c{font-size:15px;font-weight:600;color:#fff}
.divider__x{font-size:12px;color:#A9BAE0;margin-top:12px;max-width:52ch;line-height:1.65}

/* ============================================================
   Closing
   ============================================================ */
.close{color:#fff;position:relative;overflow:hidden;
  background:radial-gradient(100% 80% at 50% 0%,rgba(0,87,255,.4),rgba(0,87,255,0) 62%),var(--navy)}
.close__in{position:relative;z-index:2;height:100%;flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:0 var(--pad)}
.close__t{font-size:54px;font-weight:800;letter-spacing:5px;margin-top:26px}
.close__rule{width:56px;height:3px;background:var(--blue);border-radius:2px;margin:24px 0}
.close__x{font-size:13px;color:#B7C6E8;max-width:44ch;line-height:1.7}
.close__c{margin-top:26px;display:flex;gap:26px;font-size:11px;color:#fff;font-weight:500}
.close__f{position:absolute;left:var(--pad);right:var(--pad);bottom:12mm;z-index:2;
  padding-top:12px;border-top:1px solid rgba(255,255,255,.14);
  display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.5);letter-spacing:.6px}

/* ============================================================
   Screen affordances / print
   ============================================================ */
@media print{
  body{background:#fff}
  .sheet{margin:0;box-shadow:none;border-radius:0}
}

@media screen {
  body { padding: 12px 0 40px; }
}
`;
