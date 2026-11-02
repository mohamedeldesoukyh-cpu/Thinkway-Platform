import type { QuotationDocCreatorGroup } from "./quotation-document";

export type ProposalRosterEntry = { group: QuotationDocCreatorGroup; number: number; scope: string; continued: boolean };

export function proposalDeliverablePoints(scope: string): string[] {
  return scope.split(/\s+\+\s+|\s+·\s+(?=Option\s+\d)/).map(point => point.trim()).filter(Boolean);
}

/** Fill available page height, accounting for bullet wrapping at the current column width. */
export function proposalRosterPages(groups: QuotationDocCreatorGroup[], showDeliverables: boolean, columns: number): ProposalRosterEntry[][] {
  const entries = showDeliverables ? proposalRosterEntries(groups) : groups.map((group,index) => ({group,number:index+1,scope:"",continued:false}));
  const pages: ProposalRosterEntry[][] = [[]];
  const textWidth = Math.max(18, Math.floor((1380 / columns - 30) * .6 / 7));
  const nameWidth = Math.max(12, Math.floor((1380 / columns - 30) * (showDeliverables ? .4 : 1) / 7));
  let used = 0;
  for (const entry of entries) {
    const scopeLines = showDeliverables ? proposalDeliverablePoints(entry.scope).reduce((sum,point) => sum + Math.ceil(point.length / textWidth),0) : 0;
    const nameLines = Math.ceil((entry.group.creator || entry.group.handle || "Creator").length / nameWidth);
    const height = Math.max(2,nameLines,scopeLines) + .6;
    if (used + height > 34 && pages.at(-1)!.length) { pages.push([]); used = 0; }
    pages.at(-1)!.push(entry);
    used += height;
  }
  return pages;
}

/** Keep every selected offer and its quantities; abbreviate labels without removing scope. */
export function proposalRosterEntries(groups: QuotationDocCreatorGroup[]): ProposalRosterEntry[] {
  return groups.flatMap((group, index) => {
    const scope = group.rows.map(row => {
      const label = (row.serviceDescription || row.deliverables || "Scope pending")
        .replace(/Instagram/gi,"IG").replace(/TikTok/gi,"TT")
        .replace(/IG Set of stories/gi,"IG Story set")
        .replace(/Usage Rights \(UR\)/gi,"Usage rights")
        .replace(/\bmonths\b/gi,"mos").replace(/\bmonth\b/gi,"mo")
        .replace(/\s+/g," ").trim();
      const description = label === "—" ? "Scope pending" : label;
      return group.rows.length > 1 ? `${row.option || "Option"}: ${description}` : description;
    }).join(" · ") || "Scope pending";
    // Bound each row's text instead of truncating creators or long deliverable lists.
    const parts: string[] = [];
    let remaining = scope;
    while (remaining.length > 96) {
      const space = remaining.lastIndexOf(" ",96);
      const cut = space > 32 ? space : 96;
      parts.push(remaining.slice(0,cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) parts.push(remaining);
    return parts.map((part, n) => ({group,number:index+1,scope:part,continued:n > 0}));
  });
}
