/** Brand styles from `quotation-template.html` (landscape A4) + avatar extensions. */
export const QUOTATION_TEMPLATE_STYLES = `
  :root{
    --blue:#0057FF; --blue400:#1A6FFF; --blue300:#3D8BFF;
    --navy:#060810; --ink:#0B0F1A; --muted:#6B7280; --lav:#E8EFFE;
    --lav-line:#d5e2fb; --white:#FFFFFF; --hair:#e7ecf5;
    --grad:linear-gradient(145deg,#0040CC 0%,#0057FF 45%,#1A6FFF 78%,#0048DD 100%);
    --tw-green:#1D9E75;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{background:#c9d4e8; color:var(--ink); font-family:"Geist","Inter","Segoe UI",Arial,sans-serif; -webkit-font-smoothing:antialiased;}
  body.quotation-export-preview{background:#c9d4e8;}
  body.quotation-export-print{background:#fff;}
  body.quotation-export-print .page{
    width:297mm;
    min-height:auto;
    height:auto;
    max-height:none;
    margin:0;
    box-shadow:none;
    overflow:visible;
    page-break-after:auto;
    break-after:auto;
  }
  body.quotation-export-print .page.cover{
    height:210mm;
    min-height:210mm;
    max-height:210mm;
    overflow:hidden;
    page-break-after:always;
    break-after:page;
    page-break-inside:avoid;
    break-inside:avoid;
  }
  body.quotation-export-print .page.cover .pad{padding:44px 52px;}
  body.quotation-export-print .page.cover h1{font-size:40px; margin:12px 0 10px;}
  body.quotation-export-print .page.cover .statrow{margin-top:24px;}
  body.quotation-export-print .page.summary-overview-page,
  body.quotation-export-print .page.collapse-content-page,
  body.quotation-export-print .page.commercial-page,
  body.quotation-export-print #section-terms,
  body.quotation-export-print #section-acceptance{
    page-break-before:always;
    break-before:page;
  }
  body.quotation-export-print .page.collapse-content-page:not(.showcase-slide),
  body.quotation-export-print .page.summary-overview-page{
    min-height:auto;
    height:auto;
  }
  body.quotation-export-print .collap-package-card{
    break-inside:auto;
    page-break-inside:auto;
  }
  body.quotation-export-print .tier{
    break-inside:auto;
    page-break-inside:auto;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide{
    width:297mm;
    height:210mm;
    min-height:210mm;
    max-height:210mm;
    overflow:hidden;
    page-break-after:always;
    break-after:page;
    page-break-inside:avoid;
    break-inside:avoid;
    display:flex;
    flex-direction:column;
  }
  body.quotation-export-print.quotation-showcase .page.summary-overview-page + .showcase-slide,
  body.quotation-export-print.quotation-showcase .showcase-slide + .showcase-slide,
  body.quotation-export-print.quotation-showcase .showcase-slide + .page.roster-page{
    page-break-before:always;
    break-before:page;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .pad{
    flex:1;
    min-height:0;
    overflow:hidden;
    padding:36px 48px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-pubs-grid{
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:10px;
    margin-bottom:14px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-pub-card{
    aspect-ratio:unset;
    height:118px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .collap-mix-feed-grid{
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:8px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .collap-mix-feed-grid .showcase-pub-card{
    height:72px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-deliverables-table table{
    table-layout:fixed;
    width:100%;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-deliverables-table tbody td{
    word-wrap:break-word;
    vertical-align:top;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-deliverables-table--dense tbody td{
    padding:4px 10px;
    font-size:10px;
    line-height:1.2;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-deliverables-table--dense thead th{
    padding:6px 10px;
    font-size:8.5px;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .foot{
    flex-shrink:0;
    margin-top:auto;
  }
  body.quotation-export-print.quotation-showcase .showcase-slide .fees,
  body.quotation-export-print.quotation-showcase .showcase-slide .fees table,
  body.quotation-export-print.quotation-showcase .showcase-slide .fees tbody tr,
  body.quotation-export-print.quotation-showcase .showcase-slide .collap-package-card,
  body.quotation-export-print.quotation-showcase .showcase-slide .sc-top,
  body.quotation-export-print.quotation-showcase .showcase-slide .sc-stats,
  body.quotation-export-print.quotation-showcase .showcase-slide .showcase-pubs-grid{
    break-inside:avoid;
    page-break-inside:avoid;
  }
  body.quotation-export-print .commercial-fee-table thead{display:table-header-group;}
  body.quotation-export-print .commercial-fee-table tr{
    break-inside:avoid;
    page-break-inside:avoid;
  }
  body.quotation-export-print .page.commercial-page .fees{
    break-inside:auto;
    page-break-inside:auto;
  }
  body.quotation-export-print .page.commercial-page .totals{
    break-inside:avoid;
    page-break-inside:avoid;
  }
  body.quotation-showcase .showcase-pubs-grid{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:12px;
    margin-bottom:22px;
  }
  body.quotation-showcase .showcase-pub-card{
    aspect-ratio:1/1;
    border-radius:12px;
    background:#f2f5fc;
    border:1px solid var(--hair);
    overflow:hidden;
    position:relative;
  }
  body.quotation-showcase .showcase-pub-card a{
    display:block;
    width:100%;
    height:100%;
  }
  body.quotation-showcase .showcase-pub-thumb{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
  body.quotation-showcase .collap-mix-feed-grid{
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:10px;
  }
  body.quotation-export-preview.quotation-showcase .page.showcase-creator-page{
    min-height:794px;
  }
  .mono{font-family:"Geist Mono",ui-monospace,monospace;}
  .page{width:1123px; min-height:794px; margin:22px auto; background:var(--white); position:relative; overflow:hidden; box-shadow:0 3px 18px rgba(6,8,16,.16); display:flex; flex-direction:column;}
  .page.collapse-content-page{min-height:794px; height:auto; overflow:visible;}
  .avoid-break{break-inside:avoid; page-break-inside:avoid;}
  .pad{padding:44px 56px;}
  .foot{margin-top:auto; padding:14px 56px; border-top:1px solid var(--hair); display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--muted); letter-spacing:.02em;}

  .logo{display:flex; align-items:center; gap:12px;}
  .logo .mark{width:34px; height:34px; flex:none;}
  .logo .wm{font-weight:800; font-size:20px; letter-spacing:-.5px; color:var(--navy);}
  .logo .wm b{color:var(--blue); font-weight:800;}
  .logo.rev .wm{color:var(--white);} .logo.rev .wm b{color:var(--blue300);}

  .kicker{font-size:11px; font-weight:600; letter-spacing:.22em; text-transform:uppercase; color:var(--blue);}
  .sec-badge{display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background:var(--navy); color:#fff; font-size:12px; font-weight:700; font-family:"Geist Mono",monospace;}
  .sec-row{display:flex; align-items:center; gap:12px; margin-bottom:6px;}
  .sec-row .lbl{font-size:12px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--navy);}
  .sec-title{font-size:26px; font-weight:800; letter-spacing:-.8px; color:var(--navy); margin:2px 0 22px;}

  .cover{background:var(--navy); color:var(--white);}
  .cover::before{content:""; position:absolute; top:0; right:0; width:46%; height:100%; background:var(--grad); opacity:.14; clip-path:polygon(38% 0,100% 0,100% 100%,0 100%);}
  .cover .pad{padding:52px 60px; flex:1; display:flex; flex-direction:column; position:relative; z-index:1;}
  .cbar{display:flex; justify-content:space-between; align-items:center;}
  .chip{font-size:10.5px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#cdd8f5; border:1px solid rgba(205,216,245,.4); padding:6px 14px; border-radius:999px;}
  .cover .kicker{color:var(--blue300); margin-top:38px;}
  .cover h1{font-size:46px; line-height:1.06; font-weight:800; letter-spacing:-1.5px; margin:16px 0 14px; max-width:22ch;}
  .accentbar{width:66px; height:5px; background:var(--blue); border-radius:3px; margin:2px 0 20px;}
  .cover .sub{font-size:16px; color:#c4cde4; margin:0; max-width:56ch; line-height:1.5;}
  .metagrid{display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid rgba(205,216,245,.18); border-bottom:1px solid rgba(205,216,245,.18); margin:32px 0 0;}
  .metagrid .m{padding:15px 20px 15px 0;}
  .metagrid .l{font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7f8bb0; margin:0 0 6px;}
  .metagrid .v{font-size:14px; font-weight:600; color:var(--white); margin:0;}
  .statrow{display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-top:auto;}
  .stat{background:#0d1120; border:1px solid #1c2438; border-radius:14px; padding:22px 24px; position:relative; overflow:hidden;}
  .stat::after{content:""; position:absolute; left:0; top:0; width:4px; height:100%; background:var(--blue);}
  .stat .sl{font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:#7f8bb0; margin:0 0 12px;}
  .stat .sv{font-size:32px; font-weight:800; letter-spacing:-1px; color:var(--white); margin:0; line-height:1;}
  .stat .su{font-size:12px; color:#7f8bb0; margin:8px 0 0; font-family:"Geist Mono",monospace;}

  .cat-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px;}
  .cat{background:var(--lav); border:1px solid var(--lav-line); border-radius:14px; padding:20px 22px; position:relative; overflow:hidden;}
  .cat::before{content:""; position:absolute; left:0; top:0; height:100%; width:4px; background:var(--blue);}
  .cat .cn{font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--navy); margin:0;}
  .cat .cv{font-size:34px; font-weight:800; letter-spacing:-1px; color:var(--navy); margin:8px 0 2px;}
  .cat .cs{font-size:12px; color:var(--muted); margin:0; font-family:"Geist Mono",monospace;}

  table{width:100%; border-collapse:collapse;}
  .tier{margin-bottom:15px; border:1px solid var(--hair); border-radius:14px; overflow:hidden; background:#fff; break-inside:avoid; page-break-inside:avoid;}
  .tier-head{display:flex; align-items:center; gap:14px; padding:11px 18px; background:#f5f8ff; border-bottom:1px solid var(--hair);}
  .tier-tag{font-size:10.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#fff; background:var(--navy); padding:5px 12px; border-radius:6px;}
  .tier-tag.celebrity{background:var(--blue);}
  .tier-tag.mega{background:var(--blue400);}
  .tier-tag.macro{background:#2f4a8f;}
  .tier-tag.mid{background:#5b6b93;}
  .tier-tag.micro{background:#5b6b93;}
  .tier-tag.nano{background:var(--muted);}
  .tier-tag.unknown{background:var(--muted);}
  .tier-meta{font-size:11.5px; color:var(--muted);}
  .tier-meta b{color:var(--navy); font-weight:600;}
  thead.tr th{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600; text-align:left; padding:9px 18px;}
  tbody.tb td{font-size:12.5px; padding:8px 18px; border-top:1px solid #f1f4fa;}
  tbody.tb td.h{font-weight:600; color:var(--navy); border-left:3px solid var(--blue);}
  .tr th.r,.tb td.r{text-align:right;}
  .tb td.r{font-family:"Geist Mono",monospace; font-size:12px;}

  .grand{display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding:16px 24px; background:var(--navy); color:#fff; border-radius:14px;}
  .grand .gl{font-size:13px; font-weight:700; letter-spacing:.04em;}
  .grand .gm{font-size:11px; color:#8b96ba; display:flex; gap:30px; text-align:right;}
  .grand .gm b{color:#fff; font-weight:700; display:block; font-size:16px; font-family:"Geist Mono",monospace;}

  .insight{background:var(--lav); border:1px solid var(--lav-line); border-left:4px solid var(--blue); border-radius:12px; padding:16px 22px; margin-top:16px;}
  .insight p{font-size:13px; line-height:1.6; color:#3a4363; margin:0;}
  .insight b{color:var(--navy);}

  .comm-top{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px;}
  .kpi{background:var(--lav); border:1px solid var(--lav-line); border-radius:14px; padding:18px 22px;}
  .kpi .kl{font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 8px;}
  .kpi .kv{font-size:24px; font-weight:800; letter-spacing:-.6px; color:var(--navy); margin:0; font-family:"Geist Mono",monospace;}
  .kpi.invest{background:var(--navy); border-color:var(--navy);}
  .kpi.invest .kl{color:#8b96ba;} .kpi.invest .kv{color:#fff;}
  .fees table{background:#fff; border:1px solid var(--hair); border-radius:14px; overflow:hidden;}
  .fees thead th{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#fff; font-weight:600; text-align:left; padding:11px 18px; background:var(--navy);}
  .fees thead th.r{text-align:right;}
  .fees tbody td{font-size:12.5px; padding:8px 18px; border-top:1px solid #f1f4fa; vertical-align:middle;}
  .fees tbody td.name{font-weight:600; color:var(--navy);}
  .fees tbody td.r{text-align:right; font-family:"Geist Mono",monospace; font-weight:500; color:var(--navy);}
  .fees .pill{font-size:9.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:3px 9px; border-radius:5px; background:var(--lav); color:#274690;}
  .creator-name-cell{display:flex; align-items:center; gap:10px;}
  .fee-avatar{width:28px; height:28px; border-radius:8px; object-fit:cover; flex:none; display:block; background:var(--lav);}
  .fee-avatar--initials{display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:var(--tw-green); background:#E8F5F0;}
  .totals{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:16px;}
  .tot{border-radius:14px; padding:16px 22px; border:1px solid var(--hair); background:#fff;}
  .tot.final{background:var(--blue); border-color:var(--blue);}
  .tot .tl{font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 6px;}
  .tot.final .tl{color:#d6e4ff;}
  .tot .tv{font-size:20px; font-weight:800; color:var(--navy); margin:0; font-family:"Geist Mono",monospace; letter-spacing:-.4px;}
  .tot.final .tv{color:#fff;}

  .sc-top{display:flex; align-items:center; gap:18px; margin-bottom:20px;}
  .sc-avatar{width:64px; height:64px; border-radius:16px; background:var(--grad); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; flex:none; overflow:hidden;}
  .sc-avatar--img{object-fit:cover; display:block; background:#EEF4FF;}
  .sc-avatar--initials{background:linear-gradient(145deg,#178f69 0%,var(--tw-green) 100%);}
  .pitch-creator-page .sc-top{
    display:grid; grid-template-columns:140px minmax(0,1fr); gap:16px 28px; align-items:start;
    margin-bottom:18px;
  }
  .pitch-creator-page .sc-identity{min-width:0;}
  .pitch-creator-page .sc-name{font-size:26px; margin:0 0 2px;}
  .pitch-creator-page .sc-handle{font-size:13px; margin:0 0 12px;}
  .pitch-creator-page .showcase-metrics-table{margin:0 0 4px;}
  .pitch-creator-page .showcase-metrics-table table{margin:0;}
  .pitch-avatar{
    width:140px; height:140px; border-radius:50%; flex:none; overflow:hidden;
    object-fit:cover; display:block; background:#EEF4FF;
    box-shadow:0 0 0 5px #EAF1FF, 0 0 0 7px var(--blue), 0 14px 28px rgba(0,87,255,.16);
  }
  .pitch-avatar--initials{
    width:140px; height:140px; border-radius:50%; flex:none;
    display:flex; align-items:center; justify-content:center;
    font-size:42px; font-weight:800; color:#fff;
    background:linear-gradient(145deg,#178f69 0%,var(--tw-green) 100%);
    box-shadow:0 0 0 5px #EAF4FF, 0 0 0 7px var(--blue), 0 14px 28px rgba(0,87,255,.16);
  }
  .shortlist-pitch .pitch-avatar,
  .shortlist-pitch .pitch-avatar--initials{
    width:280px; height:280px; font-size:72px;
  }
  .sc-name{font-size:24px; font-weight:800; letter-spacing:-.6px; color:var(--navy); margin:0;}
  .sc-handle{font-size:13px; color:var(--muted); margin:2px 0 0; font-family:"Geist Mono",monospace;}
  .sc-profile-link{color:inherit; text-decoration:none;}
  .sc-stats{display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:22px;}
  .sc-stat{background:var(--lav); border:1px solid var(--lav-line); border-radius:12px; padding:14px 16px;}
  .sc-stat .l{font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 6px;}
  .sc-stat .v{font-size:18px; font-weight:700; color:var(--navy); margin:0; font-family:"Geist Mono",monospace;}
  .sc-sub{font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--blue); margin:0 0 10px;}
  .pubs{display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:22px;}
  .pub{aspect-ratio:1/1; border-radius:12px; background:#f2f5fc; border:1px solid var(--hair); overflow:hidden; position:relative;}
  .pub img{width:100%; height:100%; object-fit:cover; display:block;}
  .pub-play{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;}
  .pub-play-icon{width:36px; height:36px; border-radius:50%; background:rgba(15,23,42,.58); border:2px solid rgba(255,255,255,.92); display:flex; align-items:center; justify-content:center;}
  .pub-play-icon svg{width:14px; height:14px; fill:#fff; margin-left:2px;}
  .pub-empty{grid-column:1/-1; font-size:12px; color:var(--muted); padding:14px 0;}

  .terms-grid{columns:2; column-gap:44px;}
  .term{break-inside:avoid; page-break-inside:avoid; margin-bottom:16px;}
  .term h4{font-size:13px; font-weight:700; color:var(--navy); margin:0 0 5px; padding-left:12px; border-left:3px solid var(--blue);}
  .term p{font-size:12px; line-height:1.55; color:var(--muted); margin:0; padding-left:12px;}

  .accept-grid{display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:8px;}
  .sigbox{background:var(--lav); border:1px solid var(--lav-line); border-radius:14px; padding:28px 30px; min-height:236px; display:flex; flex-direction:column;}
  .sigbox h4{font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--blue); margin:0 0 26px;}
  .sigline{margin-top:auto;}
  .sigline .row{margin-bottom:22px;}
  .sigline .l{font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:16px;}
  .sigline .line{border-bottom:1px solid var(--navy); height:1px;}
  .revnote{margin-top:24px; font-size:11px; color:var(--muted); border-top:1px solid var(--hair); padding-top:14px;}
  .revnote .mono{color:var(--navy);}
  .company{margin-top:34px; padding-top:18px; border-top:1px solid var(--hair); display:flex; justify-content:space-between; align-items:flex-end;}
  .company .addr{text-align:right; font-size:11px; color:var(--muted); line-height:1.6;}

  .collap-bundle-intro{font-size:13px; line-height:1.55; color:var(--muted); margin:-8px 0 20px; max-width:72ch;}
  .collap-package-stack{display:flex; flex-direction:column; gap:18px;}
  .collap-package-card{border:1px solid var(--hair); border-radius:16px; overflow:hidden; background:#fff; break-inside:avoid; page-break-inside:avoid;}
  .collap-package-head{display:flex; justify-content:space-between; align-items:flex-start; gap:18px; padding:18px 22px; background:linear-gradient(180deg,#f8faff 0%,#f2f6ff 100%); border-bottom:1px solid var(--hair);}
  .collap-package-kicker{margin:0 0 4px; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--blue);}
  .collap-package-title{margin:0; font-size:20px; font-weight:800; letter-spacing:-.4px; color:var(--navy);}
  .collap-package-cost{text-align:right; min-width:160px;}
  .collap-package-cost-label{display:block; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:4px;}
  .collap-package-cost-value{display:block; font-size:18px; font-weight:800; color:var(--navy); font-family:"Geist Mono",monospace;}
  .collap-package-meta{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 18px; padding:16px 22px; border-bottom:1px solid #f1f4fa;}
  .collap-package-field{display:flex; flex-direction:column; gap:4px; min-width:0;}
  .collap-package-field--wide{grid-column:1/-1;}
  .collap-field-label{font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
  .collap-field-value{font-size:12.5px; line-height:1.45; color:var(--navy); font-weight:500;}
  .collap-creator-section{padding:16px 22px 20px; background:#fbfcff;}
  .collap-creator-section-title{margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
  .collap-creator-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px;}
  .collap-creator-card{border:1px solid var(--hair); border-radius:12px; padding:14px 16px; background:#fff;}
  .collap-creator-head{display:flex; align-items:flex-start; gap:12px; margin-bottom:10px;}
  .collap-creator-avatar{width:44px; height:44px; border-radius:12px; flex:none; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#fff; background:linear-gradient(145deg,#178f69 0%,var(--tw-green) 100%); overflow:hidden;}
  .collap-creator-avatar--img{object-fit:cover; display:block; background:#EEF4FF;}
  .collap-creator-avatar--initials{background:linear-gradient(145deg,#178f69 0%,var(--tw-green) 100%);}
  .collap-creator-identity{min-width:0; flex:1;}
  .collap-creator-name{margin:0; font-size:14px; font-weight:700; color:var(--navy);}
  .collap-creator-handle{margin:2px 0 0; font-size:12px; color:var(--muted); font-family:"Geist Mono",monospace;}
  .collap-creator-platforms{margin-top:6px;}
  .collap-creator-meta{display:flex; flex-wrap:wrap; gap:8px; font-size:11px; color:var(--muted);}
  .collap-tier-pill{display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; background:var(--lav); color:#274690; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;}
  .quotation-platform-icons,.collap-platform-icons,.collap-package-platform-icons{display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;}
  .collap-mix-feed-section{margin-top:18px; padding-top:18px; border-top:1px solid var(--hair);}
  .collap-mix-feed-title{margin:0 0 10px; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--blue);}
  .collap-mix-feed-grid{grid-template-columns:repeat(6,minmax(0,1fr));}
  @media (max-width:1200px){.collap-mix-feed-grid{grid-template-columns:repeat(4,minmax(0,1fr));}}
  .quotation-platform-icon{width:20px; height:20px; border-radius:50%; object-fit:cover; display:block; flex:none;}
  .quotation-platform-icon-fallback{display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#F3F4F6; color:#6B7280; font-size:9px; font-weight:700; flex:none;}
  .platform-cell{white-space:nowrap;}
  .platform-cell .quotation-platform-icons{vertical-align:middle; margin-right:6px;}
  .platform-cell-label{font-size:11px; color:var(--muted); vertical-align:middle;}
  .showcase-metrics-table{margin-bottom:18px;}
  .showcase-metrics-table table td,.showcase-metrics-table table th{padding:10px 12px;}

  @media print{
    body{background:#fff;}
    .page{margin:0; box-shadow:none; overflow:visible;}
    body.quotation-export-print .page{page-break-after:auto; break-after:auto;}
    body.quotation-export-print .page.cover{page-break-after:always; break-after:page;}
    body.quotation-export-print.quotation-showcase .showcase-slide{
      overflow:hidden;
      page-break-inside:avoid;
      break-inside:avoid;
      page-break-after:always;
      break-after:page;
    }
    body.quotation-export-print.quotation-showcase .showcase-slide .fees tbody tr{
      break-inside:avoid;
      page-break-inside:avoid;
    }
    .page:not(:last-child){page-break-after:always; break-after:page;}
    @page{size:A4 landscape; margin:0;}
  }
`;

export const QUOTATION_TEMPLATE_LOGO_SVG = `<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="94" height="94" rx="27" fill="#fff"/>
  <circle cx="40" cy="39" r="15" fill="#060810"/>
  <circle cx="64" cy="63" r="9" fill="#0057FF"/>
</svg>`;

export const QUOTATION_TEMPLATE_LOGO_SVG_DARK = `<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="94" height="94" rx="27" fill="#060810"/>
  <circle cx="40" cy="39" r="15" fill="#fff"/>
  <circle cx="64" cy="63" r="9" fill="#0057FF"/>
</svg>`;
