import type { QuotationItemRow } from "@/features/quotations/types";
import { buildQuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import { collapsePackageGroupItems, collapsePackageLeaderItem, collapsePackageOptionNumber } from "@/lib/quotations/quotation-collapse-package";
import { formatQuotationDeliverablesSummary } from "@/lib/quotations/quotation-deliverable-types";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";

/** Saved descriptions may already contain the generated deliverable summary. */
export function quotationOptionDescription(item: Pick<QuotationItemRow, "deliverables" | "service_description">): string {
  const deliverables = (item.deliverables ?? []).map(deliverable => ({ ...deliverable, revenue: null, service_description: null }));
  const key = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const generated = deliverables.length ? formatQuotationDeliverablesSummary(deliverables) : "";
  const known = new Set<string>();
  if (generated) {
    known.add(key(generated));
    known.add(key(formatQuotationDeliverablesSummary(deliverables.map(deliverable => ({ ...deliverable, platform: null })))));
  }
  for (const deliverable of deliverables) {
    known.add(key(formatQuotationDeliverablesSummary([deliverable])));
    known.add(key(formatQuotationDeliverablesSummary([{ ...deliverable, platform: null }])));
  }
  const generatedPrefixes = [...known].sort((a, b) => b.length - a.length);
  const notes: string[] = [];
  for (const description of [...(item.deliverables ?? []).map(deliverable => deliverable.service_description), item.service_description]) {
    for (const part of (description ?? "").split(/\s+—\s+/)) {
      let text = part.trim().replace(/\s+/g, " ");
      if (!text || known.has(key(text))) continue;
      // An auto-filled description can add a duration after the same summary.
      const prefix = generatedPrefixes.find(base => key(text).startsWith(`${base} `));
      if (prefix) text = text.slice(prefix.length).replace(/^[\s·—]+/, "").trim();
      if (!text || known.has(key(text))) continue;
      known.add(key(text));
      notes.push(text);
    }
  }
  return [generated, ...notes].filter(Boolean).join(" — ") || "—";
}

export function quotationLineOptions(items: QuotationItemRow[]): Map<string, NonNullable<DocumentCreatorOption["lineOptions"]>[number]> {
  const contexts = buildQuotationItemOptionContext(items);
  return new Map(items.map(item => {
    const members = item.collapse_group_id ? collapsePackageGroupItems(items, item.collapse_group_id) : [item];
    const leader = collapsePackageLeaderItem(members);
    return [item.id, {
      key: item.collapse_group_id ?? item.id,
      label: `Option ${item.collapse_group_id ? collapsePackageOptionNumber(items, members) : contexts.get(item.id)?.optionNumber ?? 1}`,
      itemIds: members.map(member => member.id),
      description: quotationOptionDescription(leader),
      packageLabel: item.collapse_group_id ? leader.collapse_label || members.map(member => member.creator_name || member.handle || "Creator").join(" + ") : undefined,
    }];
  }));
}
