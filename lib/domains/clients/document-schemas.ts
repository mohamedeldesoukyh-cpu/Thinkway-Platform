import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const uploadClientDocumentSchema = z.object({
  client_id: z.string().uuid(),
  document_type: z.enum([
    "trade_license",
    "vat_certificate",
    "tax_certificate",
    "nda",
    "msa_contract",
    "sow",
  ]),
  expires_at: optionalDate,
});
