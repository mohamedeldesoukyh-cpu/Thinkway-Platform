/** Screen-only document reflow. PDF and print geometry remain unchanged. */
export const MOBILE_DOCUMENT_STYLES = `
@media screen and (max-width: 767px){
  html,body{max-width:100%;margin:0;overflow-wrap:anywhere}
  body,body.quotation-export-preview{padding:0;background:#fff}
  .paper{width:100%;max-width:100%;margin:0;box-shadow:none;border-radius:0}
  .hero{padding:24px 16px}
  .htype h1{font-size:26px}
  .qsec,.section,.qfoot{padding:20px 16px}
  .qgrid2,.approve-grid,.sig-grid{grid-template-columns:minmax(0,1fr)}
  .qf{flex-wrap:wrap;gap:6px 12px}
  .qf .v{max-width:100%!important;overflow-wrap:anywhere}
  .qgrand{gap:12px;flex-wrap:wrap}
  .qgrand .gv{font-size:23px}
  .qtotals,.qtbox{width:100%;max-width:100%}
  .qtable{display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .qtable th,.qtable td{min-width:90px}
  .cpage,.cover,.page{width:100%;height:auto;max-height:none;min-height:0}
  .cwrap,.pad{padding:24px 16px;height:auto;max-height:none;overflow:visible!important;zoom:1!important}
  .foot{position:relative;left:auto;right:auto;bottom:auto;margin:16px;gap:12px;flex-wrap:wrap}
  .cbar,.page-head{flex-wrap:wrap;gap:12px}
  .chip{white-space:normal}
  .cover h1,.cpage.grad h1,.sc-title{font-size:28px}
  .metagrid,.statrow,.statrow.statrow--3,.statrow.statrow--4,.comm-top,.totals,.accept-grid,.cat-bars,.collap-creator-grid{grid-template-columns:minmax(0,1fr)}
  .statrow{margin-top:20px;padding-bottom:0}
  .sc-metric-grid,.sc-stats,.pubs{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .fees{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .fees table{min-width:620px}
  .sc-top{flex-wrap:wrap}
  .terms-grid{columns:1}
  .term p,.term h4,.full-term p,.terms-list li,.qcard p,.qack p,.approve-item p{font-size:14px;line-height:1.6}
  .page-head{flex-direction:column}
  .page-head .logo{order:-1}
  .company{flex-direction:column;align-items:flex-start;gap:16px}
  .company .addr{text-align:left}
  .logo{flex-shrink:0}
  .logo .wm{white-space:nowrap}
}
`;

export function applyMobileDocumentLayout(html: string): string {
  if (html.includes('data-mobile-document="1"')) return html;
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html) ? "" : '<meta name="viewport" content="width=device-width, initial-scale=1">';
  return html.replace(/<\/head>/i, `${viewport}<style data-mobile-document="1">${MOBILE_DOCUMENT_STYLES}</style></head>`);
}
