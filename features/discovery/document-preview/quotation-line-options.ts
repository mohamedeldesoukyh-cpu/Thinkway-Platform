import type { QuotationItemRow } from "@/features/quotations/types";
import { buildQuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import { collapsePackageGroupItems, collapsePackageLeaderItem, collapsePackageOptionNumber } from "@/lib/quotations/quotation-collapse-package";
import { formatQuotationDeliverablesSummary } from "@/lib/quotations/quotation-deliverable-types";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";

export function quotationLineOptions(items: QuotationItemRow[]): Map<string, NonNullable<DocumentCreatorOption["lineOptions"]>[number]> {
  const contexts = buildQuotationItemOptionContext(items);
  return new Map(items.map(item => {
    const members = item.collapse_group_id ? collapsePackageGroupItems(items, item.collapse_group_id) : [item];
    const leader = collapsePackageLeaderItem(members);
    return [item.id, {
      key: item.collapse_group_id ?? item.id,
      label: `Option ${item.collapse_group_id ? collapsePackageOptionNumber(items, members) : contexts.get(item.id)?.optionNumber ?? 1}`,
      itemIds: members.map(member => member.id),
      description: formatQuotationDeliverablesSummary((leader.deliverables ?? []).map(deliverable => ({...deliverable, revenue: null})), leader.service_description),
      packageLabel: item.collapse_group_id ? leader.collapse_label || members.map(member => member.creator_name || member.handle || "Creator").join(" + ") : undefined,
    }];
  }));
}
