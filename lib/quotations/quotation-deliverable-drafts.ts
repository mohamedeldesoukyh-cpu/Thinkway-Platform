import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import { deliverableCommercialDefaults } from "@/lib/quotations/quotation-deliverable-commercial";
import {
  deliverableTypeLines,
  normalizeDeliverableTypes,
  syncDeliverableFromTypeLines,
} from "@/lib/quotations/quotation-deliverable-types";

export type DeliverableDraft = QuotationDeliverable & { key: string };

export function newDeliverableKey(): string {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyDeliverableDraft(
  item: QuotationItemRow,
  allowedPlatforms: string[] = []
): DeliverableDraft {
  return {
    key: newDeliverableKey(),
    platform: item.platform ?? allowedPlatforms[0] ?? "instagram",
    type: "",
    types: [],
    type_lines: [{ type: "", quantity: 1 }],
    quantity: 1,
    revenue: null,
    service_description: null,
    ...deliverableCommercialDefaults(item),
  };
}

export function ensureAtLeastOneDraft(
  drafts: DeliverableDraft[],
  item: QuotationItemRow,
  allowedPlatforms: string[]
): DeliverableDraft[] {
  return drafts.length > 0 ? drafts : [createEmptyDeliverableDraft(item, allowedPlatforms)];
}

export function mergeDeliverableDraftsFromServer(
  prev: DeliverableDraft[],
  item: QuotationItemRow,
  allowedPlatforms: string[],
  options?: { preserveLocal?: boolean }
): DeliverableDraft[] {
  if (options?.preserveLocal) return prev;

  const fromServer = toDeliverableDrafts(item.deliverables);
  const prevByKey = new Map(prev.map((draft) => [draft.key, draft]));
  const consumedLocalKeys = new Set<string>();

  const mergedFromServer = fromServer.map((serverDraft, index) => {
    const matchedByKey = prevByKey.get(serverDraft.key);
    const localDraft = matchedByKey ?? prev[index];
    if (!localDraft) return serverDraft;

    if (!matchedByKey && prev[index]) {
      consumedLocalKeys.add(prev[index].key);
    }

    const localLines = localDraft.type_lines ?? deliverableTypeLines(localDraft);
    const serverLines = deliverableTypeLines(serverDraft);
    const fallback =
      localDraft.platform ||
      serverDraft.platform ||
      item.platform ||
      allowedPlatforms[0] ||
      "instagram";

    const typeSynced =
      localLines.length > serverLines.length
        ? syncDeliverableFromTypeLines(localLines, allowedPlatforms, fallback)
        : {};

    return {
      ...localDraft,
      ...serverDraft,
      ...typeSynced,
      key: serverDraft.key,
    };
  });

  const localPending = prev.filter(
    (draft) =>
      draft.key.startsWith("d-") &&
      !fromServer.some((serverDraft) => serverDraft.key === draft.key) &&
      !consumedLocalKeys.has(draft.key)
  );

  if (mergedFromServer.length > 0) {
    return ensureAtLeastOneDraft(
      [...mergedFromServer, ...localPending],
      item,
      allowedPlatforms
    );
  }
  if (localPending.length > 0) {
    return ensureAtLeastOneDraft(localPending, item, allowedPlatforms);
  }
  return [createEmptyDeliverableDraft(item, allowedPlatforms)];
}

export function toDeliverableDrafts(deliverables: QuotationDeliverable[]): DeliverableDraft[] {
  return deliverables.map((d, index) => {
    const { type, types } = normalizeDeliverableTypes(d);
    const type_lines = deliverableTypeLines(d);
    return {
      ...d,
      type,
      types,
      type_lines,
      key: `existing-${index}`,
    };
  });
}

export function fromDeliverableDrafts(drafts: DeliverableDraft[]): QuotationDeliverable[] {
  return drafts
    .map(({ key: _key, ...rest }) => {
      const type_lines = deliverableTypeLines(rest).filter((line) => line.type.trim());
      const types = type_lines.map((line) => line.type);
      return {
        platform: rest.platform?.trim() || "",
        type: types[0] ?? "",
        types: types.length ? types : undefined,
        type_lines: type_lines.length ? type_lines : undefined,
        quantity: Math.max(1, Number(rest.quantity) || 1),
        revenue: rest.revenue != null ? Number(rest.revenue) : null,
        service_description: rest.service_description?.trim() || null,
        commercial_input_mode: rest.commercial_input_mode,
        cost: rest.cost != null ? Number(rest.cost) : null,
        cost_currency: rest.cost_currency ?? null,
        gp_pct: rest.gp_pct != null ? Number(rest.gp_pct) : null,
        gp_value: rest.gp_value != null ? Number(rest.gp_value) : null,
        af_pct: rest.af_pct != null ? Number(rest.af_pct) : null,
      };
    })
    .filter(
      (d) =>
        d.type.trim() ||
        (d.types?.length ?? 0) > 0 ||
        (d.type_lines?.length ?? 0) > 0
    );
}
