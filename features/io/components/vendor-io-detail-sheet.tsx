"use client";

import Link from "next/link";
import { BriefcaseIcon, MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DetailField,
  DetailFieldGroup,
  DetailPill,
  DetailPanelHeader,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import { VendorIoDocumentActions } from "@/features/io/components/vendor-io-document-actions";
import { VendorIoDeliveryBadge } from "@/features/io/components/vendor-io-delivery-badge";
import { VendorIoManualApproveButton } from "@/features/io/components/vendor-io-manual-approve-button";
import { VendorIoSendButton } from "@/features/io/components/vendor-io-send-button";
import { VendorIoSignedAttachmentField } from "@/features/io/components/vendor-io-signed-attachment-field";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { IoTermsSourceBadge } from "@/features/io/components/io-terms-source-badge";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";
import { formatVendorIoDeliveryLabel } from "@/lib/io/vendor-io-delivery";
import {
  formatAssignmentDetailDate,
  initialsFromName,
} from "@/lib/campaigns/assignment-detail-presenters";
import { formatMoney } from "@/features/campaigns/utils";
import {
  parseTermsText,
  resolveEffectiveVendorIoTerms,
  resolveIoTermsSource,
} from "@/lib/io/client-io-terms";

type VendorIoDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: VendorIoRow | null;
  campaignId: string;
};

function formatIoDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function VendorIoGeneralTab({ row }: { row: VendorIoRow }) {
  return (
    <div className="space-y-3 px-0.5">
      <DetailFieldGroup title="Order">
        <DetailField label="IO #">
          <DocumentNumber value={row.document_number} />
        </DetailField>
        <DetailField label="Assignment">
          <DocumentNumber value={row.assignment_document_number} />
        </DetailField>
        <DetailField label="Influencer">
          <span className="inline-flex items-center justify-end gap-1.5">
            <BriefcaseIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {row.influencer_id ? (
              <Link
                href={`/vendors/${row.influencer_id}`}
                className="hover:text-primary hover:underline"
              >
                {row.influencer_name}
              </Link>
            ) : (
              row.influencer_name
            )}
          </span>
        </DetailField>
        <DetailField label="Campaign">
          <div className="min-w-0">
            <DocumentNumber value={row.campaign_document_number} />
            <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
              {row.campaign_name}
            </p>
          </div>
        </DetailField>
      </DetailFieldGroup>
      <DetailFieldGroup title="Commercial">
        <DetailField label="Amount">
          {formatMoney(row.amount, row.currency_code)}
        </DetailField>
        <DetailField label="Currency">
          <DetailPill>{row.currency_code}</DetailPill>
        </DetailField>
        <DetailField label="Workflow Status">
          <IoStatusBadge status={row.status} />
        </DetailField>
        <DetailField label="Delivery">
          {formatVendorIoDeliveryLabel(row.delivery_method, row.delivery_status) ? (
            <VendorIoDeliveryBadge
              deliveryMethod={row.delivery_method}
              deliveryStatus={row.delivery_status}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </DetailField>
      </DetailFieldGroup>
      <DetailFieldGroup title="Lifecycle">
        <DetailField label="Ungenerate" valueClassName="max-w-[70%]">
          {row.ungenerate_eligible ? (
            <DetailPill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
              Eligible
            </DetailPill>
          ) : (
            <span className="text-muted-foreground">
              {row.ungenerate_ineligible_reason ?? "Not eligible"}
            </span>
          )}
        </DetailField>
      </DetailFieldGroup>
    </div>
  );
}

function VendorIoTermsTab({ row }: { row: VendorIoRow }) {
  const termsHtml = row.terms_html?.trim();
  const ioTerms = parseTermsText(row.terms_text);
  const vendorTerms = parseTermsText(row.vendor_io_terms_text);
  const effective = resolveEffectiveVendorIoTerms(
    row.vendor_io_terms_text,
    row.terms_text
  );
  const source = resolveIoTermsSource(vendorTerms, ioTerms);

  return (
    <div className="space-y-3 px-0.5">
      <DetailFieldGroup title="Commercial terms">
        <DetailField label="Usage rights" valueClassName="max-w-[70%]">
          {row.usage_rights?.trim() || "—"}
        </DetailField>
        <DetailField label="Exclusivity" valueClassName="max-w-[70%]">
          {row.exclusivity?.trim() || "—"}
        </DetailField>
        <DetailField label="Vendor payment terms" valueClassName="max-w-[70%]">
          {row.vendor_payment_terms_label || "—"}
        </DetailField>
        <DetailField label="Special payment terms" valueClassName="max-w-[70%]">
          {row.special_payment_terms?.trim() || "—"}
        </DetailField>
        <DetailField label="IO payment schedule" valueClassName="max-w-[70%]">
          {row.effective_payment_terms_label || "—"}
        </DetailField>
        <VendorIoSignedAttachmentField row={row} />
      </DetailFieldGroup>
      <DetailFieldGroup title="Terms & conditions">
        <div className="py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <IoTermsSourceBadge source={source} />
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            {effective.map((term, index) => (
              <li key={index} className="break-words">
                <span className="font-medium">{index + 1}. {term.title}</span>{" "}
                <span className="text-muted-foreground">{term.body}</span>
              </li>
            ))}
          </ul>
        </div>
        {termsHtml ? (
          <div className="border-t border-border/40 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Generated document HTML
            </p>
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {termsHtml}
            </p>
          </div>
        ) : null}
      </DetailFieldGroup>
    </div>
  );
}

function VendorIoActivityTab({ row }: { row: VendorIoRow }) {
  return (
    <div className="space-y-3 px-0.5">
      <DetailFieldGroup title="Timeline">
        <DetailField label="Document generated">
          {formatIoDateTime(row.document_generated_at)}
        </DetailField>
        <DetailField label="Sent">{formatIoDateTime(row.sent_at)}</DetailField>
        <DetailField label="Approved">{formatIoDateTime(row.approved_at)}</DetailField>
        <DetailField label="Approved by">{row.approved_by_name?.trim() || "—"}</DetailField>
        {row.status === "rejected" ? (
          <DetailField label="Rejection reason" valueClassName="max-w-[70%]">
            {row.rejection_reason?.trim() || "—"}
          </DetailField>
        ) : null}
        <DetailField label="Created">
          {formatAssignmentDetailDate(row.created_at)}
        </DetailField>
        <DetailField label="Updated">
          {formatAssignmentDetailDate(row.updated_at)}
        </DetailField>
      </DetailFieldGroup>
    </div>
  );
}

export function VendorIoDetailSheet({
  open,
  onOpenChange,
  row,
  campaignId,
}: VendorIoDetailSheetProps) {
  const ioLabel = row?.document_number ?? "Vendor IO";
  const title = row?.influencer_name ?? ioLabel;

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} vendor IO details`}
      description={`Vendor IO details for ${ioLabel}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading vendor IO details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {row.campaign_name}
                <span className="text-muted-foreground/60"> / </span>
                <DocumentNumber value={row.document_number} className="text-foreground/80" />
              </>
            }
            avatarInitials={initialsFromName(row.influencer_name)}
            title={row.influencer_name}
            badges={
              <>
                <IoStatusBadge status={row.status} />
                <VendorIoDeliveryBadge
                  deliveryMethod={row.delivery_method}
                  deliveryStatus={row.delivery_status}
                />
                <DetailPill>{formatMoney(row.amount, row.currency_code)}</DetailPill>
                <DocumentNumber
                  value={row.document_number}
                  className="text-[11px] text-muted-foreground"
                />
              </>
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="shrink-0">
                    <MoreHorizontalIcon className="size-4" />
                    <span className="sr-only">Vendor IO actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/ios/vendor?campaign=${campaignId}&io=${row.id}`}>View full IO</a>
                  </DropdownMenuItem>
                  {row.influencer_id ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/vendors/${row.influencer_id}`}>View vendor profile</Link>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
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
                <TabsTrigger value="terms" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Terms
                </TabsTrigger>
                <TabsTrigger value="activity" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Activity
                </TabsTrigger>
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 outline-none">
                <VendorIoGeneralTab row={row} />
              </TabsContent>
              <TabsContent value="terms" className="mt-0 outline-none">
                <VendorIoTermsTab row={row} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0 outline-none">
                <VendorIoActivityTab row={row} />
              </TabsContent>
            </div>
          </Tabs>

          <div className="shrink-0 border-t border-border/60 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <VendorIoDocumentActions row={row} showSend={false} />
              <div className="flex flex-wrap items-center gap-2">
                <VendorIoSendButton row={row} />
                <VendorIoManualApproveButton row={row} />
                <VendorIoUngenerateTrigger
                  row={row}
                  disabled={!row.ungenerate_eligible}
                  title={row.ungenerate_ineligible_reason ?? undefined}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </OperationalDetailSheet>
  );
}
