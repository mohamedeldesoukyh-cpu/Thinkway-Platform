"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CampaignIntelligenceLibraryItem } from "@/lib/domains/intelligence/types";

import {
  confirmCampaignBriefUploadAction,
  type CampaignBriefUploadPendingState,
  type CampaignIntelligenceWorkspaceState,
} from "../actions/profile-actions";
import {
  listBrandsForIntelligenceLinkAction,
  listExistingIntelligenceForBrandAction,
} from "../actions/library-actions";
import {
  brandLinkConfirmReady,
  type BrandLinkConfirmIntent,
} from "../services/brand-link-confirm";
import {
  brandLinkSearchKeywords,
  buildBrandLinkDialogOptions,
  resolveDefaultBrandSelection,
} from "../services/build-brand-link-dialog-options";

type Props = {
  open: boolean;
  pending: CampaignBriefUploadPendingState | null;
  onOpenChange: (open: boolean) => void;
  onComplete: (workspace: CampaignIntelligenceWorkspaceState) => void;
  /** Intake / Studio must pass this so CIP is linked to the campaign conversation. */
  conversationId?: string | null;
};

export function CampaignIntelligenceLinkDialog({
  open,
  pending,
  onOpenChange,
  onComplete,
  conversationId,
}: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [mode, setMode] = useState<BrandLinkConfirmIntent>("create");
  const [linkProfileId, setLinkProfileId] = useState<string>("");
  const [existing, setExisting] = useState<CampaignIntelligenceLibraryItem[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [brandOptions, setBrandOptions] = useState<
    Array<{ brandId: string; brandName: string; clientName: string }>
  >([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const detection = pending?.brandDetection;
  const dialogOpen = open && Boolean(pending);
  const pendingDocumentId = pending?.documentId ?? null;

  const brandSelectOptions = useMemo(
    () =>
      brandOptions.map((candidate) => ({
        value: candidate.brandId,
        label: candidate.brandName,
        description: candidate.clientName,
        keywords: brandLinkSearchKeywords(candidate.brandName, candidate.clientName),
      })),
    [brandOptions]
  );

  const existingSelectOptions = useMemo(
    () =>
      existing.map((item) => ({
        value: item.id,
        label: item.title,
        description: item.campaignName ?? undefined,
      })),
    [existing]
  );

  useEffect(() => {
    if (!dialogOpen) {
      setBrandOptions([]);
      setLoadingBrands(false);
      return;
    }

    let cancelled = false;
    setLoadingBrands(true);

    void listBrandsForIntelligenceLinkAction()
      .then((allBrands) => {
        if (cancelled) return;
        const options = buildBrandLinkDialogOptions(allBrands, detection);
        setBrandOptions(options);
        setSelectedBrandId((current) =>
          current && options.some((option) => option.brandId === current)
            ? current
            : resolveDefaultBrandSelection(options, detection)
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setBrandOptions(
            detection
              ? buildBrandLinkDialogOptions([], detection)
              : []
          );
          toast.error(
            error instanceof Error ? error.message : "Could not load brands. Try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBrands(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, pendingDocumentId, detection?.bestMatch?.brandId, detection?.candidates]);

  useEffect(() => {
    if (!dialogOpen || !pending) return;
    setMode("create");
    setLinkProfileId("");
  }, [dialogOpen, pending, pendingDocumentId]);

  const detectedBrandLabel =
    detection?.bestMatch?.brandName ??
    brandOptions.find((option) => option.brandId === selectedBrandId)?.brandName ??
    detection?.extractedBrandName;

  const canConfirmDetectedBrand = Boolean(
    detection?.hasReliableBrandHint &&
      selectedBrandId &&
      mode !== "continue_without_brand" &&
      (detection.bestMatch?.brandId === selectedBrandId ||
        brandOptions.length === 1)
  );
  const confirmReady = brandLinkConfirmReady({
    intent: mode,
    selectedBrandId,
    linkProfileId,
  });

  useEffect(() => {
    if (!dialogOpen || !selectedBrandId) {
      setExisting([]);
      return;
    }

    let cancelled = false;
    setLoadingExisting(true);
    void listExistingIntelligenceForBrandAction(selectedBrandId)
      .then((items) => {
        if (!cancelled) {
          setExisting(items);
          if (items.length > 0) setLinkProfileId(items[0]?.id ?? "");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load existing records.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, selectedBrandId]);

  async function handleConfirm() {
    if (!pending) return;

    if (!brandLinkConfirmReady({ intent: mode, selectedBrandId, linkProfileId })) {
      toast.error(
        mode === "link"
          ? "Select an existing intelligence record to link."
          : "Select a brand to continue."
      );
      return;
    }

    setSubmitting(true);
    try {
      const continueWithoutBrand = mode === "continue_without_brand";
      const result = await confirmCampaignBriefUploadAction({
        documentId: pending.documentId,
        brandId: continueWithoutBrand ? null : selectedBrandId,
        mode,
        linkProfileId: mode === "link" ? linkProfileId : null,
        conversationId: conversationId ?? null,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        mode === "link"
          ? "Brief linked to existing Campaign Intelligence record."
          : continueWithoutBrand
            ? "Brief saved. Attach a Thinkway brand later when this client is in CRM."
            : "New Campaign Intelligence record created."
      );
      onComplete(result.workspace);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save brief.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="thinkway-campaign-req-sidebar z-[120] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
        overlayClassName="z-[120]"
      >
        <DialogHeader className="border-b border-[var(--camp-border)] px-5 py-4 text-left">
          <DialogTitle className="text-base font-bold text-[var(--camp-text)]">
            Link to brand
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--camp-text-3)]">
            {detection?.hasReliableBrandHint && detectedBrandLabel
              ? canConfirmDetectedBrand
                ? `Detected brand "${detectedBrandLabel}". Confirm below or pick another.`
                : `Detected brand "${detectedBrandLabel}" from the brief. Select the matching Thinkway brand, or continue without one if this is a new client.`
              : "We couldn't match this brief to a Thinkway brand. Pick an existing brand, or continue without one if this is a new client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor="cip-brand-select"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--camp-text-3)]"
            >
              Brand
            </label>
            <SearchableSelect
              id="cip-brand-select"
              value={selectedBrandId}
              onValueChange={setSelectedBrandId}
              options={brandSelectOptions}
              placeholder={
                loadingBrands
                  ? "Loading brands…"
                  : brandOptions.length === 0
                    ? "No brands available"
                    : "Select brand"
              }
              disabled={loadingBrands || submitting || brandOptions.length === 0}
              className="h-9 text-sm"
            />
            {!loadingBrands && brandOptions.length > 0 ? (
              <p className="mt-1 text-[11px] text-[var(--camp-text-3)]">
                {brandOptions.length} brand{brandOptions.length === 1 ? "" : "s"} available
                {detection?.bestMatch ? " — detected match shown first" : ""}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                mode === "create"
                  ? "border-[var(--camp-blue)] bg-[var(--camp-blue)]/8"
                  : "border-[var(--camp-border)] hover:bg-[var(--camp-surface)]"
              )}
              onClick={() => setMode("create")}
              disabled={submitting}
            >
              <span className="font-medium text-[var(--camp-text)]">Create new</span>
              <span className="mt-0.5 block text-[11px] text-[var(--camp-text-3)]">
                New intelligence record for this existing Thinkway brand
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                mode === "link"
                  ? "border-[var(--camp-blue)] bg-[var(--camp-blue)]/8"
                  : "border-[var(--camp-border)] hover:bg-[var(--camp-surface)]",
                existing.length === 0 && "opacity-50"
              )}
              onClick={() => existing.length > 0 && setMode("link")}
              disabled={existing.length === 0 || submitting}
            >
              <span className="font-medium text-[var(--camp-text)]">Link existing</span>
              <span className="mt-0.5 block text-[11px] text-[var(--camp-text-3)]">
                {loadingExisting
                  ? "Loading…"
                  : existing.length
                    ? `${existing.length} record${existing.length === 1 ? "" : "s"} for brand`
                    : "No existing records"}
              </span>
            </button>
          </div>

          <button
            type="button"
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              mode === "continue_without_brand"
                ? "border-[var(--camp-blue)] bg-[var(--camp-blue)]/8"
                : "border-[var(--camp-border)] hover:bg-[var(--camp-surface)]"
            )}
            onClick={() => setMode("continue_without_brand")}
            disabled={submitting}
          >
            <span className="font-medium text-[var(--camp-text)]">
              New client — continue without a Thinkway brand
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--camp-text-3)]">
              Saves the brief and extracted names. Does not create a client or brand in CRM.
            </span>
          </button>

          {mode === "link" ? (
            <div>
              <label
                htmlFor="cip-existing-select"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--camp-text-3)]"
              >
                Existing record
              </label>
              <SearchableSelect
                id="cip-existing-select"
                value={linkProfileId}
                onValueChange={setLinkProfileId}
                options={existingSelectOptions}
                placeholder="Select record"
                disabled={loadingExisting || submitting}
                className="h-9 text-sm"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--camp-border)] px-5 py-3 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={
              submitting ||
              !confirmReady ||
              (mode !== "continue_without_brand" && loadingBrands)
            }
          >
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {mode === "continue_without_brand"
              ? "Continue without a brand"
              : canConfirmDetectedBrand
                ? "Confirm & continue"
                : "Save intelligence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
