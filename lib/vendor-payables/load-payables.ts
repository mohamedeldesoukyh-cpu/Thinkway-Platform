import type { SupabaseClient } from "@supabase/supabase-js";

import { roundMoney } from "@/lib/analytics/aggregations/round";
import { devLog } from "@/lib/platform/logger";

export type PayableStatus =
  | "pending"
  | "approved"
  | "scheduled"
  | "paid"
  | "disputed";

export type VendorPayableRow = {
  id: string;
  assignment_id: string;
  influencer_name: string;
  campaign_name: string;
  agreed_fee: number;
  currency: string;
  status: PayableStatus;
  due_hint: string | null;
};

export type VendorPayablesPayload = {
  rows: VendorPayableRow[];
  total_pending: number;
  total_paid: number;
  aging: { label: string; count: number; amount: number }[];
};

function mapVendorStatus(raw: string): PayableStatus {
  switch (raw) {
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "cancelled":
      return "disputed";
    default:
      return "pending";
  }
}

export async function loadVendorPayables(
  supabase: SupabaseClient
): Promise<VendorPayablesPayload> {
  const { data, error } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id, agreed_fee, currency, vendor_payment_status, vendor_paid_at,
      influencer:influencers(id, display_name, full_name),
      campaign:campaign_headers(id, name)
    `
    )
    .in("vendor_payment_status", ["unpaid", "pending", "paid"])
    .limit(300);

  if (error) throw new Error(error.message);

  const rows: VendorPayableRow[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      agreed_fee: number;
      currency: string;
      vendor_payment_status: string;
      influencer:
        | { display_name: string | null; full_name: string | null }
        | { display_name: string | null; full_name: string | null }[]
        | null;
      campaign: { name: string } | { name: string }[] | null;
    };
    const influencer = Array.isArray(r.influencer) ? r.influencer[0] : r.influencer;
    const campaign = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
    const status = mapVendorStatus(r.vendor_payment_status);
    return {
      id: r.id,
      assignment_id: r.id,
      influencer_name:
        influencer?.display_name ?? influencer?.full_name ?? "Vendor",
      campaign_name: campaign?.name ?? "Campaign",
      agreed_fee: Number(r.agreed_fee),
      currency: r.currency,
      status,
      due_hint: null,
    };
  });

  const total_pending = roundMoney(
    rows
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + r.agreed_fee, 0)
  );
  const total_paid = roundMoney(
    rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.agreed_fee, 0)
  );

  const pendingRows = rows.filter((r) => r.status !== "paid");
  const aging = [
    { label: "Pending", count: pendingRows.length, amount: total_pending },
    { label: "Paid", count: rows.length - pendingRows.length, amount: total_paid },
  ];

  if (process.env.NODE_ENV === "development") {
    devLog("[vendor-payables] loaded", { rows: rows.length, total_pending });
  }

  return { rows, total_pending, total_paid, aging };
}
