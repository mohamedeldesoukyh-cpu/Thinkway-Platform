"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageBackButton } from "@/components/navigation/page-back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuotationCommercialMetricsBand } from "@/features/quotations/components/quotation-commercial-metrics-band";
import { QuotationLifecyclePills } from "@/features/quotations/components/quotation-lifecycle-pills";
import { QuotationLifecycleSheet } from "@/features/quotations/components/quotation-lifecycle-sheet";
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge";
import { QuotationValidityBar } from "@/features/quotations/components/quotation-validity-bar";
import { buildExportHref } from "@/features/quotations/components/quotation-preview-downloads";
import { QUOTATIONS_LIST_PATH } from "@/features/quotations/constants";
import { archiveQuotation, updateQuotationHeader } from "@/features/quotations/actions";
import {
  QUOTATION_TEMPLATE_OPTIONS as TEMPLATE_OPTIONS,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";
import type { PromoteWizardOptions, QuotationDetail } from "@/features/quotations/types";

function quotationPreviewHref(
  quotationId: string,
  template: QuotationTemplateVariant
): string {
  const params = new URLSearchParams();
  appendQuotationTemplateParam(params, template);
  const query = params.toString();
  return `/discovery/quotations/${quotationId}/preview${query ? `?${query}` : ""}`;
}

type Props = {
  detail: QuotationDetail;
  promoteOptions: PromoteWizardOptions;
  totals: {
    totalCostEgp: number;
    totalRevenueEgp: number;
    totalGpValueEgp: number;
    totalGpPct: number;
    totalPmPct: number;
  };
  saveStatus: AutosaveStatus;
  hasUnsavedChanges: boolean;
  savePending: boolean;
  onSave: () => void;
  exportTemplate: QuotationTemplateVariant;
  onExportTemplateChange: (template: QuotationTemplateVariant) => void;
  uniqueCreatorCount: number;
};

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--camp-text-3)]">
        <Loader2Icon className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (status === "pending")
    return <span className="text-[10px] text-[var(--camp-amber)]">Unsaved</span>;
  if (status === "error")
    return <span className="text-[10px] text-[var(--camp-red)]">Save failed</span>;
  return null;
}

