import { reportCreatorName } from "@/lib/reports/document/report-creator-name";
import { orderedQuotationReportCreators } from "./quotation-report-order";
import type { QuotationDocument } from "./quotation-document";
import { escapeHtml as e } from "@/features/rate-cards/report";

/** Compose alternative rosters without combining their commercial totals. */
export function buildQuotationProposalReport(doc: QuotationDocument, render: (document: QuotationDocument) => string): string {
  const options = doc.proposalOptions ?? [];
  const plain = render({ ...doc, proposalOptions: undefined });
  const sections = (html: string) => html.match(/<section class="page[^"]*">[\s\S]*?<\/section>/g) ?? [];
  const basePages = sections(plain);
  if (!options.length || !basePages.length) return plain;
  const badge = (index: number, recommended: boolean) => `Option ${index + 1}${recommended ? ' <span class="proposal-badge"><svg class="proposal-star" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z"/></svg> Recommended</span>' : ""}`;
  const optionDocuments = options.map(option => ({ ...option.document, proposalOptions: undefined, clientLogo: doc.clientLogo, reportPartnerName: doc.reportPartnerName,
    creatorGroups: option.document.creatorGroups.map(group => {
      const source = doc.creatorGroups.find(candidate => candidate.itemIds?.some(id => group.itemIds?.includes(id)));
      return source ? { ...group, avatarUrl: source.avatarUrl, avatarProxyUrl: source.avatarProxyUrl } : group;
    })
  }));
  const stripOverallTotal = (page: string) => page.replace(/<div class="package-total">[\s\S]*?<\/div>/g, `<div class="package-total"><span>Proposal options</span><strong>${options.length} options to compare</strong></div>`);
  const cover = stripOverallTotal(basePages[0]!);
  const closing = stripOverallTotal(basePages[basePages.length - 1]!);
  const sampleHeader = basePages[1]?.match(/<header class="ph">[\s\S]*?<\/header>/)?.[0] ?? "";
  const summaryPages: string[] = [];
  for (let start = 0; start < options.length; start += 5) {
    const batch = optionDocuments.slice(start, start + 5);
    const summaryHeader = sampleHeader.replace(/<span class="ph__kind">[\s\S]*?<\/span>/, '<span class="ph__kind">Options summary</span>').replace(/<div class="ph__r">[\s\S]*?<\/div>/, '<div class="ph__r"><em>Compare</em></div>');
    const cells = (get: (document: QuotationDocument, index: number) => string) => batch.map((document, index) => `<td>${get(document, index + start)}</td>`).join("");
    summaryPages.push(`<section class="page proposal-summary">${summaryHeader}<div class="glance-hd"><div><span class="glance-hd__eye">Your campaign choices</span><h1>Compare your options</h1></div><p>Each option is a separate proposal.</p></div><table class="proposal-comparison"><thead><tr><th></th>${batch.map((_,index) => `<th>${badge(start + index, options[start + index]!.recommended)}</th>`).join("")}</tr></thead><tbody><tr><th>Number of creators</th>${cells(document => String(document.summary.creatorCount))}</tr><tr><th>Selection</th>${cells(document => orderedQuotationReportCreators(document).slice(0,12).map((group,index) => {
      const name = reportCreatorName(group.creator, group.handle);
      const portrait = group.avatarUrl && /^(data:image\/(?:png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(group.avatarUrl) ? `<img src="${e(group.avatarUrl)}" alt="" width="28" height="28">` : `<span class="proposal-avatar-fallback">${e(Array.from(name)[0] ?? "C")}</span>`;
      return `<div class="proposal-name"><span class="proposal-creator-number">${index+1}</span>${portrait}<span dir="auto">${e(name)}</span></div>`;
    }).join("") + (document.creatorGroups.length > 12 ? `<small>+${document.creatorGroups.length - 12} creators — see option pages</small>` : ""))}</tr>${doc.template === "client-list-by-name" ? "" : `<tr class="proposal-price"><th>Total price</th>${cells(document => e(document.summary.grandTotal))}</tr>`}</tbody></table><footer><span>${e(doc.serial)}</span><s></s><span></span></footer></section>`);
  }
  const optionPages = optionDocuments.flatMap((document, index) => sections(render(document)).slice(1,-1).map(page => page.replace(/<span class="ph__kind">[\s\S]*?<\/span>/, `<span class="ph__kind proposal-option-heading">${badge(index, options[index]!.recommended)}</span>`)));
  const pages = [cover, ...summaryPages, ...optionPages, closing];
  const body = pages.map((page,index) => page.replace(/<footer>[\s\S]*?<\/footer>/, `<footer><span>${e(doc.serial)}</span><s></s><span>${index + 1} / ${pages.length}</span></footer>`)).join("");
  const styles = `<style>.proposal-comparison{width:100%;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,.2);border-radius:16px;overflow:hidden;table-layout:fixed;color:#fff}.proposal-comparison th,.proposal-comparison td{padding:16px 12px;vertical-align:top;text-align:left;border-bottom:1px solid rgba(255,255,255,.15);border-right:1px solid rgba(255,255,255,.12);font-size:15px;line-height:1.35;overflow-wrap:anywhere}.proposal-comparison thead th{background:rgba(255,255,255,.13);font-size:19px}.proposal-comparison th:first-child{width:150px;color:#c6c4ee}.proposal-comparison td{background:rgba(255,255,255,.05)}.proposal-name{display:flex;align-items:center;gap:7px;margin-bottom:7px;min-height:28px}.proposal-name img,.proposal-avatar-fallback{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0}.proposal-avatar-fallback{display:grid;place-items:center;background:#39346f}.proposal-creator-number{color:#aaa6d2;font-size:10px;width:14px;flex-shrink:0}.proposal-name>span:last-child{min-width:0}.proposal-price td{font-size:23px;font-weight:700;color:#ff2da8}.proposal-star{display:inline-block;vertical-align:-1px;margin-right:3px}.proposal-badge{display:inline-block;margin-left:5px;font-size:12px;line-height:1.5;padding:3px 7px;border-radius:8px;background:#fff3ce;color:#735000;white-space:nowrap;letter-spacing:0;text-transform:none}.proposal-comparison .proposal-badge{display:block;margin:8px 0 0;width:fit-content}.proposal-option-heading{font-size:14px!important;white-space:normal!important;min-width:160px}.proposal-summary .glance-hd{margin-bottom:28px}</style>`;
  return plain.replace("</head>", `${styles}</head>`).replace(/(<body[^>]*>)[\s\S]*?(<script>)/, (_match, opening, script) => opening + body.replaceAll("Package total on first and last pages", "Option totals on the comparison page") + script);
}
