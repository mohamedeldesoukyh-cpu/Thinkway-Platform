import type { ShortlistDocument, ShortlistDocCreatorGroup } from "./shortlist-document";
import type { HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";

export const CREATOR_LIST_PDF_OPTIONS: HtmlToPdfOptions = {
  width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  viewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
};

function escape(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function safeUrl(value: string | null | undefined, image = false): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || (image && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value))) return escape(value);
  return "";
}
function card(creator: ShortlistDocCreatorGroup): string {
  const shot = creator.publicationShots?.find((item) => safeUrl(item.imageUrl, true));
  const source = safeUrl(shot?.imageUrl ?? creator.avatarUrl, true);
  const href = safeUrl(shot?.postUrl ?? creator.profileUrl);
  const caption = shot?.caption || [creator.handle, creator.country].filter(Boolean).join(" · ");
  const media = source
    ? `<img src="${source}" alt="${escape(creator.creator)}" />`
    : `<div class="placeholder">${escape(creator.creator.slice(0, 1).toUpperCase())}</div>`;
  return `<article class="creator-card">${href ? `<a class="portrait" href="${href}" target="_blank" rel="noopener noreferrer">${media}</a>` : `<div class="portrait">${media}</div>`}<h2 dir="auto">${escape(creator.creator)}</h2><p dir="auto">${escape(caption)}</p></article>`;
}

/** Six aligned cards per landscape page; no internal notes or commercial data. */
export function buildCreatorListHtml(doc: ShortlistDocument): string {
  const pages: string[] = [];
  for (let index = 0; index < Math.max(1, doc.creatorGroups.length); index += 6) {
    const creators = doc.creatorGroups.slice(index, index + 6);
    pages.push(`<section class="page"><h1 dir="auto">${escape(doc.name)}</h1><div class="campaign-strip"><strong>Creator list</strong>${doc.description ? `<span class="concept" dir="auto">${escape(doc.description)}</span>` : ""}${doc.brandName ? `<span class="brand">${escape(doc.brandName)}</span>` : ""}</div><div class="cards">${creators.map(card).join("") || '<p class="empty">No creators selected.</p>'}</div><footer>${escape(doc.serial)} · ${index / 6 + 1} / ${Math.max(1, Math.ceil(doc.creatorGroups.length / 6))}</footer></section>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(doc.name)} — Creator list</title><style>
*{box-sizing:border-box}body{margin:0;background:#050443;font-family:Arial,Helvetica,sans-serif;color:white}.page{width:1600px;height:900px;padding:40px 60px;position:relative;overflow:hidden;break-after:page}.page:last-child{break-after:auto}h1{font-size:44px;line-height:1.2;margin:0;height:138px;display:flex;align-items:flex-start;font-weight:700;overflow:hidden}.campaign-strip{height:53px;border-radius:30px;background:#25225f;display:flex;align-items:center;justify-content:center;gap:20px;padding:10px 26px;font-size:20px;margin-bottom:11px;overflow:hidden}.concept{border-left:1px solid #a5a1c4;padding-left:20px;color:#c4c1d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand{color:#ff3da8;font-weight:700;white-space:nowrap}.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:13px;background:#211e5c;border-radius:20px;padding:14px 17px 18px;min-height:530px;align-items:start}.creator-card{height:496px;padding:11px 12px;background:white;border-radius:12px;color:#080642;overflow:hidden}.portrait{display:block;height:372px;border-radius:8px;overflow:hidden;background:#efedf4;text-decoration:none;color:#25225f}.portrait img{height:100%;width:100%;object-fit:cover;display:block}.placeholder{height:100%;display:grid;place-items:center;font-size:80px;background:linear-gradient(145deg,#eeebfa,#b9b5dd)}h2{font-size:16px;line-height:20px;text-align:center;margin:13px 0 0;height:40px;overflow:hidden}p{font-size:13px;line-height:18px;text-align:center;margin:0;color:#666477;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.empty{color:white;grid-column:1/-1;margin:auto}footer{position:absolute;bottom:28px;right:60px;color:#aaa6cf;font-size:12px}
@page{size:1600px 900px;margin:0}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media screen and (max-width:900px){.page{width:100%;height:auto;min-height:100vh;padding:24px}h1{font-size:30px;height:auto;margin-bottom:35px}.campaign-strip{font-size:14px;gap:10px}.cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0}.creator-card{height:auto;padding-bottom:14px}.portrait{height:auto;aspect-ratio:9/16}footer{position:static;text-align:right;margin-top:18px}}@media screen and (min-width:901px) and (max-width:1599px){.page{zoom:calc(100vw / 1600px)}}
</style></head><body>${pages.join("")}</body></html>`;
}
