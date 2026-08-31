import Link from "next/link";

import { CreatorEmpty, CreatorKpis, CreatorMoneyStrip } from "@/features/creator-workspace/components/creator-workspace-ui";
import { creatorPaymentExplanationForRow, creatorPaymentIsOutstanding } from "@/features/creator-workspace/payment-copy";
import type {
  CreatorCampaignRow,
  CreatorPaymentRow,
  CreatorVendorIoRow,
} from "@/features/portals/types";
import { formatPortalCurrency } from "@/features/portals/components/portal-table-utils";

export function CreatorProfilePayments({
  rows,
  vendorIos = [],
  campaigns = [],
}: {
  rows: CreatorPaymentRow[];
  vendorIos?: CreatorVendorIoRow[];
  campaigns?: CreatorCampaignRow[];
}) {
  if (rows.length === 0) {
    return (
      <CreatorEmpty
        title="No payment records yet"
        description="Amounts appear here once you are assigned to a campaign."
      />
    );
  }

  const currencies = new Set(rows.map((row) => row.currency_code));
  const sameCurrency = currencies.size === 1;
  const currency = rows[0]?.currency_code ?? "EGP";
  const agreed = rows.reduce((sum, row) => sum + row.agreed_amount, 0);
  const paid = rows.reduce((sum, row) => sum + row.paid_amount, 0);
  const pending = rows.reduce((sum, row) => sum + row.pending_amount, 0);

  return (
    <>
      {sameCurrency ? (
        <CreatorKpis
          columns={3}
          items={[
            {
              label: "Total agreed",
              value: formatPortalCurrency(agreed, currency),
              hint: `Across ${rows.length} campaign${rows.length === 1 ? "" : "s"}`,
              valueSize: "md",
            },
            {
              label: "Paid to date",
              value: formatPortalCurrency(paid, currency),
              hint: "Received",
              tone: "ok",
              valueSize: "md",
            },
            {
              label: "Pending",
              value: formatPortalCurrency(pending, currency),
              hint: "Awaiting transfer",
              tone: "pend",
              valueSize: "md",
            },
          ]}
        />
      ) : null}
      {rows.map((row) => {
        const io = vendorIos.find((item) => item.assignment_id === row.assignment_id);
        const campaign = campaigns.find(
          (item) => item.campaign_header_id === row.campaign_header_id
        );
        const outstanding = creatorPaymentIsOutstanding(row.payment_status) || row.pending_amount > 0;
        return (
          <section key={row.assignment_id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="sec" style={{ fontSize: 15 }}>
                  <Link href={`/creator-portal/campaigns/${row.campaign_header_id}?tab=payment`} className="cw-link">
                    {row.campaign_name}
                  </Link>
                </h2>
                <p className="note" style={{ marginTop: 2 }}>
                  {campaign?.campaign_document_number ?? ""}
                  {campaign?.campaign_document_number ? " · " : ""}
                  {creatorPaymentExplanationForRow(row, {
                    vendorIoStatus: io?.status ?? campaign?.vendor_io_status,
                    pendingDeliverables: campaign?.pending_deliverables,
                  })}
                </p>
              </div>
              <span className={outstanding ? "pill pill--pend" : "pill pill--ok"}>
                {outstanding ? "Pending" : "Paid"}
              </span>
            </div>
            <CreatorMoneyStrip
              agreed={formatPortalCurrency(row.agreed_amount, row.currency_code)}
              invoiced={formatPortalCurrency(row.invoiced_amount, row.currency_code)}
              paid={formatPortalCurrency(row.paid_amount, row.currency_code)}
              pending={formatPortalCurrency(row.pending_amount, row.currency_code)}
              pendingOutstanding={row.pending_amount > 0}
            />
          </section>
        );
      })}
    </>
  );
}
