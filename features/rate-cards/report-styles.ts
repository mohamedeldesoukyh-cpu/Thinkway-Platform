import type {Language} from "./labels";

export const RATE_A4_HEIGHT = 1600 * 210 / 297;

export const RATE_CARD_LOGO_CSS = `
.cov__client:has(.cover-client-logo){display:flex;align-items:center;justify-content:space-between;gap:64px;direction:ltr}
.cov__client>.cover-client-logo{display:block;flex:0 0 360px;width:360px;height:360px;max-width:360px;max-height:none;margin:0 36px 0 0;object-fit:contain;filter:url(#report-logo-white-key);background:transparent;padding:0;border:0;border-radius:0}
.ph .report-client-logo{filter:url(#report-logo-white-key);background:transparent;padding:0;border-radius:0}
.page--cov:has(.cover-client-logo) .cov{max-width:none}
@media screen and (max-width:900px){.cov__client:has(.cover-client-logo){gap:20px}.cov__client>.cover-client-logo{flex-basis:26%;width:26%;height:auto;margin:0}.page--cov:has(.cover-client-logo) .cov__client h1{font-size:clamp(24px,5vw,46px);letter-spacing:-1px}}
`;

export function rateReportStyles(details: boolean, lang: Language, priceColumns: number) {
  return `
  @page{size:297mm 210mm;margin:0}
  ${RATE_CARD_LOGO_CSS}
  .cov__client h1{font-size:76px;line-height:1.05;max-width:20ch;overflow-wrap:anywhere}
  .cov__strip{max-width:100%;flex-wrap:wrap}
  .rate-cover-fees{display:grid;gap:6px;margin-top:24px;padding:16px 20px;width:fit-content;max-width:100%;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(37,34,95,.82);font-size:20px;color:#fff}
  .rate-cover-fees strong{font-size:14px;color:#c4c1d6}.rate-cover-fees small{font-size:12px;color:#c4c1d6}
  .page{height:${RATE_A4_HEIGHT}px}
  .cards{grid-template-columns:repeat(4,minmax(0,1fr));min-height:${RATE_A4_HEIGHT-155}px;align-items:stretch;gap:18px;padding:14px}
  .creator-card{height:100%;position:relative;padding:10px;break-inside:avoid}
  .creator-card>*{flex-shrink:0}
  .portrait{height:190px;aspect-ratio:auto}
  .portrait>img{object-fit:cover;object-position:center 30%}
  .creator-avatar{width:24px;height:24px;flex-basis:24px;font-size:12px}
  .creator-label h2{max-height:none;overflow-wrap:anywhere;font-size:16px;line-height:20px;text-align:start}
  .creator-label p{text-align:start;white-space:normal;overflow-wrap:anywhere}
  .creator-categories{margin-top:auto;padding-top:8px}
  .rate-card-cover-link{position:absolute;inset:0;z-index:1}
  .rate-prices nav{position:relative;z-index:2;margin-top:6px;font-size:12px;color:#6551ad}
  .rate-prices{margin-top:6px;font-size:12px;direction:${lang==="ar"?"rtl":"ltr"}}
  .rate-prices p{white-space:normal;text-align:start}
  .rate-price-grid{display:grid;grid-template-columns:repeat(${priceColumns},minmax(0,1fr));gap:4px 12px}
  .price{display:grid;gap:2px;border-top:1px solid #e5e3ee;padding-top:5px;margin-top:4px;overflow-wrap:anywhere}
  .price strong{font-size:16px}.price small{font-size:11px;line-height:1.4;color:#666477}
  .rate-list-heading{font-size:15px;line-height:1.4;font-weight:700;color:#080642;border-top:1px solid #d4d0e5;padding-top:6px;margin:6px 0 4px;text-align:start}
  .rate-list-heading-prices,.package-price-label{color:#bf146f}
  .rate-platform-icon{display:inline-block;width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-inline-end:5px;border:0;border-radius:0;background:transparent;box-shadow:none}
  .rate-platform-summary{border-top:1px solid #e5e3ee;padding-top:4px;margin-top:4px}
  .rate-platform-summary small{display:block;margin-top:2px;font-size:11px;line-height:1.4;color:#666477}
  .rate-platform-summary b{color:#080642}
  .travel-uplifts{grid-column:1/-1;border-top:1px solid #e5e3ee;margin-top:5px;padding-top:5px;font-size:11px}
  .travel-uplift{margin-top:3px}.travel-uplift small{display:block}
  .rate-detail-row{display:grid;grid-template-columns:210px minmax(0,1fr);gap:16px;direction:ltr;align-items:stretch;break-inside:avoid}
  .rate-detail-row .creator-card,.rate-performance{direction:${lang==="ar"?"rtl":"ltr"}}
  .rate-detail-row .portrait{height:115px}
  .rate-performance{padding:14px;background:#fff;border-radius:13px;color:#080642;height:auto}
  .rate-performance h2{height:auto;text-align:start;font-size:18px;margin:0 0 6px}
  .rate-performance p{text-align:start;white-space:normal;font-family:inherit;font-size:11px;margin-bottom:8px}
  .rate-performance section{border-top:1px solid #e5e3ee;padding:6px 0}
  .rate-performance h3{margin:0 0 5px;font-size:13px;color:#6551ad}
  .rate-performance dl{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0}
  .rate-performance dt{font-size:11px;color:#666477}.rate-performance dd{font-size:15px;font-weight:700;margin:2px 0}
  .rate-performance .rate-detail-prices{border-top:0;padding-top:0;margin-bottom:8px}
  .rate-detail-prices h2{color:#bf146f}.rate-detail-prices .price>span{font-size:11px}
  .rate-closing-note{margin-top:24px;color:#c4c1d6;font-size:18px}.end__hd p{white-space:normal}
  .page footer span:last-child{direction:ltr}html[dir=rtl] .creator-identity{direction:rtl}
  ${details?'.cards{grid-template-columns:1fr;gap:16px}':''}
  @media print{.page{zoom:${297 / 25.4 * 96 / 1600}}}
  @media screen and (min-width:901px) and (max-width:1599px){.page{zoom:calc((100vw - 16px) / 1600px)}}
  @media screen and (max-width:900px){.page{height:auto}.cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0}.portrait{height:190px;aspect-ratio:auto}.rate-detail-row{grid-template-columns:1fr}.rate-performance .rate-price-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rate-performance dl{grid-template-columns:repeat(2,minmax(0,1fr))}${details?'.cards{grid-template-columns:1fr}':''}}
  @media screen and (max-width:520px){.cards{grid-template-columns:1fr}}
  `;
}
