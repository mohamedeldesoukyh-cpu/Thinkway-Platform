import type { AgencyOrDirect } from "@/types/database";

export type BrandFormOption = {
  id: string;
  name: string;
  client_id: string;
  group_id: string;
  currency_code: string;
  agency_or_direct: AgencyOrDirect | null;
  group: { id: string; name: string } | null;
  client: { id: string; name: string; legal_name: string | null } | null;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  vr_rate: { id: string; name: string; rate_percent: number } | null;
};