export function QuotationWorkspaceHeader({
  detail,
  promoteOptions,
  totals,
  saveStatus,
  hasUnsavedChanges,
  savePending,
  onSave,
  exportTemplate,
  onExportTemplateChange,
  uniqueCreatorCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<"links" | "activity">("links");

  function runStatus(status: "under_review" | "cancelled") {
    startTransition(async () => {
      const res = await updateQuotationHeader({ id: detail.id, status });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(status === "under_review" ? "Submitted for review." : "Quotation cancelled.");
      router.refresh();
    });
  }

  function runArchive() {
    startTransition(async () => {
      const res = await archiveQuotation(detail.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Quotation archived.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="thinkway-campaign-header shrink-0">
        <div className="thinkway-campaign-header-inner">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={QUOTATIONS_LIST_PATH}
              label="Back to quotations"
              className="thinkway-campaign-back-btn size-[26px] rounded-[var(--camp-radius)] p-0 hover:bg-[var(--camp-surface)]"
            />
            <h1 className="thinkway-campaign-title truncate">{detail.name}</h1>
            <QuotationStatusBadge status={detail.status} className="thinkway-campaign-status-chip" />
            <SaveIndicator status={saveStatus} />
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              {detail.canManage ? (
                <button
                  type="button"
                  className="thinkway-campaign-btn thinkway-campaign-btn-primary"
                  disabled={savePending || !hasUnsavedChanges}
                  onClick={onSave}
                >
                  {savePending ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SaveIcon className="size-3.5" />
                  )}
                  Save
                </button>
              ) : null}
              <button
                type="button"
                className="thinkway-campaign-btn"
                onClick={() => {
                  setLifecycleTab("links");
                  setLifecycleOpen(true);
                }}
              >
                Links &amp; Actions
              </button>
              <button
                type="button"
                className="thinkway-campaign-btn"
                onClick={() => {
                  setLifecycleTab("activity");
                  setLifecycleOpen(true);
                }}
              >
                Activity
              </button>
              {detail.canManage && detail.status === "draft" ? (
                <button
                  type="button"
                  className="thinkway-campaign-btn thinkway-campaign-btn-primary"
                  disabled={pending}
                  onClick={() => runStatus("under_review")}
                >
                  Submit for review
                </button>
              ) : null}
              {detail.canManage && detail.status !== "cancelled" && detail.status !== "archived" ? (
                <button
                  type="button"
                  className="thinkway-campaign-btn"
                  disabled={pending}
                  onClick={() => runStatus("cancelled")}
                >
                  Cancel
                </button>
              ) : null}
              {detail.canManage && !detail.is_archived ? (
                <button
                  type="button"
                  className="thinkway-campaign-btn thinkway-campaign-btn-danger"
                  disabled={pending}
                  onClick={runArchive}
                >
                  Archive
                </button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="thinkway-campaign-btn" aria-label="Export options">
                    <MoreHorizontalIcon className="size-3.5" />
                    Export
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {TEMPLATE_OPTIONS.map((option) => {
                    // Bake template into each href so PDF/Word/Excel do not use a
                    // stale exportTemplate from a prior selection in the same menu.
                    const templateExportHref = (format: string) =>
                      buildExportHref(detail.id, format, option.id, { download: true });
                    const templatePreviewHref = quotationPreviewHref(detail.id, option.id);

                    return (
                      <DropdownMenuSub key={option.id}>
                        <DropdownMenuSubTrigger
                          className={cn(exportTemplate === option.id && "bg-muted")}
                          onPointerEnter={() => onExportTemplateChange(option.id)}
                          onFocus={() => onExportTemplateChange(option.id)}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>{option.label}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {option.hint}
                            </span>
                          </span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                          <DropdownMenuItem asChild>
                            <Link
                              href={templatePreviewHref}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => onExportTemplateChange(option.id)}
                            >
                              <FileTextIcon className="size-4" /> Preview
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={templateExportHref("excel")}
                              onClick={() => onExportTemplateChange(option.id)}
                            >
                              <FileSpreadsheetIcon className="size-4" /> Excel
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={templateExportHref("word")}
                              onClick={() => onExportTemplateChange(option.id)}
                            >
                              <DownloadIcon className="size-4" /> Word
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={templateExportHref("pdf")}
                              onClick={() => onExportTemplateChange(option.id)}
                            >
                              <DownloadIcon className="size-4" /> PDF
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="thinkway-campaign-meta">
            {detail.serial_number ?? "QT-PENDING"}
            {detail.shortlist_id ? (
              <>
                {" · Linked shortlist "}
                <Link
                  href={`/discovery/shortlists/${detail.shortlist_id}`}
                  className="thinkway-campaign-link"
                >
                  {detail.shortlist_serial ?? detail.shortlist_id}
                </Link>
              </>
            ) : null}
            {detail.client_name ? ` · ${detail.client_name}` : null}
            {detail.owner_name ? ` · Owner: ${detail.owner_name}` : null}
          </p>
          <QuotationCommercialMetricsBand
            totalCostEgp={totals.totalCostEgp}
            totalRevenueEgp={totals.totalRevenueEgp}
            totalGpValueEgp={totals.totalGpValueEgp}
            totalGpPct={totals.totalGpPct}
            totalPmPct={totals.totalPmPct}
            gpTargetPct={detail.gp_target_pct}
            creatorCount={uniqueCreatorCount}
            version={detail.version}
            validDaysRemaining={detail.valid_days_remaining}
          />
        </div>
        <QuotationLifecyclePills detail={detail} />
        <QuotationValidityBar
          validityDate={detail.validity_date}
          validDaysRemaining={detail.valid_days_remaining}
          isExpired={detail.is_expired}
        />
      </div>

      <QuotationLifecycleSheet
        detail={detail}
        promoteOptions={promoteOptions}
        open={lifecycleOpen}
        onOpenChange={setLifecycleOpen}
        defaultTab={lifecycleTab}
      />
    </>
  );
}
