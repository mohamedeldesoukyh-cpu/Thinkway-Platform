/**
 * Normative Commercial SSOT confirmation / lock copy.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md
 */

export function commercialSyncConfirmationCopy(input: {
  side: "quotation" | "campaign";
  quotationSerial: string | null;
  campaignDocumentNumber: string | null;
}): { title: string; description: string; confirmLabel: string } {
  if (input.side === "campaign") {
    const serial = input.quotationSerial?.trim() || "the linked Quotation";
    return {
      title: "Update linked Quotation?",
      description: [
        `This Campaign is linked to Quotation ${serial}.`,
        "",
        "Updating these commercial values will automatically update both the Quotation and the Campaign.",
        "",
        "Do you want to continue?",
      ].join("\n"),
      confirmLabel: "Continue",
    };
  }

  const campaign =
    input.campaignDocumentNumber?.trim() || "the linked Campaign";
  return {
    title: "Update linked Campaign?",
    description: [
      `This Quotation is linked to Campaign ${campaign}.`,
      "",
      "Updating these commercial values will automatically update both the Quotation and the Campaign.",
      "",
      "Do you want to continue?",
    ].join("\n"),
    confirmLabel: "Continue",
  };
}

export function financeLockConfirmationCopy(): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  return {
    title: "Commercial Revision required",
    description: [
      "This Campaign has already entered the finance process.",
      "",
      "Commercial values can no longer be edited directly.",
      "",
      "A Commercial Revision is required.",
      "",
      "Do you want to create a new Commercial Revision?",
    ].join("\n"),
    confirmLabel: "Create Commercial Revision",
  };
}

export const COMMERCIAL_SYNC_CONFIRMATION_REQUIRED =
  "COMMERCIAL_SYNC_CONFIRMATION_REQUIRED" as const;
