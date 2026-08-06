import type { ClientIoTerm } from "@/lib/io/client-io-terms";
import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";

/** Preset ids used by Client IO payment-terms chips / milestone templates. */
export type ClientIoPaymentTermsPresetId =
  | "advance"
  | "net_30"
  | "net_60"
  | "net_90"
  | "custom";

export type ClientIoPaymentTermsPreset = {
  id: ClientIoPaymentTermsPresetId;
  label: string;
  /** Short schedule label stored on `client_ios.billing_terms` and shown in Section 5. */
  billingTerms: string;
  /** Body for the "Payment Terms." clause in Section 8. */
  clauseBody: string;
  description: string;
};

const SUSPEND_CLAUSE =
  "Thinkway reserves the right to suspend any campaign activity in the event of payment delay, without further liability. All amounts are in the IO currency and include applicable VAT where stated.";

export const CLIENT_IO_PAYMENT_TERMS_PRESETS: ClientIoPaymentTermsPreset[] = [
  {
    id: "advance",
    label: "Advance",
    billingTerms: "Advance — Prior to campaign launch",
    clauseBody: `Full payment is due in advance prior to campaign launch. ${SUSPEND_CLAUSE}`,
    description: "Full payment before campaign launch.",
  },
  {
    id: "net_30",
    label: "30 days",
    billingTerms: "Net 30 Days",
    clauseBody: `Payment is due within thirty (30) days of Client IO approval / invoice date. ${SUSPEND_CLAUSE}`,
    description: "Net 30 from approval / invoice.",
  },
  {
    id: "net_60",
    label: "60 days",
    billingTerms: "Net 60 Days",
    clauseBody: `Payment is due within sixty (60) days of Client IO approval / invoice date. ${SUSPEND_CLAUSE}`,
    description: "Net 60 from approval / invoice.",
  },
  {
    id: "net_90",
    label: "90 days",
    billingTerms: "Net 90 Days",
    clauseBody: `Payment is due within ninety (90) days of Client IO approval / invoice date. ${SUSPEND_CLAUSE}`,
    description: "Net 90 from approval / invoice.",
  },
  {
    id: "custom",
    label: "Custom",
    billingTerms: "",
    clauseBody: "",
    description: "Define your own schedule and clause text.",
  },
];

export function getClientIoPaymentTermsPreset(
  id: ClientIoPaymentTermsPresetId
): ClientIoPaymentTermsPreset {
  return (
    CLIENT_IO_PAYMENT_TERMS_PRESETS.find((preset) => preset.id === id) ??
    CLIENT_IO_PAYMENT_TERMS_PRESETS[CLIENT_IO_PAYMENT_TERMS_PRESETS.length - 1]!
  );
}

export function isPaymentTermsClauseTitle(title: string): boolean {
  return /^payment\s*terms\.?$/i.test(title.trim());
}

/** Replace or insert the Payment Terms clause body; leaves other clauses untouched. */
export function applyPaymentTermsClause(
  terms: ClientIoTerm[],
  clauseBody: string
): ClientIoTerm[] {
  const body = clauseBody.trim();
  if (!body) return terms;

  const index = terms.findIndex((term) => isPaymentTermsClauseTitle(term.title));
  if (index >= 0) {
    return terms.map((term, i) =>
      i === index ? { ...term, title: "Payment Terms.", body } : term
    );
  }

  // Insert after Deemed Acceptance when present, otherwise after first term.
  const insertAt = Math.min(
    Math.max(
      terms.findIndex((term) => /deemed\s*acceptance/i.test(term.title)) + 1,
      1
    ),
    terms.length
  );
  const next = [...terms];
  next.splice(insertAt, 0, { title: "Payment Terms.", body });
  return next;
}

export function buildNetDaysMilestone(days: 30 | 60 | 90): ClientIoMilestoneDraft[] {
  return [
    {
      label: `Net ${days} Days`,
      milestoneKind: "upfront",
      percent: 100,
      dueTrigger: "on_approval",
      dueOffsetDays: days,
      dueDate: null,
      notes: `Payment due within ${days} days of Client IO approval / invoice.`,
      sortOrder: 1,
    },
  ];
}

export function detectClientIoPaymentTermsPreset(input: {
  billingTerms: string | null | undefined;
  milestones: ClientIoMilestoneDraft[];
}): ClientIoPaymentTermsPresetId {
  const billing = input.billingTerms?.trim().toLowerCase() ?? "";
  if (billing.includes("advance") || billing.includes("prior to campaign")) {
    return "advance";
  }
  if (/\b90\b/.test(billing) || billing.includes("net 90") || billing.includes("net_90")) {
    return "net_90";
  }
  if (/\b60\b/.test(billing) || billing.includes("net 60") || billing.includes("net_60")) {
    return "net_60";
  }
  if (/\b30\b/.test(billing) || billing.includes("net 30") || billing.includes("net_30")) {
    return "net_30";
  }

  if (input.milestones.length === 1) {
    const only = input.milestones[0]!;
    if (only.percent === 100 && only.dueTrigger === "on_approval") {
      if (only.dueOffsetDays === 90) return "net_90";
      if (only.dueOffsetDays === 60) return "net_60";
      if (only.dueOffsetDays === 30) return "net_30";
      if (!only.dueOffsetDays) return "advance";
    }
  }

  if (input.milestones.length === 0 && !billing) return "advance";
  return "custom";
}
