import {escapeHtml} from "./report";
import type {Language} from "./labels";

/** Keep preview work bounded; downloads still include the entire rate card. */
export function addRatePreviewNavigation(html:string,url:URL,preview:{page:number;pages:number;total:number},lang:Language){
 const e=escapeHtml,ar=lang==="ar";
 const link=(page:number)=>{const next=new URL(url);next.searchParams.set("page",String(page));return e(next.pathname+next.search);};
 const download=new URL(url);download.searchParams.set("download","1");download.searchParams.delete("page");
 const nav=`<nav class="rate-preview-nav" aria-label="${ar?"صفحات المعاينة":"Preview pages"}">${preview.page>1?`<a href="${link(preview.page-1)}">${ar?"السابق":"Previous"}</a>`:""}<span>${ar?"المعاينة":"Preview"} ${preview.page} / ${preview.pages} · ${preview.total} ${ar?"مبدع":"creators"}</span>${preview.page<preview.pages?`<a href="${link(preview.page+1)}">${ar?"التالي":"Next"}</a>`:""}<a href="${e(download.pathname+download.search)}">${ar?"تنزيل القائمة كاملة":"Download complete list"}</a></nav>`;
 const css='<style>.rate-preview-nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:16px;padding:12px;background:#fff;color:#080642;font:14px Arial,sans-serif}.rate-preview-nav a{color:#6551ad;padding:8px}.rate-preview-nav a:focus-visible{outline:2px solid #6551ad}@media print{.rate-preview-nav{display:none}}</style>';
 return html.replace('</head>',css+'</head>').replace('<body>','<body>'+nav);
}
