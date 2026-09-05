"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createClientReviewFromQuotationAction } from "@/features/client-workspace/actions/create-from-quotation-action";
import {
  peekClientReviewShareAction,
  revealClientReviewLinkAction,
} from "@/features/client-workspace/actions/reveal-client-review-link-action";
import { ClientReviewSendDialog } from "@/features/client-workspace/components/client-review-send-dialog";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import {
  clientReviewShareHasLink,
  quotationClientShareRequiresSave,
  quotationIsMovedToCampaign,
} from "@/features/client-workspace/client-review-selection";
import { CLIENT_REVIEW_LINK_MISSING_MESSAGE } from "@/features/client-workspace/constants";
import { ClientWorkspaceDisplayToggles } from "@/features/commercial/components/show-original-currency-toggle";
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
import { QuotationLifecyclePills } from "@/features/quotations/components/quotation-lifecycle-pills";
import { QuotationDocumentOutputToolbar } from "@/features/quotations/components/quotation-document-output-toolbar";
import { QuotationWorkspaceStatusPill } from "@/features/quotations/components/quotation-list-status-pill";
import { QuotationValidityBar } from "@/features/quotations/components/quotation-validity-bar";
import { DiscoverySuiteMasthead } from "@/features/discovery/components/design-system";
import {
  archiveQuotation,
  setQuotationHideCostAndFees,
  setQuotationShowOriginalCurrency,
  updateQuotationHeader,
} from "@/features/quotations/actions";
import {
  quotationDetailPath,
  QUOTATIONS_LIST_PATH,
  QUOTATION_STATUS_LABELS,
} from "@/features/quotations/constants";
import type { QuotationTemplateVariant } from "@/features/quotations/export/quotation-template";
import type { PromoteWizardOptions, QuotationDetail } from "@/features/quotations/types";
import type { QuotationClientReviewView } from "@/features/quotations/quotation-client-review";

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
  clientReview?: QuotationClientReviewView | null;
  /** Masthead metrics strip (HTML `.tw-ms2`) — rendered inside tw-mast. */
  metricsSlot?: ReactNode;
  lineCount?: number;
  creatorCount?: number;
  showGpConflict?: boolean;
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
  clientReview,
  metricsSlot,
  lineCount,
  creatorCount,
  showGpConflict = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkPending, startLinkTransition] = useTransition();
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<"links" | "activity">("links");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(undefined);
  const shareScope = { source: "quotation" as const, id: detail.id };
  const movedToCampaign = quotationIsMovedToCampaign(detail);
  // localStorage is client-only — do not read in useState init (hydration #418).
  const [hasLink, setHasLink] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [showOriginalCurrency, setOptimisticShowOriginalCurrency] = useOptimistic(
    Boolean(detail.showOriginalCurrency)
  );
  const [hideCostAndFees, setOptimisticHideCostAndFees] = useOptimistic(
    Boolean(detail.hideCostAndFees)
  );
  const campaignSeed = useMemo(() => seedFromQuotation(detail), [detail]);

  useEffect(() => {
    const scope = { source: "quotation" as const, id: detail.id };
    setHasLink(Boolean(readClientReviewShare(scope)));
    void peekClientReviewShareAction({ source: "quotation", quotationId: detail.id }).then((result) => {
      setHasLink(clientReviewShareHasLink(result.exists, Boolean(readClientReviewShare(scope))));
      if (result.reviewNumber != null) setShareReviewNumber(result.reviewNumber);
    });
  }, [detail.id]);

  function rememberShare(url: string, reviewNumber: number) {
    setShareUrl(url);
    setShareReviewNumber(reviewNumber);
    setHasLink(true);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) rememberClientReviewShare(shareScope, { url, reviewNumber, reviewId });
  }

  function runLinkButton() {
    if (
      quotationClientShareRequiresSave({
        hasUnsavedChanges,
        hasExistingLink: hasLink,
        movedToCampaign,
      })
    ) {
      toast.error("Save the quotation first.");
      return;
    }
    startLinkTransition(async () => {
      const cached = readClientReviewShare(shareScope);
      if (cached) {
        setShareUrl(cached.url);
        setShareReviewNumber(cached.reviewNumber);
        setHasLink(true);
        setShareOpen(true);
        return;
      }
      const revealed = await revealClientReviewLinkAction({
        source: "quotation",
        quotationId: detail.id,
      });
      if (revealed.ok) {
        rememberShare(revealed.url, revealed.reviewNumber);
        setShareOpen(true);
        return;
      }
      if (revealed.message !== CLIENT_REVIEW_LINK_MISSING_MESSAGE) {
        toast.error(revealed.message);
        return;
      }
      const res = await createClientReviewFromQuotationAction({ quotationId: detail.id });
      if (!res.ok) {
        toast.error(res.message, {
          description: res.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      rememberShare(res.url, res.reviewNumber);
      setShareOpen(true);
    });
  }

  function runSendToClient() {
    if (
      quotationClientShareRequiresSave({
        hasUnsavedChanges,
        hasExistingLink: hasLink,
        movedToCampaign,
      })
    ) {
      toast.error("Save the quotation first.");
      return;
    }
    setSendOpen(true);
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

  const statusLabel = detail.is_expired
    ? "Expired"
    : (QUOTATION_STATUS_LABELS[detail.status] ?? detail.status);

  return (
    <>
      <div className="discovery-suite shrink-0 px-[15px] pt-2">
        <DiscoverySuiteMasthead
          title={detail.name}
          id={detail.serial_number}
          badge={<span className="st">{statusLabel}</span>}
          subtitle={[
            lineCount != null ? `${lineCount} line${lineCount === 1 ? "" : "s"}` : null,
            creatorCount != null
              ? `${creatorCount} creator${creatorCount === 1 ? "" : "s"}`
              : null,
            detail.shortlist_serial ? `linked to ${detail.shortlist_serial}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          trailing={
            showGpConflict ? <span className="st r">GP conflict</span> : null
          }
          top={
            <div className="tw-top">
              <Link href={QUOTATIONS_LIST_PATH} className="tw-b sm">
                ← Back
              </Link>
              <EntityPrevNext
                entity="quotations"
                currentId={detail.id}
                hrefForId={(id) => quotationDetailPath(id)}
              />
              <span className="tw-crumb">
                Discovery / <b>Client quotations</b>
                {detail.serial_number ? ` / ${detail.serial_number}` : null}
              </span>
              <span className="tw-sp" />
              <QuotationWorkspaceStatusPill
                status={detail.status}
                isExpired={detail.is_expired}
                className="spill spill-compact"
              />
            </div>
          }
          band={
            <QuotationLifecyclePills
              detail={detail}
              variant="masthead"
              trailing={
                quotationIsMovedToCampaign(detail) ? null : (
                  <QuotationValidityBar
                    inline
                    validityDate={detail.validity_date}
                    validDaysRemaining={detail.valid_days_remaining}
                    isExpired={detail.is_expired}
                  />
                )
              }
            />
          }
          metricsSlot={metricsSlot}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {detail.canManage ? (
                <button
                  type="button"
                  className="tw-b sm"
                  disabled={savePending || !hasUnsavedChanges}
                  onClick={onSave}
                >
                  {savePending ? (
                    <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  Save
                </button>
              ) : null}
              <QuotationDocumentOutputToolbar
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
                onClientLink={detail.canManage ? runLinkButton : () => undefined}
                onSend={detail.canManage ? runSendToClient : () => undefined}
                clientLinkLabel="Client link"
                linkDisabled={!detail.canManage || linkPending}
                linkPending={linkPending}
                sendDisabled={
                  !detail.canManage ||
                  detail.status === "cancelled" ||
                  detail.status === "archived" ||
                  Boolean(detail.is_archived)
                }
              />
              <OpenCampaignStudioLauncher
                seed={campaignSeed}
                tab="studio"
                workspace={{ type: "quotation", id: detail.id }}
                showIcon={false}
                buttonClassName="tw-b sm"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label="Quotation actions"
                    className="tw-b sm disabled:opacity-50"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
                  {detail.canManage ? (
                    <>
                      <DropdownMenuSeparator />
                      <div
                        className="px-2 py-2"
                        onPointerDown={(e) => e.preventDefault()}
                      >
                        <ClientWorkspaceDisplayToggles
                          showOriginalCurrency={showOriginalCurrency}
                          hideCostAndFees={hideCostAndFees}
                          disabled={pending}
                          onShowOriginalCurrencyChange={(value) => {
                            startTransition(async () => {
                              setOptimisticShowOriginalCurrency(value);
                              const result = await setQuotationShowOriginalCurrency({
                                quotationId: detail.id,
                                value,
                              });
                              if (!result.ok) {
                                toast.error(result.message);
                                return;
                              }
                              router.refresh();
                            });
                          }}
                          onHideCostAndFeesChange={(value) => {
                            startTransition(async () => {
                              setOptimisticHideCostAndFees(value);
                              const result = await setQuotationHideCostAndFees({
                                quotationId: detail.id,
                                value,
                              });
                              if (!result.ok) {
                                toast.error(result.message);
                                return;
                              }
                              router.refresh();
                            });
                          }}
                        />
                      </div>
                      <DropdownMenuSeparator />
                      <div
                        className="px-1.5 py-1"
                        onPointerDown={(e) => e.preventDefault()}
                      >
                        <GenerateOutputsLauncher
                          seed={campaignSeed}
                          tab="outputs"
                          workspace={{ type: "quotation", id: detail.id }}
                          tone="toolbar"
                          triggerClassName="tw-b sm w-full justify-start"
                        />
                      </div>
                    </>
                  ) : null}
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
          }
          freezeOnScroll={false}
        />
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
        status={clientReview?.status ?? detail.status}
        version={detail.version}
        documentLabel={detail.serial_number ?? detail.name}
        linkEnabled={hasLink}
      />
      <ClientReviewSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        quotationId={detail.id}
        clientId={detail.client_id}
        onSent={() => setHasLink(true)}
      />
    </>
  );
}
