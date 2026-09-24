import { z } from "zod";

export const VENDOR_IO_PAYMENT_PRESETS = [
  "Due on receipt", "Net 15 Days from Invoice", "Net 30 Days from Invoice",
  "Net 45 Days from Invoice", "Net 60 Days from Invoice", "Net 90 Days from Invoice",
  "100% advance payment", "50% advance, 50% on completion",
] as const;

export const vendorIoCampaignTermsSchema = z.object({
  id: z.string().uuid(),
  campaign_header_id: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
  usage_rights: z.string().trim().max(2000),
  special_payment_terms: z.string().trim().max(500),
  compliance_country_code: z.enum(["", "AE", "EG"]),
});

export function vendorIoCampaignTermsPatch(input: z.infer<typeof vendorIoCampaignTermsSchema>, actorId: string) {
  return {
    usage_rights: input.usage_rights || null,
    special_payment_terms: input.special_payment_terms || null,
    compliance_country_code: input.compliance_country_code || null,
    updated_by: actorId,
  };
}
