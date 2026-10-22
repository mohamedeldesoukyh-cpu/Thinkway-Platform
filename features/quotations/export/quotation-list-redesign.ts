import { withArabicReportFont } from "@/lib/reports/document/arabic-report-font";
import { reportCreatorName } from "@/lib/reports/document/report-creator-name";
import { QUOTATION_LIST_REDESIGN_CSS } from "./quotation-list-redesign-styles";
import { getThinkwayLogoDarkDataUri } from "@/lib/reports/document/thinkway-report-logo-embed";
import { rateReportPlatformIcon } from "@/features/rate-cards/report-icons";
import { escapeHtml as e, safeProfileUrl } from "@/features/rate-cards/report";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { orderCreatorGroups } from "@/lib/quotations/quotation-creator-order";
import { compareClientListCreators } from "@/lib/creators/client-list-order";
import type { QuotationDocument, QuotationDocCreatorGroup, QuotationDocRow } from "./quotation-document";

type Offer = { kind: string; tag: string; total: string; currency: string; original: string; baseOriginal: string; base: string; af: string; pct: string; description: string; shared: boolean };
type Creator = { group: QuotationDocCreatorGroup; index: number; tier: string; offers: Offer[]; metrics: QuotationDocCreatorGroup["platformMetrics"] };
const platforms = ["instagram", "tiktok"];
const chunks = <T,>(items: T[], size: number): T[][] => Array.from({length: Math.ceil(items.length / size)}, (_, i) => items.slice(i * size, (i + 1) * size));
const image = (value: string | null | undefined) => value && /^(data:image\/(?:png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(value) ? e(value) : "";
const icon = (platform: string) => image(rateReportPlatformIcon(platform));
const url = (value: string | null) => e(safeProfileUrl(value) ?? "");
const number = (value: string) => Number(value.replace(/[^\d.-]/g, ""));

/** Round only the report presentation; retain calculated amounts for pricing logic. */
export function creatorListWholeMoney(value: string) {
  return value.replace(/-?\d[\d,]*(?:\.\d+)?/g, amount =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(amount.replace(/,/g, "")))
  );
}

/** Use the already-calculated reporting amount, preserving its displayed precision. */
export function creatorListMoney(value: string, fallback = "EGP") {
  const parts = value.split(/\s*\/\s*/);
  const parse = (part: string) => {
    const currency = part.match(/\b[A-Z]{3}\b/)?.[0] ?? fallback;
    const amount = part.replace(/\b[A-Z]{3}\b/g, "").trim();
    return { currency, amount };
  };
  const amounts = parts.map(parse);
  const main = amounts.find(part => part.currency === "EGP") ?? amounts[amounts.length - 1];
  const original = amounts.find(part => part.currency !== main.currency);
  return { ...main, original: original ? `${original.amount} ${original.currency}` : "" };
}
export function creatorListViews(value: string) {
  if (!/^\d[\d,]*(?:\.\d+)?$/.test(value.trim())) return value || "—";
  const n = number(value);
  return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : value;
}
export function creatorListDeliverableChips(description: string) {
  return description.split(/\s+\+\s+/).filter(Boolean).map(raw => {
    const label = raw.replace(/IG Set of stories/gi, "IG Story set").replace(/1[×x]\s*Usage Rights \(UR\)/gi, "Usage rights").replace(/1[×x]\s*Boosting/gi, "Boosting").replace(/1[×x]\s*Event Attendance in hour/gi, "Event attendance · 1 hr").replace(/1[×x]\s*Event Attendance/gi, "Event attendance").replace(/1[×x]\s*Event Coverage/gi, "Event coverage").replace(/1 month/gi, "1 mo");
    const kind = raw.length > 100 ? "ex" : /\bTT\b|tiktok/i.test(raw) ? "tt" : /\bIG\b|instagram|reel|stor/i.test(raw) ? "ig" : "ex";
    return `<span class="chip chip--${kind}">${e(label)}</span>`;
  }).join("");
}
function offersFor(group: QuotationDocCreatorGroup, additions: boolean): Offer[] {
  const rows = group.rows.filter(row => {
    const description = (row.serviceDescription || row.deliverables || "").trim();
    return row.isCollapsePackageFollower || !(!description || description === "—") || number(creatorListMoney(row.totalInvestment ?? row.clientCost, row.currency).amount) > 0;
  });
  return rows.map((row: QuotationDocRow, index) => {
    const money = creatorListMoney(row.totalInvestment ?? row.clientCost, row.currency);
    const tag = rows.length === 1 ? "Package" : row.collapseOptionLabel || row.option || `Option ${index + 1}`;
    return { kind: rows.length === 1 ? "pkg" : String(index === 0 ? 1 : 2), tag: additions && /^Option\s+2(?:\/\d+)?$/i.test(tag) ? "Additions" : tag,
      total: money.amount, currency: money.currency, original: money.original,
      baseOriginal: creatorListMoney(row.clientCost, row.currency).original, base: creatorListMoney(row.clientCost, row.currency).amount, af: creatorListMoney(row.af, row.currency).amount, pct: row.afPct,
      description: row.serviceDescription || row.deliverables, shared: Boolean(row.isCollapsePackageFollower) };
  });
}
function tierLabel(tier: string) {
  const cls = ["mega", "macro", "mid", "micro", "nano"].includes(tier.toLowerCase()) ? tier.toLowerCase() : "mid";
  return `<span class="creator-tier creator-tier--${cls}">${e(tier)}</span>`;
}
function renderOffer(offer: Offer | undefined, single: boolean, hideFees: boolean, first: boolean, packageOnly = false) {
  if (packageOnly) return offer ? `<div class="offer offer--${offer.kind}"><div class="offer-top"><span class="offer-tag offer-tag--${offer.kind}">${e(offer.tag)}</span></div><div class="chips">${creatorListDeliverableChips(offer.description)}</div></div>` : `<div class="offer offer--empty"><span>${first ? "Scope pending" : single ? "Single package offered" : "—"}</span></div>`;
  if (!offer) return `<div class="offer offer--empty"><span>${first ? "Rates pending" : single ? "Single package offered" : "—"}</span></div>`;
  if (offer.shared) return `<div class="offer offer--${offer.kind}"><span class="offer-tag offer-tag--${offer.kind}">${e(offer.tag)}</span><div class="chips">${creatorListDeliverableChips(offer.description)}</div><span>Included in shared package</span></div>`;
  const pending = !Number.isFinite(number(offer.total)) || number(offer.total) <= 0;
  const displayedOriginal = hideFees ? offer.original : offer.baseOriginal;
  return `<div class="offer offer--${offer.kind}"><div class="offer-top"><span class="offer-tag offer-tag--${offer.kind}">${e(offer.tag)}</span><span class="offer-price"><span class="offer-price-label">${hideFees ? "Total" : "Base"}</span><span class="offer-total">${pending ? "Rates pending" : `${e(creatorListWholeMoney(hideFees ? offer.total : offer.base))}<small>${e(offer.currency)}</small>`}</span></span></div>${displayedOriginal && !pending ? `<div class="offer-usd">≈ ${e(creatorListWholeMoney(displayedOriginal))}</div>` : ""}<div class="chips">${creatorListDeliverableChips(offer.description)}</div>${hideFees || pending ? "" : `<div class="offer-breakdown" aria-label="Agency fees (AF)"><span class="offer-fee"><span>AF ${e(offer.pct)}</span><b>${e(creatorListWholeMoney(offer.af))}</b></span><span class="offer-inclusive"><span>Total incl. AF</span><b>${e(creatorListWholeMoney(offer.total))}</b></span></div>`}</div>`;
}
function platformMark(platform: string) {
  const src = icon(platform);
  const short = ({ youtube: "YT", facebook: "FB", snapchat: "SC", twitter: "X", linkedin: "IN" } as Record<string, string>)[canonicalPlatformKey(platform)] ?? platform.slice(0, 2).toUpperCase();
  return src ? `<img src="${src}" alt="${e(platform)}">` : `<abbr class="aud-platform" title="${e(platform)}">${e(short)}</abbr>`;
}
function audience(creator: Creator) {
  const rows = platforms.map(platform => {
    const metric = creator.metrics.find(row => canonicalPlatformKey(row.platform) === platform);
    return `<div class="aud-row${metric ? "" : " aud-row--off"}"><img src="${icon(platform)}" alt="${platform}${metric ? "" : " (not included)"}"><span class="aud-f">${e(metric?.followers ?? "—")}</span><span class="aud-e">${e(metric?.engagement ?? "—")}</span><span class="aud-v">${e(creatorListViews(metric?.views ?? "—"))}</span></div>`;
  });
  // Keep other quoted platforms visible instead of silently dropping their metrics.
  for (const metric of creator.metrics.filter(row => !platforms.includes(canonicalPlatformKey(row.platform)))) rows.push(`<div class="aud-row">${platformMark(metric.platform)}<span class="aud-f">${e(metric.followers)}</span><span class="aud-e">${e(metric.engagement)}</span><span class="aud-v">${e(creatorListViews(metric.views))}</span></div>`);
  return `<div class="aud"><div class="aud-row aud-row--head"><span></span><span>Followers</span><span>ER</span><span>Avg views</span></div>${rows.join("")}</div>`;
}
function renderCard(creator: Creator, offers: Offer[], hideFees: boolean, shortlist = false, packageOnly = false) {
  const g = creator.group, href = url(g.profileUrl), portrait = image(g.avatarUrl);
  const recommendation = shortlist ? g.creator.match(/^★\s*(\d+)\s*·\s*([\s\S]*)$/) : null;
  const displayName = reportCreatorName(recommendation ? recommendation[2] : g.creator, g.handle);
  const recommendationTag = recommendation ? `<span class="creator-recommendation">★ Recommended · ${e(recommendation[1])}</span>` : "";
  const badges = platforms.filter(platform => creator.metrics.some(m => canonicalPlatformKey(m.platform) === platform)).map(p => `<img src="${icon(p)}" alt="${p}">`).join("");
  const visual = `${portrait ? `<img src="${portrait}" alt="${e(g.creator)}">` : `<div class="portrait-placeholder">${e(g.creator.slice(0, 1))}</div>`}<span class="idx" aria-hidden="true">${String(creator.index).padStart(3,"0")}</span><span class="pb-stack">${badges}</span>`;
  return `<article class="creator-card">${href ? `<a class="portrait" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${e(g.creator)} — open profile">${visual}</a>` : `<div class="portrait">${visual}</div>`}<div class="creator-identity">${recommendationTag}<h2 class="creator-name" dir="auto" title="${e(displayName)}">${e(displayName)}</h2><div class="creator-meta"><span class="creator-handle">${e(g.handle)}</span>${tierLabel(creator.tier)}</div></div>${audience(creator)}${shortlist ? "" : renderOffer(offers[0], creator.offers.length === 1, hideFees, true, packageOnly) + renderOffer(offers[1], creator.offers.length === 1, hideFees, false, packageOnly)}<div class="creator-categories">${g.categories.map(category => `<span class="creator-category">${e(category)}</span>`).join("") || '<span class="creator-category">Categories not recorded</span>'}</div></article>`;
}
const LEGEND = `<div class="legend"><div class="legend__grp"><span class="legend__k">Tier</span>${["Mega","Macro","Mid","Micro","Nano"].map(tierLabel).join("")}</div><span class="legend__sep"></span><div class="legend__grp"><span class="legend__k">Offer</span><span class="offer-tag offer-tag--1">Option 1</span><span class="offer-tag offer-tag--2">Option 2</span><span class="offer-tag offer-tag--pkg">Package</span><span>= single offer</span></div><span class="legend__sep"></span><div class="legend__grp"><span class="legend__k">Deliverables</span><span class="chip chip--ig">Instagram</span><span class="chip chip--tt">TikTok</span><span class="chip chip--ex">Event · rights · boost</span></div><span class="legend__sep"></span><span>Totals incl. agency fee (AF) · ER = engagement rate</span></div>`;
/** Client-only presentation of the existing calculated quotation document. */
export function buildRedesignedQuotationCreatorList(doc: QuotationDocument) {
  const shortlist = doc.source === "shortlist";

  const packageOnly = doc.template === "creator-list-package";
  const packageTotal = packageOnly ? `<div class="package-total"><span>Package total price</span><strong>${e(creatorListWholeMoney(doc.summary.grandTotal))}</strong><small>Including agency fees</small></div>` : "";
  const additions = doc.template === "creator-list-additions";
  const reportTitle = doc.template === "client-list-by-name" ? "Client List by Name" : packageOnly ? "Creator List Package" : additions ? "Creator List Additions" : "Creator List";
  const secondOptionLabel = additions ? "Additions" : "Option 2";
  const groups = orderCreatorGroups([...doc.creatorGroups].sort((a,b) => compareClientListCreators({tier:a.highestPlatformTier ?? a.rows[0]?.tier, followers:a.highestPlatformFollowers},{tier:b.highestPlatformTier ?? b.rows[0]?.tier, followers:b.highestPlatformFollowers})), doc.creatorListOrder, group => group.itemIds ?? []);
  const creators: Creator[] = groups.map((group,index) => {
    const included = new Set((doc.source === "shortlist" ? group.platformMetrics.map(metric => metric.platform) : group.rows.flatMap(row => row.quotedPlatforms ?? [])).map(canonicalPlatformKey));
    return { group, index:index+1, tier:group.highestPlatformTier ?? group.rows[0]?.tier ?? "Mid", offers:offersFor(group, additions), metrics:group.platformMetrics.filter(metric => included.has(canonicalPlatformKey(metric.platform)) && [metric.followers,metric.engagement,metric.views].some(value => /\d/.test(value))) };
  });
  // Additional alternatives continue on another card; every card still has exactly two slots.
  const cards = creators.flatMap(creator => (creator.offers.length ? chunks(creator.offers,2) : [[]]).map(offers => ({creator,offers})));
  const twoRows = shortlist && doc.template === "client-list-by-name";
  const pages = chunks(cards,twoRows ? 12 : 6), overview = chunks(creators,16);
  const total = 2 + pages.length + overview.length;
  const currencies = [...new Set(creators.flatMap(c => c.offers.map(o => o.currency)))];
  const currencyLabel = currencies.length === 1 ? currencies[0] : currencies.length ? currencies.join(" / ") : "EGP";
  const logo = image(getThinkwayLogoDarkDataUri()), client = image(doc.clientLogo);
  const brand = `<img class="ph__brand" src="${logo}" alt="Thinkway">`;
  const clientLogo = (cls: string) => client ? `<img class="${cls}" src="${client}" alt="${e(doc.clientName)}">` : "";
  const footer = (page:number) => `<footer><span>${e(doc.serial)}</span><s></s><span>${page} / ${total}</span></footer>`;
  const header = (range:string, sub:string) => `<header class="ph">${brand}<div class="ph__c">${clientLogo("ph__client-logo")}<div class="ph__titles"><span class="ph__client" dir="auto">${e(doc.clientName)}</span><b class="ph__title" dir="auto">${e(doc.name)}</b></div><span class="ph__kind">${reportTitle}</span></div><div class="ph__r"><em>${e(range)}</em><span>${e(sub)}</span></div></header>`;
  const portraits = creators.map(c => image(c.group.avatarUrl)).filter(Boolean);
  const mosaic = `<div class="mosaic" aria-hidden="true">${[...portraits,...portraits.slice().reverse()].map(src => `<img src="${src}" alt="">`).join("")}</div>`;
  const tiers = new Map<string,number>(); creators.forEach(c => tiers.set(c.tier,(tiers.get(c.tier)??0)+1));
  const pills = [...tiers].map(([tier,count]) => tierLabel(tier).replace(`>${e(tier)}<`,`>${count} ${e(tier)}<`)).join("");
  const cover = `<section class="page page--cov">${mosaic}<div class="veil"></div><div class="cov"><div class="cov__main"><div class="cov__brand">${brand}<span class="cov__rule"></span><span class="cov__for">Prepared for</span></div><p class="cov__recipient" dir="auto">${e(doc.clientName)}</p><h1 dir="auto">${e(doc.name)}</h1><div class="cov__strip"><b>${reportTitle}</b><i></i><span>${e(doc.serial)}</span><i></i><span>${e(doc.issueDateLabel)}</span></div><div class="cov__count"><b>${creators.length}</b><div class="cov__count-txt"><div><u>creators</u><small>shortlisted for review</small></div><div class="cov__tiers">${pills}</div></div></div>${packageTotal}</div>${clientLogo("cov__client-logo")}</div>${footer(1)}</section>`;
  const content = pages.map((page,index) => `<section class="page">${header(`${page[0].creator.index}–${page[page.length-1].creator.index}`,`of ${creators.length}`)}${(shortlist ? `<div class="legend">Creator profiles · ER = engagement rate</div>` : LEGEND).replace(">Option 2<", `>${secondOptionLabel}<`).replace("Totals incl.", packageOnly ? "Package total on first and last pages incl." : `Totals in ${e(currencyLabel)} incl.`)}<div class="cards">${page.map(c => renderCard(c.creator,c.offers,Boolean(doc.hideCostAndFees), shortlist, packageOnly)).join("")}</div>${footer(index+2)}</section>`).join("");
  const glance = overview.map((batch,index) => {
    const rows = batch.map(c => {
      const metrics = platforms.map(p => { const m=c.metrics.find(m=>canonicalPlatformKey(m.platform)===p); return [m?.followers??"—",m?.engagement??"—"].map((v,i)=>`<span class="r gl-${p==="instagram"?"ig":"tt"}${m?"":" gl-off"}">${i===0?`<span class="gl-f">${e(v)}</span>`:e(v)}</span>`).join(""); }).join("");
      const money = [c.offers.slice(0,1),c.offers.slice(1)].map((offers,i) => `<span class="gl-offer-cell">${offers.length ? offers.map(o=>`<span class="gl-money"><span class="offer-tag offer-tag--${o.kind}">${e(o.kind==="pkg"?"Pkg":o.tag.replace("Option","Opt"))}</span><b>${packageOnly ? "Included" : o.shared ? "Shared package" : number(o.total)>0 ? e(creatorListWholeMoney(o.total)) : "Rates pending"}</b></span>`).join("") : `<span class="gl-off">${i===0?(packageOnly?"Scope pending":"Rates pending"):"—"}</span>`}</span>`).join("");
      return `<div class="gl-tr gl-row"><span class="gl-n">${String(c.index).padStart(3,"0")}</span><a class="gl-who" ${url(c.group.profileUrl)?`href="${url(c.group.profileUrl)}" target="_blank" rel="noopener noreferrer"`:""}>${image(c.group.avatarUrl)?`<img src="${image(c.group.avatarUrl)}" alt="">`:""}<div><b dir="auto">${e(reportCreatorName(c.group.creator, c.group.handle))}</b><span>${e(c.group.handle)}</span></div></a><span>${tierLabel(c.tier)}</span>${metrics}${shortlist ? "" : money}</div>`;
    }).join("");
    return `<section class="page">${header("Overview",`${index*16+1}–${index*16+batch.length} of ${creators.length}`)}<div class="glance-hd"><div><span class="glance-hd__eye">At a glance</span><h1>Every creator, side by side</h1></div><p>${shortlist ? "Creator profiles and performance · ER = engagement rate" : packageOnly ? "Package scope · ER = engagement rate" : `Totals in ${e(currencyLabel)} incl. agency fee · ER = engagement rate`}</p></div><div class="glance"><div class="gl-tr gl-groups"><span></span><span></span><span></span><span class="gl-grp gl-grp--ig"><img src="${icon("instagram")}" alt="">Instagram</span><span class="gl-grp gl-grp--tt"><img src="${icon("tiktok")}" alt="">TikTok</span><span class="gl-grp gl-grp--offer">${packageOnly ? "Included offers" : "Offer totals"}</span></div><div class="gl-tr gl-head"><span>#</span><span>Creator</span><span>Tier</span><span class="r">Followers</span><span class="r">ER</span><span class="r">Followers</span><span class="r">ER</span><span class="gl-offer-cell">Option 1 / Package</span><span class="gl-offer-cell">${secondOptionLabel}</span></div>${rows}</div>${footer(2+pages.length+index)}</section>`;
  }).join("");
  const stat = (count:number,label:string) => `<div class="st"><b>${count}</b><span>${e(label)}</span></div>`;
  const closing = `<section class="page page--end">${mosaic}<div class="veil veil--end"></div><div class="end"><span class="end__eye">${e(doc.name)}</span><h1>${creators.length} creators</h1><p>${shortlist ? "Shortlist" : "Client quotation"} · ${e(doc.serial)} · ${e(doc.issueDateLabel)}</p>${packageTotal}<div class="end__g"><div class="bk"><span class="bk__k">By tier</span><div class="bk__b">${[...tiers].map(([t,n])=>stat(n,t)).join("")}</div></div><div class="bk"><span class="bk__k">Platform coverage</span><div class="bk__b">${platforms.map(p=>stat(creators.filter(c=>c.metrics.some(m=>canonicalPlatformKey(m.platform)===p)).length,`on ${p==="instagram"?"Instagram":"TikTok"}`)).join("")}</div></div><div class="bk"><span class="bk__k">Offers</span><div class="bk__b">${stat(creators.filter(c=>c.offers.length>=2).length,"with 2+ options")}${stat(creators.filter(c=>c.offers.length===1).length,"single package")}${stat(creators.filter(c=>!c.offers.length).length,"pending")}</div></div></div><div class="end__ft">${brand}<span></span>${clientLogo("ph__client-logo")}</div></div>${footer(total)}</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(doc.name)} — ${reportTitle}</title><style>${withArabicReportFont(QUOTATION_LIST_REDESIGN_CSS)}${twoRows ? `.report--shortlist .cards.cards{grid-template-rows:repeat(2,auto);row-gap:14px}.report--shortlist .cards .creator-card{grid-row:span 1;grid-template-rows:190px auto auto 1fr;align-content:start}.report--shortlist .portrait{height:190px}.report--shortlist .creator-categories{align-self:end}` : ""}${shortlist ? `.report--shortlist .gl-offer-cell,.report--shortlist .gl-grp--offer,.report--shortlist .end__g>.bk:last-child{display:none}.report--shortlist .gl-tr{grid-template-columns:48px minmax(0,1fr) 100px 140px 100px 140px 100px!important}.report--shortlist .cards{grid-template-rows:repeat(4,auto)}.report--shortlist .creator-card{grid-row:span 4;grid-template-rows:subgrid}.report--shortlist .end__g{grid-template-columns:repeat(2,minmax(0,1fr))}` : ""}\n.report--additions{--offer2-bg:#eeecfa;--tag2-bg:#332b70;--tag2-fg:#ffffff}.report--additions .offer-tag--2{letter-spacing:.45px;font-size:9px}\n.package-total{display:flex;flex-direction:column;gap:6px;margin-top:24px;color:inherit}.package-total>span{font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase}.package-total>strong{font-size:36px;line-height:1.2;font-weight:700}.package-total>small{font-size:12px;opacity:.8}.end .package-total{margin:18px 0}.creator-tier--micro{background:var(--mid-bg);color:var(--mid-fg)}.portrait-placeholder{display:grid;place-items:center;height:100%;font-size:64px;background:var(--offer1-bg);color:var(--ink)}.ph__client-logo,.cov__client-logo{object-fit:contain;max-width:420px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.25))}.ph__client-logo{max-width:150px}.gl-money{flex-wrap:nowrap;gap:5px;font-size:12px}.offer-total{overflow-wrap:anywhere}.gl-row{min-height:44px;height:auto}.creator-card{min-width:0}.creator-recommendation{display:inline-flex;align-items:center;max-width:100%;padding:3px 7px;margin-bottom:5px;border:1px solid #e9c875;border-radius:999px;background:#fff3ce;color:#735000;font:700 10px/1.4 sans-serif;white-space:nowrap}.aud-platform{font-size:8px;font-weight:700;line-height:16px;text-align:center;text-decoration:none;overflow:hidden;max-width:18px}.aud-row>*{min-width:0}.offer-price{display:flex;flex-direction:column;align-items:center;gap:3px}.offer-price-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-3)}.offer-breakdown>span{display:flex;flex-direction:column;gap:3px}.offer-breakdown b{font-weight:700;color:var(--ink)}.offer-fee{text-align:left}.offer-inclusive{text-align:right}.gl-tr{grid-template-columns:48px minmax(0,1fr) 82px 110px 90px 110px 90px 170px 170px}.gl-grp{grid-column:span 2}.gl-offer-cell{text-align:left}.gl-money{justify-content:flex-start}</style></head><body${shortlist ? ' class="report--additions report--shortlist"' : additions ? ' class="report--additions"' : ""}>${cover}${content}${glance}${closing}<script>Promise.all([document.fonts.ready,...Array.from(document.images).map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve())]).then(()=>{document.documentElement.setAttribute('data-creator-list-ready','true')});</script></body></html>`;
}
