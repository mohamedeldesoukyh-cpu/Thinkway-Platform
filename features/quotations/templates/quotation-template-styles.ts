/**
 * Thinkway quotation deck — A4 landscape fixed pages.
 * One @page rule only (no named @page overrides — Chromium print ignores them).
 */
export const QUOTATION_TEMPLATE_STYLES = `
  :root{
    /* Thinkway quotation palette — one hierarchy, used by preview and PDF. */
    --blue:#0057ff;                 /* primary brand accent */
    --navy:#0d1836;                 /* headings, strong text, dark KPI */
    --ink:#0d1836;                  /* primary body text (same as navy) */
    --muted:#5a6780;                /* secondary text */
    --muted2:#64748b;               /* tertiary / metadata */
    --white:#ffffff;
    --surface:#f4f7fd;              /* cards, headers, pills, panels */
    --tint:#f4f7fd;
    --pill:#f4f7fd;
    --border:#e2e9f4;               /* one light blue-gray hairline */
    --line:#e2e9f4;
    --tw-green:#1D9E75;             /* semantic only (avatar fallback / status) */
    --green-surface:#E8F5F0;
    --green-deep:#178f69;
    --grad:linear-gradient(120deg,#003bd0 0%,#0057ff 100%);
    --closing:var(--grad);
    --preview-stage:#d5dce8;
    --on-dark-muted:rgba(255,255,255,.88);
    --on-dark-label:rgba(255,255,255,.88);
    --lav:#f4f7fd;                  /* alias — shared shortlist consumers */
    --lav-line:#e2e9f4;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    color:var(--ink);
    font-family:"Inter","Noto Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  body.quotation-export-preview{background:var(--preview-stage); padding:28px 0 40px;}
  body.quotation-export-print{background:var(--white);}

  /* Exactly one @page — full-bleed A4 landscape (841.92 × 594.96 pt). */
  @page{ size:297mm 210mm; margin:0; }

  /* EVERY page is a fixed full-bleed box (preview == PDF). */
  .cpage, .cover, .page{
    width:297mm;
    height:210mm;
    max-height:210mm;
    box-sizing:border-box;
    position:relative;
    overflow:hidden;
    background:var(--white);
  }
  body.quotation-export-preview .cpage,
  body.quotation-export-preview .cover,
  body.quotation-export-preview .page{
    margin:0 auto 22px;
    box-shadow:0 3px 18px rgba(13,24,54,.16);
  }
  body.quotation-export-print .cpage,
  body.quotation-export-print .cover,
  body.quotation-export-print .page{
    margin:0;
    box-shadow:none;
    page-break-after:always;
    break-after:page;
    page-break-inside:avoid;
    break-inside:avoid;
  }
  body.quotation-export-print .cpage:last-child,
  body.quotation-export-print .cover:last-child,
  body.quotation-export-print .page:last-child{
    page-break-after:auto;
    break-after:auto;
  }

  .cwrap, .pad{
    padding:14mm 16mm 18mm;
    height:100%;
    max-height:100%;
    position:relative;
    z-index:1;
    box-sizing:border-box;
  }
  .cpage:not(.cover):not(.grad) .cwrap,
  .cpage:not(.cover):not(.grad) .pad,
  .page:not(.cover):not(.grad) .pad{
    overflow:hidden;
  }
  .foot{
    position:absolute;
    left:16mm; right:16mm; bottom:9mm;
    z-index:2;
    display:flex; justify-content:space-between; align-items:center;
    font-size:10px; color:var(--muted2); letter-spacing:.01em;
    pointer-events:none;
  }
  .cpage:not(.grad):not(.cover) .foot,
  .page:not(.cover):not(.grad) .foot{
    background:var(--white);
    padding-top:4px;
  }

  /* Content-page background — soft top-right curve (reference Redesign revised). */
  .cpage:not(.grad)::before, .page:not(.cover):not(.grad)::before{
    content:""; position:absolute; z-index:0; pointer-events:none;
    top:-95mm; right:-70mm; width:210mm; height:210mm; border-radius:50%;
    background:radial-gradient(circle at 35% 40%,rgba(0,87,255,.055) 0%,rgba(0,87,255,.022) 42%,rgba(244,247,253,0) 70%);
  }
  .cpage:not(.grad)::after, .page:not(.cover):not(.grad)::after{
    content:""; position:absolute; z-index:0; pointer-events:none;
    bottom:-100mm; left:-80mm; width:180mm; height:180mm; border-radius:50%;
    background:radial-gradient(circle,rgba(0,87,255,.03) 0%,rgba(244,247,253,0) 68%);
  }

  .mono{font-family:"Inter","Noto Sans Arabic",system-ui,sans-serif; font-variant-numeric:tabular-nums;}
  .sec-tick{
    display:inline-flex; align-items:center; gap:10px;
    font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--blue);
    margin:0 0 6px;
  }
  .sec-tick::before{content:""; width:18px; height:2px; background:var(--blue); border-radius:2px;}
  .sec-title{font-size:28px; font-weight:800; letter-spacing:-.6px; color:var(--navy); margin:0 0 14px;}
  .sec-title.cont{font-size:26px;}
  .page-head{
    display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
    margin:0 0 4px;
  }
  .page-head-copy{min-width:0; flex:1;}
  .page-head .logo{flex:none; margin-top:2px;}
  .page-head .sec-title{margin-bottom:12px;}

  /* —— Cover / closing full-bleed gradient —— */
  .cover, .cpage.grad{
    background:var(--grad);
    color:var(--white);
  }
  .cpage.grad.closing{background:var(--closing);}
  .cover .glow, .cpage.grad .glow{
    position:absolute; border-radius:50%; pointer-events:none; z-index:0;
  }
  .cover .glow-a, .cpage.grad .glow-a{
    top:-40mm; right:-35mm; width:160mm; height:160mm;
    background:rgba(255,255,255,.10);
  }
  .cover .glow-b, .cpage.grad .glow-b{
    bottom:-50mm; right:10mm; width:120mm; height:120mm;
    background:rgba(255,255,255,.07);
  }
  .cover .pad, .cpage.grad .pad{ display:flex; flex-direction:column; }
  .cbar{display:flex; justify-content:space-between; align-items:center;}
  .chip{
    font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
    color:var(--white); border:1px solid rgba(255,255,255,.35); padding:6px 12px; border-radius:999px;
    background:rgba(255,255,255,.08); white-space:nowrap;
  }
  .cover .kicker, .cpage.grad .kicker{
    font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
    color:var(--on-dark-label); margin:28px 0 0;
  }
  .cover h1, .cpage.grad h1{
    font-size:36px; line-height:1.12; font-weight:800; letter-spacing:-1px;
    margin:12px 0 10px; max-width:28ch; color:var(--white);
  }
  .cover .sub, .cpage.grad .sub{
    font-size:14px; color:var(--on-dark-muted); margin:0; max-width:58ch; line-height:1.5;
  }
  .metagrid{
    display:grid; grid-template-columns:repeat(4,1fr); gap:10px 18px;
    margin:28px 0 0; padding:16px 0;
    border-top:1px solid rgba(255,255,255,.18);
    border-bottom:1px solid rgba(255,255,255,.18);
  }
  .metagrid .l{font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--on-dark-label); margin:0 0 5px;}
  .metagrid .v{font-size:13px; font-weight:600; color:var(--white); margin:0;}
  .statrow{display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:auto; padding-bottom:10mm;}
  .statrow.statrow--3{grid-template-columns:repeat(3,1fr); gap:12px;}
  .statrow.statrow--4{grid-template-columns:repeat(2,1fr); gap:12px;}
  .statrow.statrow--4 .stat{padding:14px 16px;}
  .statrow.statrow--4 .stat .sv{font-size:20px; letter-spacing:-.5px;}
  .statrow.statrow--4 .stat .sl{font-size:9px; margin-bottom:6px;}
  .stat{
    background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.18);
    border-radius:14px; padding:18px 20px;
  }
  .stat .sl{font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--on-dark-label); margin:0 0 8px;}
  .stat .sv{font-size:28px; font-weight:800; letter-spacing:-.8px; color:var(--white); margin:0; line-height:1.1;}
  .stat .su{font-size:12px; color:var(--on-dark-muted); margin:6px 0 0;}
  .cover .foot, .cpage.grad .foot{color:var(--on-dark-muted);}

  .logo{display:flex; align-items:center; gap:10px;}
  .logo .mark{width:32px; height:32px; flex:none;}
  .logo .wm{font-weight:800; font-size:18px; letter-spacing:-.4px; color:var(--navy);}
  .logo .wm b{color:var(--blue); font-weight:800;}
  .logo.rev .wm{color:var(--white);} .logo.rev .wm b{color:var(--white);}

  /* Category bars — two columns on landscape so mix tables stay on the page. */
  .cat-bars{
    display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px; margin:0 0 16px;
  }
  .cat-bar{
    display:flex; align-items:baseline; gap:12px;
    background:var(--tint); border:1px solid var(--border); border-radius:12px;
    padding:12px 18px; box-shadow:0 1px 2px rgba(13,24,54,.04);
  }
  .cat-bar .cn{
    font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
    color:var(--navy); flex:1; min-width:0;
  }
  .cat-bar b{
    font-size:22px; font-weight:800; letter-spacing:-.5px; color:var(--navy);
    font-variant-numeric:tabular-nums;
  }
  .cat-bar .cs{font-size:12px; color:var(--muted); white-space:nowrap;}

  /* Tier + mix table */
  .tier{margin-bottom:12px;}
  .tier-head{display:flex; align-items:center; gap:12px; margin:0 0 8px;}
  .tier-tag{
    display:inline-flex; align-items:center; font-size:10.5px; font-weight:800;
    letter-spacing:.08em; text-transform:uppercase; color:var(--blue);
    background:var(--pill); padding:5px 12px; border-radius:999px; white-space:nowrap;
  }
  .tier-meta{font-size:11.5px; color:var(--muted);}
  .tier-meta b{color:var(--navy); font-weight:600;}

  table.tbl{width:100%; border-collapse:collapse; table-layout:fixed;}
  table.tbl thead th{
    font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);
    font-weight:700; text-align:left; padding:8px 10px;
    background:var(--tint); border-bottom:1.5px solid var(--border);
  }
  table.tbl thead th.r, table.tbl tbody td.r{text-align:right;}
  table.tbl tbody td{
    font-size:11.5px; padding:5px 10px; color:var(--ink); vertical-align:middle;
    border-top:1px solid transparent;
  }
  table.tbl tr.lead:not(:first-child) td{border-top:1.5px solid var(--border);}
  table.tbl td.h{font-weight:700; color:var(--navy);}
  table.tbl td.fee{font-weight:800; color:var(--blue); font-variant-numeric:tabular-nums;}
  table.tbl td.r{font-variant-numeric:tabular-nums;}

  .pf{display:inline-flex; align-items:center; gap:7px; white-space:nowrap;}
  .pf .quotation-platform-icon{width:16px; height:16px;}
  .pf-label{font-size:11.5px; color:var(--ink);}

  .banner{
    display:flex; justify-content:space-between; align-items:center;
    margin-top:14px; padding:14px 20px; border-radius:14px; color:var(--white);
    background:var(--grad);
  }
  .banner .gl{font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;}
  .banner .gv{font-size:26px; font-weight:800; letter-spacing:-.6px; font-variant-numeric:tabular-nums;}

  .insight{
    background:var(--tint); border:1px solid var(--border); border-left:4px solid var(--blue);
    border-radius:12px; padding:12px 16px; margin-top:12px;
  }
  .insight p{font-size:12px; line-height:1.55; color:var(--ink); margin:0;}
  .insight b{color:var(--navy);}

  .comm-top{display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px;}
  .kpi{
    background:var(--tint); border:1px solid var(--border); border-radius:12px; padding:14px 16px;
    box-shadow:0 1px 2px rgba(13,24,54,.04);
  }
  .kpi .kl{font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 6px;}
  .kpi .kv{font-size:20px; font-weight:800; letter-spacing:-.4px; color:var(--navy); margin:0; font-variant-numeric:tabular-nums;}
  .kpi .kv.kv-er{font-size:15px; font-weight:700; line-height:1.35;}
  .kpi .camp-er-list{gap:10px 14px;}
  .kpi.invest{background:var(--navy); border-color:var(--navy);}
  .kpi.invest .kl{color:var(--on-dark-muted);} .kpi.invest .kv{color:var(--white);}

  .fees table{width:100%; border-collapse:collapse; background:var(--white); border:1px solid var(--border); border-radius:12px; overflow:hidden;}
  .fees thead th{
    font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);
    font-weight:700; text-align:left; padding:9px 12px; background:var(--tint);
    border-bottom:1.5px solid var(--border);
  }
  .fees thead th.r{text-align:right;}
  .fees tbody td{
    font-size:11.5px; padding:7px 12px; border-top:1px solid var(--line); vertical-align:top;
    white-space:normal; overflow-wrap:break-word; line-height:1.4;
  }
  .fees tbody td.name{font-weight:700; color:var(--navy);}
  .fees tbody td.r{text-align:right; font-weight:600; color:var(--blue); font-variant-numeric:tabular-nums; vertical-align:middle;}
  .fees .pill, .pill{
    font-size:9.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
    padding:3px 9px; border-radius:999px; background:var(--pill); color:var(--blue); white-space:nowrap;
  }
  .creator-name-cell{display:flex; align-items:center; gap:10px;}
  .fee-avatar{width:28px; height:28px; border-radius:999px; object-fit:cover; flex:none; display:block; background:var(--tint);}
  .fee-avatar--initials{display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:var(--tw-green); background:var(--green-surface);}
  .totals{display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:14px;}
  .showcase-invest-totals{margin-top:16px;}
  .tot{border-radius:12px; padding:14px 16px; border:1px solid var(--border); background:var(--surface);}
  .tot.final{background:var(--blue); border-color:var(--blue);}
  .tot .tl{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 6px;}
  .tot.final .tl{color:var(--on-dark-muted);}
  .tot .tv{font-size:18px; font-weight:800; color:var(--navy); margin:0; font-variant-numeric:tabular-nums;}
  .tot.final .tv{color:var(--white);}

  /* Showcase creator pages — match QT-2026-0020 Redesign revised */
  .sc-hero{margin-bottom:14px;}
  .sc-kicker{
    font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
    color:var(--blue); margin:0 0 6px;
  }
  .sc-title{
    font-size:34px; font-weight:800; letter-spacing:-.8px; color:var(--navy); margin:0 0 4px;
  }
  .sc-title-handle{
    font-size:15px; font-weight:600; color:var(--muted); margin:0 0 14px;
  }
  .sc-top{display:flex; align-items:flex-start; gap:18px; margin-bottom:16px;}
  .sc-avatar{width:88px; height:88px; border-radius:999px; background:var(--grad); color:var(--white); display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:800; flex:none; overflow:hidden; box-shadow:0 0 0 3px var(--surface), 0 0 0 5px var(--blue);}
  .sc-avatar--img{object-fit:cover; display:block; background:var(--surface);}
  .sc-avatar--initials{background:linear-gradient(145deg,var(--green-deep) 0%,var(--tw-green) 100%);}
  .pitch-creator-page .sc-top{
    display:grid; grid-template-columns:120px minmax(0,1fr); gap:14px 22px; align-items:start; margin-bottom:12px;
  }
  .pitch-creator-page .sc-title{font-size:30px;}
  .pitch-avatar{
    width:120px; height:120px; border-radius:50%; flex:none; overflow:hidden; object-fit:cover; display:block; background:var(--surface);
    box-shadow:0 0 0 4px var(--surface), 0 0 0 6px var(--blue), 0 12px 24px rgba(0,87,255,.16);
  }
  .pitch-avatar--initials{
    width:120px; height:120px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
    font-size:36px; font-weight:800; color:var(--white);
    background:linear-gradient(145deg,var(--green-deep) 0%,var(--tw-green) 100%);
    box-shadow:0 0 0 4px var(--surface), 0 0 0 6px var(--blue);
  }
  .sc-identity{min-width:0; flex:1;}
  .sc-meta-row{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 6px;}
  .sc-category{font-size:13px; font-weight:600; color:var(--muted);}
  .sc-handle{font-size:15px; font-weight:700; color:var(--navy); margin:0 0 4px;}
  .sc-platforms{display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); margin:0;}
  .sc-platforms .quotation-platform-icon{width:16px; height:16px;}
  .sc-profile-link{color:inherit; text-decoration:none;}
  .sc-metric-grid{
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:0 0 10px;
  }
  .sc-metric{
    background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 12px;
    box-shadow:0 1px 2px rgba(13,24,54,.04);
  }
  .sc-metric .ml{font-size:9.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 6px;}
  .sc-metric .ml-with-icon{display:inline-flex; align-items:center; gap:6px;}
  .sc-metric .ml-with-icon .quotation-platform-icon,
  .sc-metric .ml-with-icon .quotation-platform-icon-fallback{width:14px; height:14px;}
  .sc-metric .mv{font-size:20px; font-weight:800; letter-spacing:-.4px; color:var(--navy); margin:0; font-variant-numeric:tabular-nums;}
  .sc-metric .mv.accent{color:var(--blue);}
  .sc-metric .mv.engagement{font-size:14px; letter-spacing:-.2px; line-height:1.35;}
  .sc-er-list{display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px;}
  .sc-er-item{display:inline-flex; align-items:center; gap:5px; white-space:nowrap;}
  .sc-er-item .quotation-platform-icon,
  .sc-er-item .quotation-platform-icon-fallback{width:16px; height:16px;}
  .sc-er-pct{font-weight:800; color:var(--navy); font-variant-numeric:tabular-nums;}
  .sc-sub{font-size:10.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--blue); margin:0 0 8px;}
  .pubs, .showcase-pubs-grid{
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:0 0 12px;
    flex:1 1 auto; align-content:stretch; min-height:148px;
  }
  .pub, .showcase-pub-card{
    border-radius:12px; background:var(--tint); border:1px solid var(--border);
    overflow:hidden; position:relative; width:100%; min-height:148px; aspect-ratio:4/5;
  }
  .showcase-creator-page .showcase-pubs-grid{
    min-height:0;
  }
  .showcase-creator-page .showcase-pubs-grid .showcase-pub-card{
    min-height:148px;
  }
  .pub img, .showcase-pub-thumb{
    width:100%; height:100%; object-fit:cover; display:block;
    image-rendering:auto;
  }
  .pub-play{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;}
  .pub-play-icon{width:32px; height:32px; border-radius:50%; background:rgba(15,23,42,.58); border:2px solid rgba(255,255,255,.92); display:flex; align-items:center; justify-content:center;}
  .pub-play-icon svg{width:12px; height:12px; fill:var(--white); margin-left:2px;}
  .pub-empty{grid-column:1/-1; font-size:12px; color:var(--muted); padding:10px 0;}
  .sc-deliverable-bar{
    display:flex; align-items:center; justify-content:space-between; gap:16px;
    background:var(--tint); border:1px solid var(--border); border-radius:14px; padding:14px 18px;
    margin-top:auto; flex:none;
  }
  .sc-deliverable-bar .dl{font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin:0 0 4px;}
  .sc-deliverable-bar .dv{font-size:13px; font-weight:600; color:var(--navy); margin:0; line-height:1.4;}
  .sc-fee-pill{
    flex:none; display:inline-flex; align-items:center; justify-content:center;
    background:var(--blue); color:var(--white); font-size:15px; font-weight:800;
    padding:12px 22px; border-radius:999px; white-space:nowrap;
  }
  .showcase-creator-sheet{display:flex; flex-direction:column; min-height:0;}
  .categories-cell{
    white-space:normal; overflow-wrap:break-word;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
    line-clamp:2; overflow:hidden;
  }

  .roster-creator{display:flex; align-items:center; gap:10px;}
  .roster-avatar{width:22px; height:22px; border-radius:999px; object-fit:cover; flex:none; display:block; background:var(--tint);}
  .roster-avatar--fallback{display:inline-flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:var(--blue); background:var(--pill);}

  .terms-grid{columns:2; column-gap:36px;}
  .term{break-inside:avoid; margin-bottom:12px;}
  .term h4{font-size:12px; font-weight:700; color:var(--navy); margin:0 0 4px; padding-left:10px; border-left:3px solid var(--blue);}
  .term p{font-size:11.5px; line-height:1.5; color:var(--muted); margin:0; padding-left:10px;}

  .accept-grid{display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:8px;}
  .sigbox{background:var(--tint); border:1px solid var(--border); border-radius:12px; padding:22px 24px; min-height:200px; display:flex; flex-direction:column;}
  .sigbox h4{font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--blue); margin:0 0 20px;}
  .sigline{margin-top:auto;}
  .sigline .row{margin-bottom:18px;}
  .sigline .l{font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:12px;}
  .sigline .line{border-bottom:1px solid var(--navy); height:1px;}
  .revnote{margin-top:18px; font-size:11px; color:var(--muted); border-top:1px solid var(--line); padding-top:12px;}
  .company{margin-top:22px; padding-top:14px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:flex-end;}
  .company .addr{text-align:right; font-size:11px; color:var(--muted); line-height:1.55;}

  .collap-bundle-intro{font-size:12.5px; line-height:1.5; color:var(--muted); margin:-4px 0 14px; max-width:72ch;}
  .collap-package-stack{display:flex; flex-direction:column; gap:12px;}
  .collap-package-card{border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--surface);}
  .collap-package-head{display:flex; justify-content:space-between; gap:14px; padding:14px 16px; background:var(--tint); border-bottom:1px solid var(--border);}
  .collap-package-kicker{margin:0 0 4px; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--blue);}
  .collap-package-title{margin:0; font-size:18px; font-weight:800; color:var(--navy);}
  .collap-package-cost{text-align:right;}
  .collap-package-cost-label{display:block; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;}
  .collap-package-cost-value{display:block; font-size:16px; font-weight:800; color:var(--blue);}
  .collap-package-meta{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 14px; padding:12px 16px; border-bottom:1px solid var(--line);}
  .collap-package-field{display:flex; flex-direction:column; gap:3px; min-width:0;}
  .collap-package-field--wide{grid-column:1/-1;}
  .collap-field-label{font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
  .collap-field-value{font-size:12px; line-height:1.45; color:var(--navy); font-weight:500; white-space:pre-wrap; overflow-wrap:anywhere;}
  .collap-creator-section{padding:12px 16px 16px; background:var(--surface);}
  .collap-creator-section-title{margin:0 0 10px; font-size:10.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
  .collap-creator-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;}
  .collap-creator-card{border:1px solid var(--border); border-radius:12px; padding:12px; background:var(--white);}
  .collap-creator-head{display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;}
  .collap-creator-avatar{width:40px; height:40px; border-radius:999px; flex:none; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:var(--white); background:linear-gradient(145deg,var(--green-deep) 0%,var(--tw-green) 100%); overflow:hidden;}
  .collap-creator-avatar--img{object-fit:cover; display:block;}
  .collap-creator-name{margin:0; font-size:13px; font-weight:700; color:var(--navy);}
  .collap-creator-handle{margin:2px 0 0; font-size:11px; color:var(--muted);}
  .collap-creator-platforms{margin-top:4px;}
  .collap-creator-meta{display:flex; flex-wrap:wrap; gap:6px; font-size:10.5px; color:var(--muted);}
  .collap-tier-pill{display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; background:var(--pill); color:var(--blue); font-size:9.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;}
  .quotation-platform-icons,.collap-platform-icons{display:inline-flex; align-items:center; gap:5px; flex-wrap:wrap;}
  .quotation-platform-icon{width:18px; height:18px; border-radius:50%; object-fit:cover; display:block; flex:none;}
  .quotation-platform-icon-fallback{display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:var(--surface); color:var(--muted); font-size:8px; font-weight:700; flex:none;}
  .platform-cell{white-space:nowrap;}
  .platform-cell-label{font-size:11px; color:var(--muted); vertical-align:middle;}
  .collap-mix-feed-section{margin-top:12px; padding-top:12px; border-top:1px solid var(--line);}
  .collap-mix-feed-title{margin:0 0 8px; font-size:10.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--blue);}
  .collap-mix-feed-grid{grid-template-columns:repeat(6,minmax(0,1fr));}
  .collap-mix-feed-grid .showcase-pub-card{height:64px;}

  .closing-rule{width:48px; height:3px; background:rgba(255,255,255,.85); border-radius:2px; margin:40px 0 18px;}
  .closing h1{font-size:34px; max-width:18ch;}
  .closing .sub{font-size:14px; max-width:46ch;}
  .closing-meta{margin-top:auto; padding-bottom:8mm; display:flex; justify-content:space-between; align-items:flex-end; gap:20px;}
  .closing-meta .el{font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--on-dark-label); margin:0 0 4px;}
  .closing-meta .ev{font-size:13px; font-weight:600; color:var(--white); margin:0;}
  .closing-meta .legal{font-size:11px; color:var(--on-dark-muted); line-height:1.5; margin:10px 0 0;}

  /* Preview HTML (downloaded or iframe) must print as one canvas per sheet. */
  @media print{
    body.quotation-export-preview{
      background:var(--white); padding:0;
    }
    body.quotation-export-preview .cpage,
    body.quotation-export-preview .cover,
    body.quotation-export-preview .page{
      margin:0; box-shadow:none;
      page-break-after:always; break-after:page;
      page-break-inside:avoid; break-inside:avoid;
    }
    body.quotation-export-preview .cpage:last-child,
    body.quotation-export-preview .cover:last-child,
    body.quotation-export-preview .page:last-child{
      page-break-after:auto; break-after:auto;
    }
  }
`;

export const QUOTATION_TEMPLATE_LOGO_SVG = `<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="94" height="94" rx="27" fill="#fff"/>
  <circle cx="40" cy="39" r="15" fill="#0057FF"/>
  <circle cx="64" cy="63" r="9" fill="#003BD0"/>
</svg>`;

export const QUOTATION_TEMPLATE_LOGO_SVG_DARK = `<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="94" height="94" rx="27" fill="#0D1836"/>
  <circle cx="40" cy="39" r="15" fill="#fff"/>
  <circle cx="64" cy="63" r="9" fill="#0057FF"/>
</svg>`;
