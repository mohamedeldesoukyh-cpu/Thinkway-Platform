"use client";
import { QuotationText, QuotationLanguageSwitcher } from "./quotation-design-locale";

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
import { useConfirmAction } from "@/components/shared/confirm-action-provider";

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
import { QuotationDocumentOutputToolbar } from "@/features/quotations/components/quotation-document-output-toolbar";
import { DiscoverySuiteJumpNav } from "@/features/discovery/components/design-system/discovery-suite-jump-nav";
import { formatDesignDate } from "@/lib/design/format-design-date";
import { useQuotationManualSave } from "./quotation-manual-save";
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
  onDiscard: () => void;
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
  onDiscard,
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
  const { confirm } = useConfirmAction();
  const { saveStatus } = useQuotationManualSave();
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

  async function runStatus(status: "under_review" | "cancelled") {
    if (status === "cancelled" && !(await confirm({ title: "Cancel quotation?", description: `Cancel ${detail.serial_number ?? detail.name}?`, confirmLabel: "Cancel quotation", variant: "destructive" }))) return;
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

  async function runArchive() {
    if (!(await confirm({ title: "Archive quotation?", description: `Archive ${detail.serial_number ?? detail.name}? It will be removed from the active quotations list.`, confirmLabel: "Archive quotation", variant: "destructive" }))) return;
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
      <header className="q-head"><div className="q-head__in">
        <div className="q-head__nav">
          <Link href={QUOTATIONS_LIST_PATH} className="q-b q-b--sm q-b--ghost"><QuotationText>← Back to quotations</QuotationText></Link>
          <span className="q-crumb"><Link href="/discovery/search"><QuotationText>Discovery</QuotationText></Link> / <Link href={QUOTATIONS_LIST_PATH}><QuotationText>Client quotations</QuotationText></Link> / <b>{detail.serial_number}</b></span>
          <span className="q-sp" />
          <div className="q-nav"><EntityPrevNext entity="quotations" currentId={detail.id} hrefForId={(id) => quotationDetailPath(id)} /></div>
          <QuotationLanguageSwitcher />
        </div>
        <div className="q-head__t">
          <span className="q-ref">{detail.serial_number}</span><h1>{detail.name}</h1>
          <span className={`q-p ${detail.is_expired || ["cancelled", "rejected"].includes(detail.status) ? "q-p--bad" : ["approved", "accepted"].includes(detail.status) ? "q-p--ok" : "q-p--wrn"}`}><QuotationText>{statusLabel}</QuotationText></span><span className="q-p q-p--blue">{detail.version}</span>
          <span className="q-sp" />
          <button type="button" className="q-b q-b--pri" onClick={runSendToClient} disabled={!detail.canManage || detail.status === "cancelled" || detail.status === "archived" || Boolean(detail.is_archived)}><QuotationText>Send to client</QuotationText></button>
        </div>
        <div className="q-head__meta">
          <b>{creatorCount ?? 0}</b> <QuotationText>creators</QuotationText> <span className="q-dot" /><b>{lineCount ?? 0}</b> <QuotationText>lines</QuotationText> <span className="q-dot" />
          {detail.shortlist_id ? <Link className="q-link" href={`/discovery/shortlists/${detail.shortlist_id}`}><QuotationText>Shortlist</QuotationText> {detail.shortlist_serial} ↗</Link> : <span><QuotationText>Shortlist</QuotationText>: <QuotationText>Not linked</QuotationText></span>}
          <span className="q-dot" />
          {detail.campaign_header_id ? <Link className="q-link" href={`/campaigns/${detail.campaign_header_id}`}><QuotationText>Campaign</QuotationText> {detail.campaign_document_number} ↗</Link> : <span><QuotationText>Campaign</QuotationText>: <span className="q-p"><QuotationText>Not linked</QuotationText></span></span>}
          <span className="q-dot" /><span className="q-sync"><s aria-hidden /><QuotationText>{detail.sync_enabled ? "Live sync" : "Snapshot locked"}</QuotationText></span>
          <span className="q-sp" />
          <span><QuotationText>Valid to</QuotationText> <b>{detail.validity_date ? formatDesignDate(detail.validity_date) : "Not set"}</b></span>
          {detail.valid_days_remaining != null && <span className="q-p q-p--wrn">{detail.is_expired ? <QuotationText>Expired</QuotationText> : <>{detail.valid_days_remaining} <QuotationText>days left</QuotationText></>}</span>}
        </div>
        {metricsSlot}
      </div></header>
      <div className="q-wrap q-header-tools">
        {detail.is_expired && <div className="q-banner q-banner--bad" role="status"><b>This quotation has expired.</b><span>Review its validity date in Document details.</span></div>}
        {saveStatus === "error" && <div className="q-banner q-banner--bad" role="alert"><span>Save failed. Your pending edits are still available on this page.</span><button type="button" className="q-b q-b--sm" disabled={savePending} onClick={onSave}><QuotationText>Retry save</QuotationText></button></div>}
        {showGpConflict && <div className="q-banner q-banner--wrn" role="status"><span><QuotationText>Commercial totals do not reconcile: total margin must equal GP before agency fees plus agency fees. Review Cost detail before submitting.</QuotationText></span></div>}
        {!detail.canManage && <div className="q-banner q-banner--info">Read-only — you can view this quotation; editing requires permission.</div>}
                    <div className="q-actions">
              {detail.canManage ? (
                <button
                  type="button"
                  className="tw-b sm pri"
                  disabled={savePending || !hasUnsavedChanges}
                  onClick={onSave}
                >
                  {savePending ? (
                    <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  <QuotationText>Save</QuotationText></button>
              ) : null}
              {detail.canManage && <button type="button" className="tw-b sm"
                disabled={savePending || !hasUnsavedChanges} onClick={onDiscard}>
                <QuotationText>Discard changes</QuotationText>
              </button>}
              <span role="status" className={`q-save ${savePending ? "is-saving" : saveStatus === "error" ? "is-failed" : hasUnsavedChanges ? "is-dirty" : "is-saved"}`}>
                <s aria-hidden /><span><QuotationText>{savePending ? "Saving…" : saveStatus === "error" ? "Save failed — retry" : hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}</QuotationText></span>
              </span>
              <span className="q-actions__div" aria-hidden />
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
                    <QuotationText>Links &amp; actions</QuotationText></DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setLifecycleTab("activity");
                      setLifecycleOpen(true);
                    }}
                  >
                    <QuotationText>Activity</QuotationText></DropdownMenuItem>
                  {detail.canManage ? (
                    <>
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
                        <QuotationText>Submit for review</QuotationText></DropdownMenuItem>
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
                      <QuotationText>Cancel quotation</QuotationText></DropdownMenuItem>
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
                        <QuotationText>Archive</QuotationText></DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        <div className="q-toggles">
          <ClientWorkspaceDisplayToggles
                          showOriginalCurrency={showOriginalCurrency}
                          hideCostAndFees={hideCostAndFees}
                          disabled={pending || !detail.canManage}
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
          <span className="q-help">AF = agency fees. Client presentation settings apply to linked reviews and outputs.</span>
        </div>
        <DiscoverySuiteJumpNav />
      </div>

      <QuotationLifecycleSheet
        detail={detail}
        promoteOptions={promoteOptions}
        open={lifecycleOpen}
        onOpenChange={setLifecycleOpen}
        defaultTab={lifecycleTab}
      />
      <ClientReviewShareDialog
        campaignName={detail.campaign_name || detail.name}
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
