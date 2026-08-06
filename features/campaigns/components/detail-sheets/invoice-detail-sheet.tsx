"use client";

import { format } from "date-fns";

import { InvoiceStatusBadge } from "@/components/finance/invoice-status-badge";
import { InvoiceViewMenu } from "@/features/billing/components/invoice-view-menu";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  DetailField,
  DetailFieldGroup,
  DetailPanelHeader,
  DetailPill,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import { formatMoney } from "@/features/campaigns/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InvoiceDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: FinanceInvoiceRegisterRow | null;
};

function formatInvoiceDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "MMM d, yyyy");
}

export function InvoiceDetailSheet({ open, onOpenChange, row }: InvoiceDetailSheetProps) {
  const title = row?.document_number ?? "Invoice";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} invoice details`}
      description="Client invoice details"
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading invoice details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {row.client_name}
                <span className="text-muted-foreground/60"> / </span>
                <DocumentNumber value={row.document_number} className="text-foreground/80" />
              </>
            }
            avatarInitials="INV"
            title={
              <DocumentNumber value={row.document_number} className="text-lg font-semibold" />
            }
            badges={
              <>
                <InvoiceStatusBadge
                  status={row.status}
                  regeneration_status={row.regeneration_status}
                  metadata={row.metadata}
                />
                {row.regeneration_status === "pending_regeneration" ? (
                  <DetailPill className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                    Pending regeneration
                  </DetailPill>
                ) : null}
                <DetailPill className="capitalize">{row.locked_status}</DetailPill>
              </>
            }
          />

          <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
            <DetailTabList>
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-4 rounded-none bg-transparent p-0"
              >
                <TabsTrigger value="general" className={DETAIL_TAB_TRIGGER_CLASS}>
                  General
                </TabsTrigger>
                <TabsTrigger value="amounts" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Amounts
                </TabsTrigger>
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 outline-none">
                <div className="space-y-3 px-0.5">
                  <DetailFieldGroup title="Invoice">
                    <DetailField label="Invoice #">
                      <DocumentNumber value={row.document_number} />
                    </DetailField>
                    <DetailField label="Client">{row.client_name}</DetailField>
                    <DetailField label="Brand">{row.brand_name ?? "—"}</DetailField>
                    <DetailField label="Campaign">
                      {row.campaign_name ? (
                        <div className="min-w-0">
                          <p className="break-words leading-snug">{row.campaign_name}</p>
                          {row.campaign_document_number ? (
                            <DocumentNumber
                              value={row.campaign_document_number}
                              className="text-[11px] text-muted-foreground"
                            />
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="Created">{formatInvoiceDate(row.created_date)}</DetailField>
                    <DetailField label="Currency">
                      <DetailPill>{row.currency}</DetailPill>
                    </DetailField>
                  </DetailFieldGroup>
                </div>
              </TabsContent>
              <TabsContent value="amounts" className="mt-0 outline-none">
                <div className="space-y-3 px-0.5">
                  <DetailFieldGroup title="Amounts">
                    <DetailField label="Revenue before VAT">
                      {formatMoney(row.revenue_before_vat, row.currency)}
                    </DetailField>
                    <DetailField label="VAT">
                      {formatMoney(row.vat_amount, row.currency)}
                    </DetailField>
                    <DetailField label="Revenue after VAT">
                      {formatMoney(row.revenue_after_vat, row.currency)}
                    </DetailField>
                  </DetailFieldGroup>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="shrink-0 border-t border-border/60 px-6 py-4">
            <div className="flex flex-wrap justify-end gap-2">
              <InvoiceViewMenu invoiceId={row.id} />
              <Button size="sm" variant="outline" asChild>
                <a href={`/billing/invoices/${row.id}`}>Open full invoice</a>
              </Button>
            </div>
          </div>
        </>
      )}
    </OperationalDetailSheet>
  );
}
