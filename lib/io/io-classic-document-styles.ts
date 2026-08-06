/**
 * Thinkway on-brand CIO / VIO document chrome — exact match for
 * quotation-thinkway.html (blue radial hero · soft cards · gradient total).
 */
export const IO_CLASSIC_DOCUMENT_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --q-bg:#fff;--q-ink:#0d1836;--q-muted:#7c88a4;--q-line:#eef1f9;--q-accent:#0057ff;--q-accent-soft:#eef3ff;
  --q-card:#f6f8ff;--q-cardbd:#e6ecfb;--q-grandbg:linear-gradient(120deg,#0057ff,#3f7bff);--q-grandink:#fff;
}
body{
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#eceef3;color:var(--q-ink);
  -webkit-font-smoothing:antialiased;padding:30px 16px;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.tabular{font-variant-numeric:tabular-nums}
.paper{
  width:880px;max-width:100%;margin:0 auto;background:var(--q-bg);
  box-shadow:0 3px 10px rgba(16,24,40,.08),0 24px 60px -20px rgba(16,24,40,.28);
  border-radius:8px;overflow:visible;
}
.doc{background:var(--q-bg);color:var(--q-ink)}

/* hero — Thinkway brand */
.hero{
  background:radial-gradient(120% 160% at 100% 0%,#3f7bff 0%,#0057ff 42%,#003bd0 100%);
  color:#fff;padding:40px 52px 34px;position:relative;overflow:hidden;
}
.hero::before{content:"";position:absolute;right:-60px;top:-70px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.10)}
.hero::after{content:"";position:absolute;right:70px;bottom:-120px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}
.mkw{display:flex;align-items:center;gap:11px;font-weight:800;font-size:19px;position:relative}
.mk{width:34px;height:34px;border-radius:10px;background:#fff;position:relative;flex-shrink:0}
.mk::before{content:"";position:absolute;left:8px;top:8px;width:7px;height:7px;border-radius:50%;background:#0d1836}
.mk::after{content:"";position:absolute;right:8px;bottom:8px;width:9px;height:9px;border-radius:50%;background:#0057ff}
.logo-text{font-size:19px;font-weight:800;color:#fff;letter-spacing:-0.02em}
.logo-text span{color:#fff}
.htype{position:relative;margin-top:26px}
.htype .lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#cbdcff}
.htype h1{font-size:30px;font-weight:800;letter-spacing:-.03em;margin-top:5px;color:#fff;line-height:1.15}
.hpills{display:flex;gap:9px;margin-top:16px;flex-wrap:wrap;position:relative}
.hp{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.26);border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600}

/* body system */
.qsec,.section{padding:24px 52px;border-top:1px solid var(--q-line);break-inside:auto;page-break-inside:auto}
.qh{display:flex;align-items:center;gap:11px;margin-bottom:16px}
.qnum{
  width:24px;height:24px;border-radius:7px;background:var(--q-accent-soft);color:var(--q-accent);
  font-size:12px;font-weight:800;display:grid;place-items:center;flex-shrink:0;
}
.qh h3,.section-title{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--q-ink)}
.qgrid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.qcard{background:var(--q-card);border:1px solid var(--q-cardbd);border-radius:13px;padding:15px 17px}
.qcard .ct{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--q-muted);margin-bottom:8px}
.qcard p{font-size:12.5px;line-height:1.6;color:var(--q-ink)}
.qf{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:12.5px}
.qf .k{color:var(--q-muted);flex-shrink:0}
.qf .v{font-weight:600;text-align:right;color:var(--q-ink);min-width:0;overflow-wrap:anywhere}
.qtable,.deliv-table{width:100%;border-collapse:collapse}
.qtable th,.deliv-table th{
  font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--q-muted);
  text-align:left;padding:11px 12px;border-bottom:2px solid var(--q-cardbd);
}
.qtable th.r,.deliv-table th.r{text-align:right}
.qtable td,.deliv-table td{padding:12px;border-bottom:1px solid var(--q-line);font-size:12.5px;color:var(--q-ink)}
.qtable td.r,.deliv-table td.r{text-align:right}
.qtable .hh{font-weight:700}
.deliv-table thead{display:table-header-group}
.dlv-item{padding:13px 0;border-bottom:1px solid var(--q-line)}
.dlv-item:last-child{border-bottom:0}
.dlv-item h4{font-size:13px;font-weight:700;display:flex;justify-content:space-between;gap:14px;margin-bottom:7px;color:var(--q-ink)}
.dlv-item h4 span{font-weight:500;color:var(--q-muted);font-size:11.5px;white-space:nowrap}
.dlv-item ul{list-style:none}
.dlv-item li{
  position:relative;padding-left:16px;font-size:12px;color:var(--q-muted);line-height:1.55;margin-top:3px;
  white-space:pre-wrap;overflow-wrap:anywhere;
}
.dlv-item li::before{content:"";position:absolute;left:2px;top:6px;width:5px;height:5px;border-radius:50%;background:var(--q-accent)}
.fee-block{padding:12px 0;border-bottom:1px solid var(--q-line);break-inside:avoid;page-break-inside:avoid}
.fee-block .fhead{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:13px;gap:12px;color:var(--q-ink)}
.fee-block .fref{font-size:11px;color:var(--q-muted);font-weight:500}
.fee-line{display:flex;justify-content:space-between;font-size:12px;color:var(--q-muted);padding:4px 0 0;gap:12px}
.fee-line b{color:var(--q-ink);font-weight:600}
.qtotals{display:flex;justify-content:flex-end;margin-top:18px;break-inside:avoid;page-break-inside:avoid}
.qtbox{width:350px;max-width:100%;break-inside:avoid;page-break-inside:avoid}
.qtrow{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:var(--q-muted);border-bottom:1px solid var(--q-line)}
.qtrow b{color:var(--q-ink);font-weight:600}
.qgrand{
  display:flex;justify-content:space-between;align-items:center;
  background:var(--q-grandbg);color:var(--q-grandink);border-radius:14px;padding:18px 20px;margin-top:12px;
  box-shadow:0 14px 30px -12px rgba(0,87,255,.55);
  break-inside:avoid;page-break-inside:avoid;
}
.qgrand .gk{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.9}
.qgrand .gv{font-size:26px;font-weight:800;letter-spacing:-.02em}
.approve-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 34px}
.approve-item .ah{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--q-accent);margin-bottom:5px}
.approve-item p{font-size:12px;color:var(--q-muted);line-height:1.55}
.qack{background:var(--q-card);border:1px dashed #9bbcff;border-radius:14px;padding:17px 19px}
.qack .badge{
  display:inline-block;background:var(--q-accent);color:#fff;font-size:10px;font-weight:800;
  letter-spacing:.07em;padding:4px 11px;border-radius:999px;margin-bottom:10px;
}
.qack p{font-size:12.5px;line-height:1.65;color:var(--q-ink)}
.full-term{padding:11px 0;border-bottom:1px solid var(--q-line);display:flex;gap:14px;break-inside:avoid;page-break-inside:avoid}
.full-term:last-child{border-bottom:0}
.full-term .ftn{font-weight:800;color:var(--q-accent);width:20px;flex-shrink:0;font-size:13px}
.full-term .ftt{font-weight:700;font-size:12.5px;color:var(--q-ink)}
.full-term p{font-size:12px;color:var(--q-muted);line-height:1.55;margin-top:2px}
.terms-list{list-style:none}
.terms-list li{padding:11px 0;border-bottom:1px solid var(--q-line);font-size:12px;color:var(--q-muted);line-height:1.55}
.terms-list li:last-child{border-bottom:0}
.terms-list .tnum{display:inline-block;font-weight:800;color:var(--q-accent);min-width:18px;margin-right:8px;font-size:13px;vertical-align:top}
.terms-list strong{font-weight:700;color:var(--q-ink);font-size:12.5px}
.qfoot{padding:24px 52px;text-align:center;font-size:10px;letter-spacing:.04em;color:var(--q-muted);border-top:1px solid var(--q-line)}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:8px}
.sig-box{background:var(--q-card);border:1px solid var(--q-cardbd);border-radius:13px;padding:16px}
.sig-box .slabel{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--q-muted);margin-bottom:10px}
.sig-box .srow{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px}
.sig-box .sk{color:var(--q-muted)}.sig-box .sv{font-weight:600;color:var(--q-ink);text-align:right}
.muted{color:var(--q-muted)}
.platform{font-weight:700}

@page{size:A4;margin:14mm}
@media print{
  body{background:#fff;padding:0}
  .paper{width:100%;box-shadow:none;border-radius:0;overflow:visible}
  .qsec,.section{break-inside:auto;page-break-inside:auto}
  .full-term,.dlv-item,.fee-block,.qgrand,.qtbox,.qtotals,.hero{break-inside:avoid;page-break-inside:avoid}
}
`.trim();
