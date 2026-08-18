"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  Link2Icon,
  Loader2Icon,
  MoreHorizontalIcon,
  SaveIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createClientReviewFromQuotationAction } from "@/features/client-workspace/actions/create-from-quotation-action";
import { revealClientReviewLinkAction } from "@/features/client-workspace/actions/reveal-client-review-link-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher-lazy";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { seedFromQuotation } from "@/features/campaign-outputs/hydration/seed-adapters";
import { QuotationLifecycleSheet } from "@/features/quotations/components/quotation-lifecycle-sheet";
import { QuotationPreviewToolbarActions } from "@/features/quotations/components/quotation-preview-toolbar-actions";
import { QuotationToolbarButton } from "@/features/quotations/components/quotation-detail-primitives";
import { QuotationWorkspaceStatusPill } from "@/features/quotations/components/quotation-list-status-pill";
import { archiveQuotation, updateQuotationHeader } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationTemplateVariant } from "@/features/quotations/export/quotation-template";
import type { PromoteWizardOptions, QuotationDetail } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  promoteOptions: PromoteWizardOptions;
  hasUnsavedChanges: boolean;
  savePending: boolean;
  onSave: () => void;
  exportTemplate: QuotationTemplateVariant;
  onExportTemplateChange: (template: QuotationTemplateVariant) => void;
  selectedItemIds?: string[];
  onSelectedItemIdsChange?: (itemIds: string[]) => void;
};

