import { z } from "zod";

// record_creator_payments derives IDs from md5(request || assignment)::uuid.
// PostgreSQL accepts these UUIDs without RFC version/variant bits.
export const paymentEntryIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "This payment reference is invalid. Refresh payment history and try again.",
);
