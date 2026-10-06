import {getReportPlatformIconDataUri} from "@/lib/performance/report/report-platform-icons";
import type { ShortlistDocument } from "./shortlist-document";
import type { HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";
import { getThinkwayLogoDarkDataUri } from "@/lib/reports/document/thinkway-report-logo-embed";
import { CREATOR_LIST_CSS, CREATOR_LIST_WALL_SCRIPT } from "./creator-list-assets";

export const CREATOR_LIST_PDF_OPTIONS: HtmlToPdfOptions = {
  width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  viewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
  waitForDocumentAttribute: { name: "data-creator-list-ready", value: "true", timeoutMs: 45_000 },
};
export type CreatorListEntry = { name: string; handle: string; profileUrl: string | null; portrait: string | null; markets: string[]; avatar?: string | null; categories?: string[]; tier?: string | null };
export type CreatorListReport = { name: string; reference: string; issuedDate: string; clientLogo?: string | null; creators: CreatorListEntry[]; totalAvgCost?: import("../creator-list-cost").CreatorListCost };
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function image(value: string | null | undefined): string {
  return value && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value) ? esc(value) : "";
}
function link(value: string | null): string {
  return value && /^https?:\/\//i.test(value) ? esc(value) : "";
}
export function creatorListPlatform(url: string | null): "Instagram" | "TikTok" | "Facebook" | "YouTube" | "LinkedIn" | null {
  try {
    const host = new URL(url ?? "").hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
    if (host === "facebook.com" || host.endsWith(".facebook.com")) return "Facebook";
    if (host === "youtube.com" || host.endsWith(".youtube.com")) return "YouTube";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "LinkedIn";
  } catch { /* A missing/invalid URL has no platform badge. */ }
  return null;
}
export type CreatorListPresentation = {
  title?: string; language?: "en" | "ar"; cardsPerPage?: number; uniqueCreators?: number;
  /** Trusted renderer callbacks; callers must escape all user-supplied values. */
  cardSupplement?: (creator: CreatorListEntry, index: number) => string;
  wrapCard?: (html: string, creator: CreatorListEntry, index: number) => string;
  extraCss?: string; closingContent?: string; coverSupplement?: string; showClientLogoInHeader?: boolean; coverLogoOnRight?: boolean; hideCoverReference?: boolean;
  platformIcon?: (platform: string) => string | null;
};
export function renderCreatorListReport(report: CreatorListReport, presentation: CreatorListPresentation = {}): string {
  const lang=presentation.language??"en",text=(en:string,ar:string)=>lang==="ar"?ar:en;
  const platformIcon = presentation.platformIcon ?? getReportPlatformIconDataUri;
  const reportTitle=esc(presentation.title??text("Creator list","قائمة المبدعين"));
  const perPage=presentation.cardsPerPage??6;
  const uniqueCreators=presentation.uniqueCreators??report.creators.length;
  const logo = getThinkwayLogoDarkDataUri();
  if (!logo) throw new Error("The Thinkway reverse logo is unavailable. Export stopped to avoid an unbranded report.");
  const brand = '<svg class="brand-lockup" role="img" aria-label="Thinkway" viewBox="0 0 3650 736"><use href="#thinkway-reverse" /></svg>';
  const total = report.creators.length;
  const sheets = Math.ceil(total / perPage);
  const pages = sheets + 2;
  const footer = (page: number) => `<footer><span>${esc(report.reference)}</span><s></s><span>${page} / ${pages}</span></footer>`;
  const name = esc(report.name);
  const wall = '<div class="mosaic" data-mosaic aria-hidden="true"></div>';
  const cover = `<section class="page page--cov">${wall}<div class="veil"></div><div class="cov"><div class="cov__brand">${brand}<span class="cov__rule"></span><span class="cov__for">${text("prepared for","أُعدّ لصالح")}</span></div><div class="cov__client" data-logo-slot>${!presentation.coverLogoOnRight&&image(report.clientLogo) ? `<img src="${image(report.clientLogo)}" alt="${name}">` : ""}<h1 dir="auto">${name}</h1>${presentation.coverLogoOnRight&&image(report.clientLogo)?`<img class="cover-client-logo" src="${image(report.clientLogo)}" alt="${name}">`:""}</div><div class="cov__strip"><span class="cov__kind">${reportTitle}</span>${presentation.hideCoverReference?"":`<span class="cov__dot"></span><span class="cov__ref">${esc(report.reference)}</span>`}<span class="cov__dot"></span><span class="cov__date">${esc(report.issuedDate)}</span></div>${presentation.coverSupplement??""}<div class="cov__count"><b>${uniqueCreators}</b><span><u>${text("creators","مبدعون")}</u><i>${text("shortlisted for review","للمراجعة")}</i></span></div></div>${footer(1)}</section>`;
  const content: string[] = [];
  const platformCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let recorded = 0, missingPortraits = 0, links = 0;
  const cards = report.creators.map((creator, index) => {
    const platform = creatorListPlatform(creator.profileUrl);
    if (platform) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    const categories = [...new Set((creator.categories ?? []).map((v) => v.trim()).filter(Boolean))];
    if (categories.length) recorded++;
    categories.forEach((category) => categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1));
    const src = image(creator.portrait), href = link(creator.profileUrl);
    if (!src) missingPortraits++;
    if (href) links++;
    const visual = `${src ? `<img src="${src}" alt="${esc(creator.name)}" loading="eager">` : `<div class="placeholder" aria-label="No portrait supplied">${esc(creator.name.slice(0, 1).toUpperCase())}</div>`}<span class="idx" aria-hidden="true">${String(index + 1).padStart(3, "0")}</span>${platform ? `<span class="pb pb--${platform === "Instagram" ? "ig" : "tt"}" title="${platform}" aria-hidden="true"><img src="${platformIcon(platform.toLowerCase())}" alt="" /></span>` : ""}`;
    const avatar = image(creator.avatar);
    const identity = `<div class="creator-identity">${avatar ? `<img class="creator-avatar" src="${avatar}" alt="" aria-hidden="true" loading="eager">` : `<span class="creator-avatar" aria-hidden="true">${esc(creator.name.slice(0, 1).toUpperCase())}</span>`}<div class="creator-label"><h2 dir="auto">${esc(creator.name)}</h2>${creator.tier ? `<span class="creator-tier">${esc(creator.tier)}</span>` : ""}<p dir="auto">${esc(creator.handle)}</p></div></div>`;
    const card = `<article class="creator-card">${href ? `<a class="portrait" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${esc(creator.name)}">${visual}</a>` : `<div class="portrait">${visual}</div>`}${identity}${presentation.cardSupplement?.(creator,index)??""}<div class="creator-categories">${categories.length ? categories.map((category) => `<span class="creator-category">${esc(category)}</span>`).join("") : '<span class="creator-category creator-category--none">Categories not recorded</span>'}</div></article>`;
    return presentation.wrapCard?.(card,creator,index)??card;
  });
  for (let i = 0; i < total; i += perPage) content.push(`<section class="page"><header class="ph"><div class="ph__l">${brand}</div><div class="ph__c">${presentation.showClientLogoInHeader&&image(report.clientLogo)?`<img class="report-client-logo" src="${image(report.clientLogo)}" alt="${name}">`:""}<b>${name}</b><span>${reportTitle}</span></div><div class="ph__r"><em>${i + 1}–${Math.min(i + perPage, total)}</em><span>${text("of","من")} ${total}</span></div></header><div class="cards">${cards.slice(i, i + perPage).join("")}</div>${footer(i / perPage + 2)}</section>`);
  const stats = (entries: [string, number][]) => entries.map(([label, count]) => `<div class="st"><b>${count}</b><span>${esc(label)}</span></div>`).join("");
  const categories = [...categoryCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));
  const unknownPlatforms = total - [...platformCounts.values()].reduce((a,b) => a+b,0);
  const cost = report.totalAvgCost;
  const costHtml = cost?.visible === true && typeof cost.amount === "number" && Number.isFinite(cost.amount) && cost.amount >= 0
    ? `<div class="report-total-cost"><span>Total Avg Cost</span><strong>${esc(cost.currency)} ${cost.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong></div>` : "";
  const closing = presentation.closingContent ? `<section class="page page--end">${wall}<div class="veil veil--end"></div><div class="end">${presentation.closingContent}<div class="end__ft"><div class="end__brand">${brand}</div></div></div>${footer(pages)}</section>` : `<section class="page page--end">${wall}<div class="veil veil--end"></div><div class="end"><div class="end__hd"><span class="end__eye">End of list</span><h1>${total} creators</h1><p>Shortlisted for ${name} — ${links} profiles on the preceding ${sheets} creator pages link to their supplied destinations.</p></div><div class="end__g"><div class="bk"><span class="bk__k">Platform</span><div class="bk__b">${stats([...platformCounts])}${unknownPlatforms ? stats([["Other / not recorded", unknownPlatforms]]) : ""}</div></div><div class="bk"><span class="bk__k">Categories — where recorded</span><div class="bk__b">${stats(categories.slice(0, 6)) || '<span class="no-markets">No categories recorded</span>'}</div></div><div class="bk bk--note"><span class="bk__k">Completeness</span><div class="bk__b bk__b--col"><p><b>${recorded}</b> of ${total} creators have categories recorded. ${total - recorded ? `The remaining <b>${total - recorded}</b> have no recorded categories; none are assumed.` : "No category gaps."}</p><p><b>${missingPortraits}</b> profiles have no portrait supplied. ${missingPortraits ? "They are marked on the card rather than hidden." : "All portraits are supplied."}</p></div></div></div>${costHtml}<div class="end__ft"><div class="end__brand">${brand}</div><span class="end__sp"></span><span class="end__ref">${esc(report.reference)} · ${esc(report.issuedDate)}</span></div></div>${footer(pages)}</section>`;
  return `<!doctype html><html lang="${lang}" dir="${lang==="ar"?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name} — ${reportTitle}</title><style>${CREATOR_LIST_CSS}\n${presentation.extraCss??""}\n.report-client-logo{display:block;max-width:110px;height:32px;object-fit:contain;background:white;border-radius:5px;padding:3px;flex-shrink:0}.brand-lockup{display:block;height:26px;width:129px;flex:none}.brand-defs{position:absolute;width:0;height:0;overflow:hidden}.no-markets{font-size:12px;color:var(--dim)}</style></head><body><svg class="brand-defs" aria-hidden="true"><defs><filter id="report-logo-white-key" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -10 -10 -10 0 30" result="whiteKey"/><feComposite in="SourceGraphic" in2="whiteKey" operator="in"/></filter><symbol id="thinkway-reverse" viewBox="0 0 3650 736"><image href="${image(logo)}" width="3650" height="736" /></symbol></defs></svg>${cover}${content.join("")}${closing}<script>${CREATOR_LIST_WALL_SCRIPT}\nPromise.all(Array.from(document.images).map(function(im){return im.decode ? im.decode().catch(function(){}) : Promise.resolve();})).then(function(){document.documentElement.setAttribute('data-creator-list-ready','true');});</script></body></html>`;
}
export function buildCreatorListHtml(doc: ShortlistDocument): string {
  return renderCreatorListReport({ name: doc.name, reference: doc.serial, issuedDate: doc.generatedDateLabel, clientLogo: doc.clientLogoDataUri, totalAvgCost: doc.creatorListCost, creators: doc.creatorGroups.map((c) => {
    const shot = c.publicationShots?.[0];
    return { name: c.creator, handle: c.handle, profileUrl: shot?.postUrl ?? c.profileUrl, portrait: shot?.imageUrl ?? c.avatarUrl, avatar: c.avatarUrl, categories: c.categories ?? [], tier: c.tier, markets: c.recordedMarkets ?? (c.country && c.country !== "—" ? c.country.split(" · ") : []) };
  }) });
}