export function QuotationWorkspaceHeader({
  detail,
  promoteOptions,
  hasUnsavedChanges,
  savePending,
  onSave,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<"links" | "activity">("links");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(undefined);
  const campaignSeed = useMemo(() => seedFromQuotation(detail), [detail]);
  const shareScope = { source: "quotation" as const, id: detail.id };

  function rememberShare(url: string, reviewNumber: number) {
    setShareUrl(url);
    setShareReviewNumber(reviewNumber);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) rememberClientReviewShare(shareScope, { url, reviewNumber, reviewId });
  }

  function runSendToClient() {
    startTransition(async () => {
      const res = await createClientReviewFromQuotationAction({ quotationId: detail.id });
      if (!res.ok) {
        toast.error(res.message, {
          description: res.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
      } catch {
        /* clipboard is optional — the share dialog still shows the URL */
      }
      rememberShare(res.url, res.reviewNumber);
      setShareOpen(true);
      toast.success(res.message);
    });
  }

  function runShowLink() {
    startTransition(async () => {
      const cached = readClientReviewShare(shareScope);
      if (cached) {
        setShareUrl(cached.url);
        setShareReviewNumber(cached.reviewNumber);
        setShareOpen(true);
        return;
      }
      const res = await revealClientReviewLinkAction({
        source: "quotation",
        quotationId: detail.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      rememberShare(res.url, res.reviewNumber);
      setShareOpen(true);
    });
  }

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

  const metaNodes: ReactNode[] = [];
  if (detail.shortlist_id) {
    metaNodes.push(
      <span key="shortlist">
        <span className="k">Linked shortlist </span>
        <Link href={`/discovery/shortlists/${detail.shortlist_id}`}>
          {detail.shortlist_serial ?? detail.shortlist_id}
        </Link>
      </span>
    );
  }
  if (detail.client_name) {
    metaNodes.push(
      <span key="client">
        <span className="k">Legal entity </span>
        <span className="v">{detail.client_name}</span>
      </span>
    );
  }
  if (detail.brand_name) {
    metaNodes.push(
      <span key="brand">
        <span className="k">Brand </span>
        <span className="v">{detail.brand_name}</span>
      </span>
    );
  }
  if (detail.owner_name) {
    metaNodes.push(
      <span key="owner">
        <span className="k">Owner </span>
        <span className="v">{detail.owner_name}</span>
      </span>
    );
  }

  return (
    <>
      <div className="wtop">
        <div className="wtop-left">
          <div className="mb-1">
            <EntityPrevNext
              entity="quotations"
              currentId={detail.id}
              hrefForId={(id) => quotationDetailPath(id)}
            />
          </div>
          <div className="qtitle">
            {detail.serial_number ? (
              <span className="serial">{detail.serial_number}</span>
            ) : null}
            <h1 title={detail.name}>{detail.name}</h1>
          </div>
          {metaNodes.length > 0 ? (
            <div className="qmeta">
              {metaNodes.map((node, index) => (
                <span key={index} className="inline-flex items-center gap-3">
                  {index > 0 ? <span className="mdot" aria-hidden /> : null}
                  {node}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="wtop-acts">
          <QuotationWorkspaceStatusPill
            status={detail.status}
            isExpired={detail.is_expired}
            className="spill"
          />
          {detail.canManage ? (
            <QuotationToolbarButton
              variant="glow"
              size="sm"
              disabled={savePending || !hasUnsavedChanges}
              onClick={onSave}
              className="btn-glow"
            >
              {savePending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
              Save
            </QuotationToolbarButton>
          ) : null}
          {detail.canManage &&
          detail.status !== "cancelled" &&
          detail.status !== "archived" &&
          !detail.is_archived ? (
            <QuotationToolbarButton
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={runSendToClient}
            >
              {pending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
              Send to Client
            </QuotationToolbarButton>
          ) : null}
          {detail.canManage ? (
            <QuotationToolbarButton
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={runShowLink}
            >
              {pending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <Link2Icon className="size-3.5" />
              )}
              Show link
            </QuotationToolbarButton>
          ) : null}
          <QuotationPreviewToolbarActions
            quotationId={detail.id}
            serialNumber={detail.serial_number}
            items={detail.items}
            currency={detail.currency}
            exportTemplate={exportTemplate}
            onExportTemplateChange={onExportTemplateChange}
            selectedItemIds={selectedItemIds}
            onSelectedItemIdsChange={onSelectedItemIdsChange}
            exportRevision={detail.updated_at}
            busy={pending}
          />
          <OpenCampaignStudioLauncher
            seed={campaignSeed}
            tab="studio"
            workspace={{ type: "quotation", id: detail.id }}
            variant="ghost"
            size="md"
            showIcon
            buttonClassName="btn btn-ghost"
          />
          <GenerateOutputsLauncher
            seed={campaignSeed}
            tab="outputs"
            workspace={{ type: "quotation", id: detail.id }}
            triggerClassName="gen-trigger"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={pending}
                aria-label="Quotation actions"
                className="ibtn disabled:opacity-50"
              >
                <MoreHorizontalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  setLifecycleTab("links");
                  setLifecycleOpen(true);
                }}
              >
                Links &amp; actions
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setLifecycleTab("activity");
                  setLifecycleOpen(true);
                }}
              >
                Activity
              </DropdownMenuItem>
              {detail.canManage && detail.status === "draft" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => runStatus("under_review")}
                    disabled={pending}
                  >
                    <SendIcon className="size-3.5" />
                    Submit for review
                  </DropdownMenuItem>
                </>
              ) : null}
              {detail.canManage &&
              detail.status !== "cancelled" &&
              detail.status !== "archived" ? (
                <DropdownMenuItem
                  onSelect={() => runStatus("cancelled")}
                  disabled={pending}
                >
                  <XCircleIcon className="size-3.5" />
                  Cancel quotation
                </DropdownMenuItem>
              ) : null}
              {detail.canManage && !detail.is_archived ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={runArchive}
                    disabled={pending}
                  >
                    <ArchiveIcon className="size-3.5" />
                    Archive
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <QuotationLifecycleSheet
        detail={detail}
        promoteOptions={promoteOptions}
        open={lifecycleOpen}
        onOpenChange={setLifecycleOpen}
        defaultTab={lifecycleTab}
      />
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={shareReviewNumber}
      />
    </>
  );
}
