export type QuotationTermSection = {
  title: string;
  body: string;
};

/** Default client quotation terms — editable per quotation; persisted in `quotations.terms`. */
export const QUOTATION_DEFAULT_TERMS: QuotationTermSection[] = [
  {
    title: "Quotation Validity",
    body: "This quotation is valid for the period stated on the cover page. Pricing, creator availability, and deliverables are subject to change after the validity date.",
  },
  {
    title: "Payment Terms",
    body: "Full payment is due in advance prior to campaign launch unless otherwise agreed in writing. Thinkway reserves the right to suspend any campaign activity in the event of payment delay, without further liability. All amounts are exclusive of applicable taxes unless stated otherwise.",
  },
  {
    title: "Content Approval",
    body: "The Client shall review and approve influencer content within two (2) business days of submission. Failure to respond within this period shall constitute approval to publish.",
  },
  {
    title: "Usage Rights",
    body: "Usage rights are limited to the campaign period and channels specified in this quotation unless extended usage is explicitly quoted and agreed in writing.",
  },
  {
    title: "Creator Availability",
    body: "Creator participation is subject to final confirmation. Thinkway will propose suitable alternatives of comparable reach and profile should a listed creator become unavailable.",
  },
  {
    title: "Taxes",
    body: "Quoted amounts exclude VAT and withholding taxes unless explicitly stated. Applicable taxes will be added to invoices in accordance with Egyptian tax regulations.",
  },
  {
    title: "Cancellation",
    body: "Cancellation or material amendment requests must be submitted in writing at least seven (7) business days before the scheduled campaign start. Fees for work performed and non-recoverable creator commitments may apply.",
  },
  {
    title: "Confidentiality",
    body: "This quotation, including pricing, creator identities, and campaign strategy, is confidential and prepared exclusively for the named Client. It may not be shared with third parties without Thinkway's prior written consent.",
  },
];

export function formatQuotationTermsText(
  sections: QuotationTermSection[] = QUOTATION_DEFAULT_TERMS
): string {
  return sections.map((s) => `${s.title}\n${s.body}`).join("\n\n");
}

export function parseQuotationTermsText(text: string | null | undefined): QuotationTermSection[] {
  if (!text?.trim()) return QUOTATION_DEFAULT_TERMS;
  const blocks = text.split(/\n\n+/).filter(Boolean);
  const parsed: QuotationTermSection[] = [];
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    if (nl === -1) {
      parsed.push({ title: block.trim(), body: "" });
    } else {
      parsed.push({
        title: block.slice(0, nl).trim(),
        body: block.slice(nl + 1).trim(),
      });
    }
  }
  return parsed.length ? parsed : QUOTATION_DEFAULT_TERMS;
}
