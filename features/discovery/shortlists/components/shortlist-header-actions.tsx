"use client";

import { useMemo, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher-lazy";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { planGenerateFromSource } from "@/features/campaign-outputs/hydration/generate-plan";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import {
  HIDE_COST_AND_FEES_LABEL,
  SHOW_ORIGINAL_CURRENCY_LABEL,
} from "@/lib/commercial/client-original-currency";
import { cn } from "@/lib/utils";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";

import { ShortlistDocumentOutputToolbar } from "./shortlist-document-output-toolbar";
import {
  SHORTLIST_TOOLBAR_BUTTON_CLASS,
  SHORTLIST_TOOLBAR_BUTTON_WARN_CLASS,
  ShortlistToolbarButton,
  ShortlistToolbarCount,
} from "./shortlist-detail-primitives";

const MENU_CONTENT_CLASS =
  "min-w-[236px] rounded-xl border-[rgba(0,87,255,0.06)] p-1.5 shadow-[0_0_0_1px_rgba(0,87,255,0.06),0_18px_44px_rgba(11,15,26,0.16)]";
const MENU_LABEL_CLASS =
  "px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#9ca3af]";
const MENU_ITEM_CLASS =
  "justify-between gap-3 rounded-lg px-2.5 py-2 text-[12.5px] text-[#41495A]";

function ViewSwitch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-[19px] w-8 shrink-0 rounded-full",
        on ? "bg-[#0057ff]" : "bg-[#E3E8F2]"
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-[15px] rounded-full bg-white transition-transform duration-200",
          on && "translate-x-[13px]"
        )}
      />
    </span>
  );
}

export function ShortlistHeaderActions({
  seed,
  shortlistId,
  creators,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
  exportRevision,
  displayCurrency,
  onCurrencyChange,
  showOriginalCurrency,
  hideCostAndFees,
  onShowOriginalCurrencyChange,
  onHideCostAndFeesChange,
  canManageView,
  canChangeCurrency,
  canSendToClient,
  canAddCreators,
  busy,
  onShowLink,
  onSendToClient,
  onAddCreators,
  overflow,
}: {
  seed: CampaignSeed;
  shortlistId: string;
  creators: ShortlistCreatorItem[];
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  onSelectedItemIdsChange: (itemIds: string[]) => void;
  exportRevision?: string | null;
  displayCurrency: string;
  onCurrencyChange: (currency: string) => void;
  showOriginalCurrency: boolean;
  hideCostAndFees: boolean;
  onShowOriginalCurrencyChange: (value: boolean) => void;
  onHideCostAndFeesChange: (value: boolean) => void;
  canManageView: boolean;
  canChangeCurrency: boolean;
  hasLink: boolean;
  canSendToClient: boolean;
  canAddCreators: boolean;
  busy?: boolean;
  onShowLink: () => void;
  onSendToClient: () => void;
  onAddCreators: () => void;
  overflow?: ReactNode;
}) {
  const plan = useMemo(() => planGenerateFromSource(seed), [seed]);
  const missingLabels = plan.result.missing.missingLabels;
  const viewCount = `${displayCurrency}${hideCostAndFees ? " · hidden" : ""}`;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <GenerateOutputsLauncher
        seed={seed}
        tab="outputs"
        workspace={{ type: "shortlist", id: shortlistId }}
        tone="toolbar"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ShortlistToolbarButton disabled={busy} aria-label="View settings">
            View
            <ShortlistToolbarCount>{viewCount}</ShortlistToolbarCount>
          </ShortlistToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Currency</DropdownMenuLabel>
          {COMMERCIAL_CURRENCIES.map((code) => (
            <DropdownMenuItem
              key={code}
              disabled={!canChangeCurrency || busy}
              onSelect={(event) => {
                event.preventDefault();
                onCurrencyChange(code);
              }}
              className={MENU_ITEM_CLASS}
            >
              {code}
              <span className="text-[10.5px] text-[#9ca3af]">
                {displayCurrency === code ? "current" : ""}
              </span>
            </DropdownMenuItem>
          ))}
          {canManageView ? (
            <>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Costs</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={busy}
                onSelect={(event) => {
                  event.preventDefault();
                  onShowOriginalCurrencyChange(!showOriginalCurrency);
                }}
                className={MENU_ITEM_CLASS}
                aria-pressed={showOriginalCurrency}
              >
                {SHOW_ORIGINAL_CURRENCY_LABEL}
                <ViewSwitch on={showOriginalCurrency} />
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onSelect={(event) => {
                  event.preventDefault();
                  onHideCostAndFeesChange(!hideCostAndFees);
                }}
                className={MENU_ITEM_CLASS}
                aria-pressed={hideCostAndFees}
              >
                {HIDE_COST_AND_FEES_LABEL}
                <ViewSwitch on={hideCostAndFees} />
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortlistDocumentOutputToolbar
        shortlistId={shortlistId}
        creators={creators}
        exportTemplate={exportTemplate}
        onExportTemplateChange={onExportTemplateChange}
        selectedItemIds={selectedItemIds}
        onSelectedItemIdsChange={onSelectedItemIdsChange}
        exportRevision={exportRevision}
        busy={busy}
        onClientLink={onShowLink}
        onSend={onSendToClient}
        clientLinkLabel="Client link"
        sendDisabled={!canSendToClient || busy}
      />

      <OpenCampaignStudioLauncher
        seed={seed}
        tab="studio"
        workspace={{ type: "shortlist", id: shortlistId }}
        showIcon={false}
        buttonClassName={SHORTLIST_TOOLBAR_BUTTON_CLASS}
      />

      {missingLabels.length > 0 ? (
        <OpenCampaignStudioLauncher
          seed={seed}
          tab="studio"
          workspace={{ type: "shortlist", id: shortlistId }}
          label="Complete brief"
          showIcon={false}
          buttonClassName={cn(
            SHORTLIST_TOOLBAR_BUTTON_CLASS,
            SHORTLIST_TOOLBAR_BUTTON_WARN_CLASS
          )}
          badge={
            <ShortlistToolbarCount warn>{missingLabels.length}</ShortlistToolbarCount>
          }
        />
      ) : null}

      {canAddCreators ? (
        <ShortlistToolbarButton variant="primary" onClick={onAddCreators} disabled={busy}>
          + Add creators
        </ShortlistToolbarButton>
      ) : null}

      {overflow}
    </div>
  );
}
