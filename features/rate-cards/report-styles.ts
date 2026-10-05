import type {Language} from "./labels";

export const RATE_A4_HEIGHT = 1600 * 210 / 297;

export function rateReportStyles(details: boolean, lang: Language, priceColumns: number, fullSizeImages = false) {
  return `
  @page{size:297mm 210mm;margin:0}
  .page{height:${RATE_A4_HEIGHT}px}
  .cards{grid-template-columns:repeat(3,minmax(0,1fr));min-height:0;align-items:start;gap:18px;padding:14px}
  .creator-card{height:auto;position:relative;padding:10px;break-inside:avoid}
  .creator-card>*{flex-shrink:0}
  .portrait{height:${fullSizeImages?180:120}px;aspect-ratio:auto}
  .portrait>img{object-fit:contain}
  .creator-avatar{width:${fullSizeImages?32:24}px;height:${fullSizeImages?32:24}px;flex-basis:${fullSizeImages?32:24}px;font-size:${fullSizeImages?16:12}px}
  .creator-label h2{max-height:none;overflow-wrap:anywhere;font-size:16px;line-height:20px;text-align:start}
  .creator-label p{text-align:start;white-space:normal;overflow-wrap:anywhere}
  .creator-categories{margin-top:6px}
  .rate-card-cover-link{position:absolute;inset:0;z-index:1}
  .rate-prices nav{position:relative;z-index:2;margin-top:6px;font-size:12px;color:#6551ad}
  .rate-prices{margin-top:${fullSizeImages?8:6}px;font-size:12px;direction:${lang==="ar"?"rtl":"ltr"}}
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
  .rate-detail-row{display:grid;grid-template-columns:210px minmax(0,1fr);gap:16px;direction:ltr;align-items:start;break-inside:avoid}
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
  @media screen and (max-width:900px){.page{height:auto}.cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0}.portrait{height:${fullSizeImages?280:120}px;aspect-ratio:auto}.rate-detail-row{grid-template-columns:1fr}.rate-performance .rate-price-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rate-performance dl{grid-template-columns:repeat(2,minmax(0,1fr))}${details?'.cards{grid-template-columns:1fr}':''}}
  @media screen and (max-width:520px){.cards{grid-template-columns:1fr}}
  `;
}
