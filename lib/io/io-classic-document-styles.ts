/**
 * Classic CIO / VIO document chrome — matches quotation-concepts Classic direction.
 * Shared by Client IO and Vendor IO HTML/PDF/preview renders.
 */
export const IO_CLASSIC_DOCUMENT_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#eceef3;color:#161c2b;
  -webkit-font-smoothing:antialiased;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.tabular{font-variant-numeric:tabular-nums}
.stage{display:flex;justify-content:center;padding:30px 16px}
.paper{
  width:880px;max-width:100%;background:#fff;
  box-shadow:0 3px 10px rgba(16,24,40,.08),0 24px 60px -20px rgba(16,24,40,.28);
  border-radius:6px;
  /* overflow:hidden breaks Chromium print fragmentation (text from totals overlays later pages) */
  overflow:visible;
}
.doc{background:#fff;color:#161c2b;font-family:'Inter',sans-serif}
.qsec,.section{padding:24px 52px;border-top:1px solid #eef0f5;break-inside:auto;page-break-inside:auto}
.qh{display:flex;align-items:center;gap:11px;margin-bottom:16px}
.qnum{
  width:24px;height:24px;border-radius:7px;background:#eef3ff;color:#0057ff;
  font-size:12px;font-weight:800;display:grid;place-items:center;flex-shrink:0;
}
.qh h3,.section-title{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#161c2b}
.qgrid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.qcard{background:#f7f9fc;border:1px solid #eceff5;border-radius:13px;padding:15px 17px}
.qcard .ct{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7a8296;margin-bottom:8px}
.qcard p{font-size:12.5px;color:#161c2b;line-height:1.6}
.qf{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:12.5px}
.qf .k{color:#7a8296;flex-shrink:0}
.qf .v{color:#161c2b;font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}
.qtable,.deliv-table{width:100%;border-collapse:collapse}
.qtable th,.deliv-table th{
  font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a8296;
  text-align:left;padding:10px 12px;border-bottom:1px solid #eceff5;
}
.qtable th.r,.deliv-table th.r{text-align:right}
.qtable td,.deliv-table td{padding:12px;border-bottom:1px solid #eef0f5;font-size:12.5px;color:#161c2b}
.qtable td.r,.deliv-table td.r{text-align:right}
.qtable .hh{font-weight:700}
.deliv-table thead{display:table-header-group}
.dlv-item{padding:13px 0;border-bottom:1px solid #eef0f5}
.dlv-item:last-child{border-bottom:0}
.dlv-item h4{font-size:13px;font-weight:700;color:#161c2b;display:flex;justify-content:space-between;gap:14px;margin-bottom:7px}
.dlv-item h4 span{font-weight:500;color:#7a8296;font-size:11.5px;white-space:nowrap}
.dlv-item ul{list-style:none}
.dlv-item li{position:relative;padding-left:16px;font-size:12px;color:#7a8296;line-height:1.55;margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere}
.dlv-item li::before{content:"";position:absolute;left:2px;top:6px;width:5px;height:5px;border-radius:50%;background:#0057ff}
.fee-block{padding:12px 0;border-bottom:1px solid #eef0f5}
.fee-block .fhead{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;color:#161c2b;font-size:13px;gap:12px}
.fee-block .fref{font-size:11px;color:#7a8296;font-weight:500}
.fee-line{display:flex;justify-content:space-between;font-size:12px;color:#7a8296;padding:4px 0 0;gap:12px}
.fee-line b{color:#161c2b;font-weight:600}
.qtotals{
  display:block;margin-top:18px;text-align:right;
  break-inside:avoid;page-break-inside:avoid;
}
.qtbox{display:inline-block;width:350px;max-width:100%;text-align:left;break-inside:avoid;page-break-inside:avoid}
.qtrow{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#7a8296;border-bottom:1px solid #eef0f5}
.qtrow b{color:#161c2b;font-weight:600}
.qgrand{
  display:flex;justify-content:space-between;align-items:center;
  background:#0c1424;color:#fff;border-radius:12px;padding:16px 18px;margin-top:12px;
  break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid;
  position:relative;z-index:0;
}
.qgrand .gk{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.88}
.qgrand .gv{font-size:23px;font-weight:800;letter-spacing:-.02em}
.approve-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 34px}
.approve-item .ah{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0057ff;margin-bottom:5px}
.approve-item p{font-size:12px;color:#7a8296;line-height:1.55}
.qack{background:#f7f9fc;border:1px solid #eceff5;border-radius:12px;padding:17px 19px}
.qack .badge{
  display:inline-block;background:#0057ff;color:#fff;font-size:10px;font-weight:800;
  letter-spacing:.07em;padding:4px 11px;border-radius:999px;margin-bottom:10px;
}
.qack p{font-size:12.5px;color:#161c2b;line-height:1.65}
.terms-list{list-style:none}
.terms-list li,.full-term{
  padding:11px 0;border-bottom:1px solid #eef0f5;
  font-size:12px;color:#7a8296;line-height:1.55;
}
.terms-list li:last-child,.full-term:last-child{border-bottom:0}
.terms-list .tnum,.full-term .ftn{
  display:inline-block;font-weight:800;color:#0057ff;
  min-width:18px;margin-right:8px;font-size:13px;vertical-align:top;
}
.terms-list strong,.full-term .ftt{font-weight:700;color:#161c2b;font-size:12.5px}
.qfoot{padding:22px 52px;text-align:center;font-size:10px;letter-spacing:.04em;color:#7a8296;border-top:1px solid #eef0f5}
.hero-c{background:linear-gradient(120deg,#0c1424,#111c33);color:#fff;padding:34px 52px;position:relative}
.hero-c::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#0057ff,#4b8bff)}
.hero-c .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.mkw{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px}
.mk{width:30px;height:30px;border-radius:9px;background:#fff;position:relative;flex-shrink:0}
.mk::before{content:"";position:absolute;left:7px;top:7px;width:6px;height:6px;border-radius:50%;background:#0c1424}
.mk::after{content:"";position:absolute;right:7px;bottom:7px;width:8px;height:8px;border-radius:50%;background:#0057ff}
.logo-text{font-size:17px;font-weight:800;color:#fff;letter-spacing:-0.02em}
.logo-text span{color:#0057ff}
.hero-c .subttl{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#8fa1c4;margin-top:13px}
.hero-c .doctype{font-size:13px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;text-align:right}
.hero-c .ciopill{
  display:inline-block;margin-top:10px;background:#0057ff;color:#fff;
  font-size:12px;font-weight:700;letter-spacing:.05em;padding:5px 13px;border-radius:999px;
}
.hero-c .issue{font-size:11px;color:#9fb0d0;text-align:right;margin-top:8px}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:8px}
.sig-box{background:#f7f9fc;border:1px solid #eceff5;border-radius:13px;padding:16px}
.sig-box .slabel{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7a8296;margin-bottom:10px}
.sig-box .srow{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px}
.sig-box .sk{color:#7a8296}.sig-box .sv{font-weight:600;color:#161c2b;text-align:right}
.terms-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pill{
  display:inline-flex;align-items:center;gap:6px;background:#eef3ff;color:#0057ff;
  font-size:11px;font-weight:700;padding:6px 12px;border-radius:999px;max-width:100%;
  overflow-wrap:anywhere;
}
.pill .dot{width:6px;height:6px;border-radius:50%;background:#0057ff;flex-shrink:0}
.muted{color:#7a8296}
.platform{font-weight:700}
@page{size:A4;margin:12mm 10mm}
@media print{
  body{background:#fff}
  .stage{padding:0}
  .paper{box-shadow:none;border-radius:0;width:100%;overflow:visible}
  .qsec,.section{break-inside:auto;page-break-inside:auto}
  .qtotals,.qtbox,.qgrand,.fee-block,.hero-c{break-inside:avoid;page-break-inside:avoid}
}
`.trim();
