import type { QuotationClientBrandPendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationDetail } from "@/features/quotations/types";
import { clientBrandPendingDiffersFromDetail } from "@/lib/quotations/quotation-client-brand-pending-diff";

function baseDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: "q1",
    name: "Test",
    status: "draft",
    is_temporary_client: false,
    is_temporary_brand: false,
    temporary_client_name: null,
    temporary_brand_name: null,
    client_id: "client-1",
    brand_id: "brand-1",
    campaign_header_id: null,
    ...overrides,
  } as QuotationDetail;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// temporary name change
{
  const detail = baseDetail({
    is_temporary_client: true,
    is_temporary_brand: true,
    temporary_client_name: "Acme",
    temporary_brand_name: "Acme Brand",
    client_id: null,
    brand_id: null,
  });
  const payload: QuotationClientBrandPendingPayload = {
    useTemporary: true,
    temporary_client_name: "Acme Corp",
    temporary_brand_name: "Acme Brand",
  };
  assert(
    clientBrandPendingDiffersFromDetail(detail, payload),
    "temporary client name change should differ"
  );
}

// temporary unchanged
{
  const detail = baseDetail({
    is_temporary_client: true,
    is_temporary_brand: true,
    temporary_client_name: "Acme",
    temporary_brand_name: "Acme Brand",
    client_id: null,
    brand_id: null,
  });
  const payload: QuotationClientBrandPendingPayload = {
    useTemporary: true,
    temporary_client_name: "Acme",
    temporary_brand_name: "Acme Brand",
  };
  assert(
    !clientBrandPendingDiffersFromDetail(detail, payload),
    "matching temporary values should not differ"
  );
}

// master client switch
{
  const detail = baseDetail();
  const payload: QuotationClientBrandPendingPayload = {
    useTemporary: false,
    client_id: "client-2",
    brand_id: "brand-1",
    campaign_header_id: null,
  };
  assert(
    clientBrandPendingDiffersFromDetail(detail, payload),
    "master client change should differ"
  );
}

// switch temporary to master
{
  const detail = baseDetail({
    is_temporary_client: true,
    is_temporary_brand: true,
    temporary_client_name: "Temp",
    temporary_brand_name: "Temp Brand",
    client_id: null,
    brand_id: null,
  });
  const payload: QuotationClientBrandPendingPayload = {
    useTemporary: false,
    client_id: "client-1",
    brand_id: "brand-1",
    campaign_header_id: null,
  };
  assert(
    clientBrandPendingDiffersFromDetail(detail, payload),
    "switching from temporary to master should differ"
  );
}

// campaign only
{
  const detail = baseDetail({ campaign_header_id: null });
  const payload: QuotationClientBrandPendingPayload = {
    useTemporary: false,
    client_id: "client-1",
    brand_id: "brand-1",
    campaign_header_id: "camp-1",
  };
  assert(
    clientBrandPendingDiffersFromDetail(detail, payload),
    "campaign change should differ"
  );
}

console.log("quotation-client-brand-pending-diff tests passed");
