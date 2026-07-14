import type { QuotationClientBrandPendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationDetail } from "@/features/quotations/types";

function strOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function clientBrandPendingDiffersFromDetail(
  detail: QuotationDetail,
  payload: QuotationClientBrandPendingPayload
): boolean {
  const detailUsesTemporary = detail.is_temporary_client || detail.is_temporary_brand;

  if (payload.useTemporary) {
    if (!detailUsesTemporary) return true;
    return (
      strOrEmpty(payload.temporary_client_name) !==
        strOrEmpty(detail.temporary_client_name) ||
      strOrEmpty(payload.temporary_brand_name) !== strOrEmpty(detail.temporary_brand_name)
    );
  }

  if (detailUsesTemporary) return true;

  return (
    (payload.client_id ?? null) !== (detail.client_id ?? null) ||
    (payload.brand_id ?? null) !== (detail.brand_id ?? null) ||
    (payload.campaign_header_id ?? null) !== (detail.campaign_header_id ?? null)
  );
}
