import {RATE_CARD_LOGO_CSS} from "./report-styles";
import type {Language} from "./labels";

/** Keep the shortlist's six-column cards, portraits, typography and branding. */
export function clientListPerformanceStyles(lang:Language,height:number){
 return `
 ${RATE_CARD_LOGO_CSS}
 @page{size:1600px ${height}px;margin:0}
 .page{height:${height}px}
 .cards{align-items:stretch}
 .creator-card{height:auto;min-height:508px;position:relative}
 .creator-card>*{flex-shrink:0}
 .creator-label h2{max-height:none;overflow-wrap:anywhere;text-align:start}
 .creator-label p{white-space:normal;overflow-wrap:anywhere;text-align:start}
 .rate-card-cover-link{position:absolute;inset:0;z-index:1}
 .rate-prices{margin-top:8px;direction:${lang==="ar"?"rtl":"ltr"}}
 .rate-prices nav{position:relative;z-index:2;font-size:12px;color:#6551ad}
 .rate-list-heading{font-size:13px;font-weight:700;color:#080642;border-top:1px solid #d4d0e5;padding-top:8px;margin:0 0 5px;text-align:start}
 .rate-platform-summary{border-top:1px solid #e5e3ee;padding-top:5px;margin-top:5px;overflow-wrap:anywhere}
 .rate-platform-summary small{display:block;margin-top:3px;font-size:10px;line-height:1.5;color:#666477}
 .rate-platform-summary b{color:#080642}
 .rate-platform-icon{display:inline-block;width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-inline-end:5px}
 .end__hd p{white-space:normal}
 .page footer span:last-child{direction:ltr}
 html[dir=rtl] .creator-identity{direction:rtl}
 @media screen and (min-width:901px) and (max-width:1599px){.page{zoom:calc((100vw - 16px) / 1600px)}}
 @media screen and (max-width:900px){.page{height:auto}.creator-card{min-height:0}}
 `;
}
