"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CreatorDetailSheetIdentityCard } from "@/features/campaigns/components/creator-detail-sheet-identity-card";
import {
  BadgeCheckIcon,
  GitMergeIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  ImageIcon,
  Loader2Icon,
  LinkIcon,
  MailIcon,
  Maximize2Icon,
  PanelLeftIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TextQuoteIcon,
  TrendingUpIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCreatorMenu } from "@/features/discovery/enrichment/components/refresh-creator-menu";
import { AddCreatorPlatformDialog } from "@/features/discovery/components/add-creator-platform-dialog";
import { DeleteCreatorPlatformDialog } from "@/features/discovery/delete-platform/delete-creator-platform-dialog";
import { EditCreatorAveragePriceDialog } from "@/features/discovery/components/edit-creator-average-price-dialog";
import { EditCreatorContactDialog } from "@/features/discovery/components/edit-creator-contact-dialog";
import { EditCreatorProfileUrlDialog } from "@/features/discovery/components/edit-creator-profile-url-dialog";
import {
  CombineCreatorsDialog,
  type CombineCreatorsMergedMeta,
} from "@/features/discovery/components/combine-creators-dialog";
import { RecentPublicationsGallery } from "@/features/discovery/enrichment/components/recent-publications-gallery";
import {
  resolveCreatorEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  addCreatorToCampaignShortlistAction,
  enrichUnifiedCreatorWithEciAction,
  getCreatorHistoricalMetricsAction,
  getSimilarCreatorsAction,
  getUnifiedCreatorCoreDetailAction,
} from "@/features/campaigns/creator-discovery-actions";
import { startLoadTimer } from "@/lib/performance/progressive-load";
import { getInfluencerQuotationPriceReferenceAction } from "@/features/quotations/actions";
import { CreatorQuotationPriceReferencePanel } from "@/components/creator/creator-quotation-price-reference-panel";
import {
  CreatorDetailsSummaryCard,
  formatThinkwayStarLabel,
} from "@/features/discovery/components/creator-details-summary-card";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import {
  CREATOR_DETAIL_SHEET_MAX_WIDTH_PX,
} from "@/features/discovery/components/design-system/discovery-design-tokens";
import type { CreatorQuotationPriceReference } from "@/lib/creators/quotation-price-reference";
import { CreatorCountriesDisplay } from "@/components/creator/creator-countries-display";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import { formatCreatorRecencyLabel } from "@/lib/creators/creator-hover-details";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { isAssignableCreator } from "@/lib/creators/adapters";
import {
  projectCreatorPlatformView,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
import { creatorHasAnyContact, resolveCreatorContactSections, type CreatorContactFields } from "@/lib/creators/contact-info";
import { creatorListRowEquivalent } from "@/lib/creators/creator-list-row-equivalent";
import { shouldPreventCreatorDetailSheetOutsideDismiss } from "@/lib/creators/creator-detail-sheet-open-policy";
import {
  CREATOR_METRIC_DEFINITIONS,
  resolveCreatorEngagementMetricBundle,
} from "@/lib/creators/creator-metric-definitions";
import type {
  CreatorHistoricalMetrics,
  MetricConfidenceLevel,
  MetricWithConfidence,
  UnifiedCreatorPlatform,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { resolvePrimaryProfileUrl } from "@/lib/discovery/profile-url";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { formatPricing, parseRateCard } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

export type CreatorDetailSheetUpdateMeta = {
  forceListSync?: boolean;
  removedUnifiedId?: string;
  removedInfluencerId?: string | null;
};

type Props = {
  creator: UnifiedCreatorResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (creator: UnifiedCreatorResult) => void;
  onCreatorUpdated?: (
    creator: UnifiedCreatorResult,
    meta?: CreatorDetailSheetUpdateMeta
  ) => void;
  campaignHeaderId?: string;
  /** When false, clicking quotation/list rows outside the sheet closes it. Default keeps Discovery row-switch UX. */
  preserveOpenOnCreatorRows?: boolean;
};

type DetailTab = "overview" | "contact" | "publications" | "confidence" | "similar";

const CREATOR_DETAIL_SHEET_STYLE = {
  width: `min(${Math.max(CREATOR_DETAIL_SHEET_MAX_WIDTH_PX, 920)}px, 100vw)`,
  maxWidth: `${Math.max(CREATOR_DETAIL_SHEET_MAX_WIDTH_PX, 920)}px`,
} as const;

const CREATOR_DETAIL_SHEET_CLASS = cn(
  "creator-detail-sheet flex flex-col gap-0 overflow-hidden border-l border-border bg-[#f8fafc] p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-8px_0_40px_rgba(15,23,42,0.1)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
);

const DETAIL_TAB_TRIGGER_CLASS = cn(
  "rounded-none px-0 shadow-none",
  "mr-5 after:!bottom-0 after:h-0.5 after:bg-[#0057FF]"
);

const CONFIDENCE_DOT: Record<MetricConfidenceLevel, string> = {
  estimated: "bg-muted-foreground/40",
  inferred: "bg-amber-500",
  verified: "bg-emerald-500",
  oauth_verified: "bg-sky-500",
};

const CONFIDENCE_LABEL: Record<MetricConfidenceLevel, string> = {
  estimated: "Estimated",
  inferred: "Inferred",
  verified: "Verified",
  oauth_verified: "OAuth verified",
};

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function SectionTitle({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="creator-detail-sheet-section-title">
      <span className="creator-detail-sheet-section-title__icon" aria-hidden>
        {icon}
      </span>
      <h3 className="creator-detail-sheet-section-title__text">{children}</h3>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

function DetailSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("creator-detail-sheet-section", className)}>
      {children}
    </section>
  );
}

function ProfileTagChips({
  tags,
  variant,
}: {
  tags: string[];
  variant: "hashtag" | "mention";
}) {
  if (tags.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">None tagged</span>;
  }

  const chipClass =
    variant === "hashtag"
      ? "creator-detail-sheet-tag--hashtag"
      : "creator-detail-sheet-tag--mention";

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={cn("creator-detail-sheet-tag", chipClass)}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function ContactFieldRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
      >
        <span className="break-all">{value}</span>
        {external ? <ExternalLinkIcon className="size-3 shrink-0" aria-hidden /> : null}
      </a>
    </div>
  );
}

function KpiCard({
  label,
  metric,
  suffix = "",
  description,
}: {
  label: string;
  metric: MetricWithConfidence;
  suffix?: string;
  description?: string;
}) {
  return (
    <div className="creator-detail-sheet-kpi-card" title={description}>
      <div className="creator-detail-sheet-kpi-card__label-row">
        <span
          className={cn("creator-detail-sheet-kpi-card__confidence", CONFIDENCE_DOT[metric.confidence])}
          title={CONFIDENCE_LABEL[metric.confidence]}
        />
        <p className="creator-detail-sheet-kpi-card__label">{label}</p>
      </div>
      <p className="creator-detail-sheet-kpi-card__value">
        {metric.value == null ? "—" : `${formatCount(metric.value)}${suffix}`}
      </p>
    </div>
  );
}

function ContactFieldsGroup({ contact }: { contact: CreatorContactFields }) {
  return (
    <div className="space-y-3.5">
      {contact.contact_email ? (
        <ContactFieldRow
          label="Email"
          value={contact.contact_email}
          href={`mailto:${contact.contact_email}`}
        />
      ) : null}
      {contact.contact_phone ? (
        <ContactFieldRow
          label="Phone"
          value={contact.contact_phone}
          href={`tel:${contact.contact_phone.replace(/\s/g, "")}`}
        />
      ) : null}
      {contact.contact_links.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            {contact.contact_links.length === 1 ? "Website" : "Links"}
          </p>
          <div className="space-y-2">
            {contact.contact_links.map((link, index) => (
              <a
                key={`${link}-${index}`}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-[12px] text-blue-600 transition-colors hover:bg-muted/40 dark:text-blue-400"
              >
                <LinkIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-all">
                  {contact.contact_links.length > 1 ? (
                    <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {index + 1}
                    </span>
                  ) : null}
                  {link.replace(/^https?:\/\//i, "")}
                </span>
                <ExternalLinkIcon className="ml-auto size-3 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContactPanel({
  identityCreator,
  platforms,
  enrichmentStatus,
  onEditContact,
  onEnrichmentStatusChange,
  onCreatorUpdated,
}: {
  identityCreator: UnifiedCreatorResult;
  platforms: UnifiedCreatorResult["platforms"];
  enrichmentStatus: CreatorEnrichmentStatus;
  onEditContact: () => void;
  onEnrichmentStatusChange: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated: (creator: UnifiedCreatorResult) => void;
}) {
  const contactSections = resolveCreatorContactSections({
    platforms,
    contact_email: identityCreator.contact_email,
    contact_phone: identityCreator.contact_phone,
    contact_links: identityCreator.contact_links,
  });
  const hasContact = contactSections.length > 0;
  const canEdit = Boolean(identityCreator.influencer_id);
  const canEnrich = Boolean(identityCreator.influencer_id);

  return (
    <DetailSection className="border-b-0">
      <SectionTitle
        icon={<MailIcon className="size-3" />}
        action={
          canEdit && hasContact ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11px]"
              onClick={onEditContact}
            >
              <PencilIcon className="size-3" aria-hidden />
              Edit contact
            </Button>
          ) : null
        }
      >
        Contact information
      </SectionTitle>
      {contactSections.length > 1 ? (
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          Contact details are shown for each linked platform account. All available sources are
          listed below — not only the platform selected above.
        </p>
      ) : null}
      {hasContact ? (
        <div className="space-y-4">
          {contactSections.map((section) => {
            const sectionTitle =
              section.platform === "profile"
                ? "Creator profile"
                : platformLabel(section.platform);

            return (
              <div
                key={section.accountId}
                className="rounded-xl border border-border bg-muted/10 px-3.5 py-3"
              >
                <p className="mb-2.5 text-[11px] font-semibold text-foreground">
                  {sectionTitle}
                  {section.handle ? (
                    <span className="font-normal text-muted-foreground"> · @{section.handle}</span>
                  ) : null}
                </p>
                <ContactFieldsGroup contact={section.contact} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <PhoneIcon className="size-4" aria-hidden />
          </span>
          <p className="max-w-xs text-[12px] text-muted-foreground">
            No contact information yet
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canEnrich ? (
              <RefreshCreatorMenu
                influencerId={identityCreator.influencer_id!}
                unifiedId={identityCreator.unified_id}
                enrichmentStatus={enrichmentStatus}
                size="sm"
                variant="outline"
                label="Run enrichment"
                onStatusChange={onEnrichmentStatusChange}
                onCreatorUpdated={onCreatorUpdated}
              />
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={onEditContact}
              >
                <PlusIcon className="size-3.5" aria-hidden />
                Add contact details
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </DetailSection>
  );
}

function CreatorAveragePriceCard({
  creator,
  onEdit,
}: {
  creator: UnifiedCreatorResult;
  onEdit: () => void;
}) {
  const rate = parseRateCard(creator.rate_card);
  const hasRate = rate.base_rate != null && !Number.isNaN(rate.base_rate);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Average price per content
          </p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">
            {hasRate ? formatPricing(creator.rate_card) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Vendor rate card · used when quotation averages are unavailable
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-[11px]"
          onClick={onEdit}
        >
          {hasRate ? (
            <PencilIcon className="size-3" aria-hidden />
          ) : (
            <PlusIcon className="size-3" aria-hidden />
          )}
          {hasRate ? "Edit" : "Add"}
        </Button>
      </div>
    </div>
  );
}

function ConfidencePanel({
  displayCreator,
  history,
  loading,
  latestFollowers,
}: {
  displayCreator: UnifiedCreatorResult;
  history: CreatorHistoricalMetrics | null;
  loading: boolean;
  latestFollowers: number | null;
}) {
  return (
    <>
      <DetailSection>
        <SectionTitle icon={<ShieldCheckIcon className="size-3" />}>
          Confidence & authenticity
        </SectionTitle>
        <ConfidenceRows displayCreator={displayCreator} />
      </DetailSection>
      <DetailSection>
        <SectionTitle icon={<TrendingUpIcon className="size-3" />}>Historical metrics</SectionTitle>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-[12px] text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading historical snapshots…
          </div>
        ) : history && history.followers.length > 0 ? (
          <div className="py-1 text-[12px] text-muted-foreground">
            <p className="text-foreground">
              {history.followers.length} follower snapshot
              {history.followers.length === 1 ? "" : "s"} recorded
            </p>
            {latestFollowers != null ? (
              <p className="mt-1">Latest: {latestFollowers.toLocaleString()} followers</p>
            ) : null}
            <p className="mt-2 italic text-muted-foreground/80">
              Chart visualization — Phase 2 placeholder
            </p>
          </div>
        ) : (
          <p className="py-5 text-center text-[12px] text-muted-foreground">
            No historical snapshots yet. Enrichment worker will populate trends.
          </p>
        )}
      </DetailSection>
    </>
  );
}

function ConfidenceRows({ displayCreator }: { displayCreator: UnifiedCreatorResult }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Authenticity
        </span>
        <span className="font-semibold text-foreground">
          {displayCreator.authenticity_score != null ? displayCreator.authenticity_score : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Source confidence
        </span>
        <span className="font-semibold text-foreground">
          {Math.round(displayCreator.source_confidence)}%
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Verification
        </span>
        <span
          className={cn(
            "font-semibold",
            displayCreator.is_platform_verified
              ? "inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
          )}
        >
          {displayCreator.is_platform_verified ? (
            <>
              <BadgeCheckIcon className="size-3.5" />
              Verified
            </>
          ) : (
            "Unverified"
          )}
        </span>
      </div>
      {(() => {
        const storedCategories = resolveDiscoveryCreatorDisplayCategories(displayCreator);
        if (storedCategories.length === 0) return null;
        return (
        <div className="flex items-start justify-between gap-4 py-2">
          <span className="pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Categories
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {storedCategories.slice(0, 5).map((category) => (
              <span
                key={category}
                className="inline-flex h-5 items-center rounded-full bg-blue-50 px-2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

const SIMILAR_CREATORS_RAIL_LIMIT = 8;
const SIMILAR_CREATORS_MAXIMIZE_LIMIT = 24;

/** Coarse similarity bands — the scorer only distinguishes a few tiers, not a ranked list. */
function similarityMatchBand(score: number): { key: string; label: string } {
  if (score >= 80) return { key: "strong", label: "Strong match" };
  if (score >= 60) return { key: "good", label: "Good match" };
  return { key: "possible", label: "Possible match" };
}

function groupSimilarByBand(
  similar: Array<UnifiedCreatorResult & { similarity_score: number }>
): Array<{ key: string; label: string; items: Array<UnifiedCreatorResult & { similarity_score: number }> }> {
  const order = ["strong", "good", "possible"] as const;
  const buckets = new Map<string, Array<UnifiedCreatorResult & { similarity_score: number }>>();
  for (const item of similar) {
    const band = similarityMatchBand(item.similarity_score);
    const list = buckets.get(band.key) ?? [];
    list.push(item);
    buckets.set(band.key, list);
  }
  // Within a band, alphabetical — never score order (scores are identical within a tier).
  for (const list of buckets.values()) {
    list.sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
  }
  return order
    .filter((key) => (buckets.get(key)?.length ?? 0) > 0)
    .map((key) => {
      const label =
        key === "strong" ? "Strong match" : key === "good" ? "Good match" : "Possible match";
      return {
        key,
        label,
        items: buckets.get(key)!,
      };
    });
}

function SimilarCreatorsList({
  similar,
  loading,
  compact = false,
  className,
}: {
  similar: Array<UnifiedCreatorResult & { similarity_score: number }>;
  loading: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn("creator-detail-sheet-similar-stack", className)}>
        <div className="flex items-center gap-2 py-4 text-[12px] text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Finding similar creators…
        </div>
      </div>
    );
  }

  if (similar.length === 0) {
    return (
      <div className={cn("creator-detail-sheet-similar-stack", className)}>
        <div className="discovery-creator-details-hover-card creator-detail-sheet-similar-empty">
          <p className="discovery-creator-details-hover-card__collabs text-center">
            No similar creators found.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupSimilarByBand(similar);

  return (
    <div
      className={cn(
        "creator-detail-sheet-similar-stack",
        compact && "creator-detail-sheet-similar-stack--compact",
        className
      )}
    >
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {group.label}
            <span className="font-semibold normal-case tracking-normal text-muted-foreground/80">
              {" "}
              ×{group.items.length}
            </span>
          </p>
          {group.items.map((item) => {
            const vm = buildDiscoveryCreatorViewModel(item);
            const handle = item.platforms[0]?.handle?.replace(/^@/, "") ?? null;
            const secondaryLine = handle ? `@${handle}` : group.label;

            return (
              <CreatorDetailsSummaryCard
                key={item.unified_id}
                displayName={item.display_name}
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                thinkwayStarLabel={formatThinkwayStarLabel(item.eci_investment_score)}
                secondaryLine={secondaryLine}
                statusLabel={formatCreatorRecencyLabel(item.last_enriched_at, item.updated_at)}
                size={compact ? "rail" : "compact"}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SimilarCreatorsMaximizeDialog({
  open,
  onOpenChange,
  creatorName,
  similar,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  similar: Array<UnifiedCreatorResult & { similarity_score: number }>;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] flex max-h-[min(88vh,860px)] max-w-[min(920px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden"
        overlayClassName="z-[120]"
        style={{ zIndex: 120 }}
      >
        <DialogHeader>
          <DialogTitle>Similar creators</DialogTitle>
          <DialogDescription>
            Alternatives similar to {creatorName}. Scroll to review the full list.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading more similar creators…
            </div>
          ) : similar.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">
              No similar creators found.
            </p>
          ) : (
          ) : (
            <div className="space-y-5">
              {groupSimilarByBand(similar).map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    {group.label}
                    <span className="font-semibold normal-case tracking-normal text-muted-foreground/80">
                      {" "}
                      ×{group.items.length}
                    </span>
                  </p>
                  <div className="creator-detail-sheet-similar-maximize-grid">
                    {group.items.map((item) => {
                      const vm = buildDiscoveryCreatorViewModel(item);
                      const handle = item.platforms[0]?.handle?.replace(/^@/, "") ?? null;
                      return (
                        <CreatorDetailsSummaryCard
                          key={item.unified_id}
                          displayName={item.display_name}
                          avatarUrl={vm.avatarUrl}
                          profileUrl={vm.profileUrl}
                          thinkwayStarLabel={formatThinkwayStarLabel(item.eci_investment_score)}
                          secondaryLine={handle ? `@${handle}` : group.label}
                          statusLabel={formatCreatorRecencyLabel(
                            item.last_enriched_at,
                            item.updated_at
                          )}
                          size="compact"
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LoadedDetail = {
  unifiedId: string;
  history: CreatorHistoricalMetrics | null;
  quotationPriceReference: CreatorQuotationPriceReference | null;
};

export function CreatorDetailSheet({
  creator,
  open,
  onOpenChange,
  onAssign,
  onCreatorUpdated,
  campaignHeaderId,
  preserveOpenOnCreatorRows = true,
}: Props) {
  const [detail, setDetail] = useState<LoadedDetail | null>(null);
  const [baseCreator, setBaseCreator] = useState<UnifiedCreatorResult | null>(creator);
  const [selectedPlatformAccountId, setSelectedPlatformAccountId] = useState<string | null>(
    creator?.default_metrics_platform_account_id ?? creator?.platforms[0]?.id ?? null
  );
  const [enrichmentStatus, setEnrichmentStatus] = useState<CreatorEnrichmentStatus>("never");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [addPlatformOpen, setAddPlatformOpen] = useState(false);
  const [deletePlatformOpen, setDeletePlatformOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<UnifiedCreatorPlatform | null>(null);
  const deletePlatformResetTimeoutRef = useRef<number | null>(null);
  const detailFetchGenerationRef = useRef(0);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editAveragePriceOpen, setEditAveragePriceOpen] = useState(false);
  const [editProfileUrlOpen, setEditProfileUrlOpen] = useState(false);
  const [combineCreatorsOpen, setCombineCreatorsOpen] = useState(false);
  const [similar, setSimilar] = useState<Array<UnifiedCreatorResult & { similarity_score: number }>>(
    []
  );
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarMaximizedOpen, setSimilarMaximizedOpen] = useState(false);
  const [maximizedSimilar, setMaximizedSimilar] = useState<Array<
    UnifiedCreatorResult & { similarity_score: number }
  > | null>(null);
  const [maximizedSimilarLoading, setMaximizedSimilarLoading] = useState(false);
  /** True while ECI overlay is in flight — identity shell stays instant. */
  const [eciLoading, setEciLoading] = useState(false);
  const [eciLoadingSkipped, setEciLoadingSkipped] = useState(false);

  useEffect(() => {
    if (!open || !creator) return;
    setBaseCreator(creator);
    setSelectedPlatformAccountId(
      creator.default_metrics_platform_account_id ?? creator.platforms[0]?.id ?? null
    );
    setEnrichmentStatus(resolveCreatorEnrichmentStatus(creator.enrichment_status));
    setSimilarMaximizedOpen(false);
    setMaximizedSimilar(null);
  }, [open, creator?.unified_id]);

  useEffect(() => {
    return () => {
      if (deletePlatformResetTimeoutRef.current != null) {
        window.clearTimeout(deletePlatformResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !creator) return;
    const unifiedId = creator.unified_id;
    const influencerId = creator.influencer_id;
    const fetchGeneration = detailFetchGenerationRef.current + 1;
    detailFetchGenerationRef.current = fetchGeneration;
    let active = true;
    // Instant shell: keep list-row identity; clear only progressive panels.
    setDetail(null);
    setSimilar([]);
    setSimilarLoading(false);
    setEciLoading(true);
    setEciLoadingSkipped(false);

    const sessionTimer = startLoadTimer("creator-detail.sheet.session");
    let raf1 = 0;
    let raf2 = 0;

    /**
     * Progressive Creator Detail (post-paint):
     * FMP — list-row: image, name, handle, followers, country, categories, recommendation
     * Phase 1 — core DNA refresh
     * Phase 2 — ECI / Investment / Audience overlay
     * Phase 3 — History, quotation, Similar
     */
    const startProgressiveIntel = () => {
      if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;

      void (async () => {
        const phase1 = startLoadTimer("creator-detail.sheet.phase1-core");
        const coreCreator = await getUnifiedCreatorCoreDetailAction(unifiedId);
        phase1.end({ ok: Boolean(coreCreator) });
        if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;

        const seed = coreCreator ?? creator;
        setBaseCreator(seed);
        setSelectedPlatformAccountId((current) => {
          if (current && seed.platforms.some((p) => p.id === current)) return current;
          return (
            seed.default_metrics_platform_account_id ?? seed.platforms[0]?.id ?? null
          );
        });

        const phase2 = startLoadTimer("creator-detail.sheet.phase2-eci");
        const eciPromise = enrichUnifiedCreatorWithEciAction(seed).then((withEci) => {
          phase2.end({
            ok: Boolean(withEci),
            hasScore: withEci?.eci_investment_score != null,
          });
          if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
          if (withEci) setBaseCreator(withEci);
          setEciLoading(false);
        });

        const phase3 = startLoadTimer("creator-detail.sheet.phase3-panels");
        const panelsPromise = Promise.all([
          getCreatorHistoricalMetricsAction(unifiedId),
          influencerId
            ? getInfluencerQuotationPriceReferenceAction(influencerId).then((res) =>
                res.ok ? (res.data?.reference ?? null) : null
              )
            : Promise.resolve(null),
        ]).then(([hist, quotationPriceReference]) => {
          phase3.end({
            historyPoints: hist?.followers?.length ?? 0,
            hasQuotation: quotationPriceReference != null,
          });
          if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
          setDetail({ unifiedId, history: hist, quotationPriceReference });
        });

        setSimilarLoading(true);
        void getSimilarCreatorsAction(unifiedId, SIMILAR_CREATORS_RAIL_LIMIT)
          .then((sim) => {
            if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
            setSimilar(sim);
          })
          .catch(() => {
            if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
            setSimilar([]);
          })
          .finally(() => {
            if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
            setSimilarLoading(false);
          });

        await Promise.all([eciPromise, panelsPromise]);
        if (!active || detailFetchGenerationRef.current !== fetchGeneration) return;
        setEciLoading(false);
        sessionTimer.end({ unifiedId });
      })();
    };

    // Two rAFs: let the drawer paint the list-row shell first.
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(startProgressiveIntel);
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [open, creator?.unified_id]);

  const activeCreator =
    creator && baseCreator?.unified_id === creator.unified_id
      ? baseCreator
      : (creator ?? baseCreator);
  if (!open || !activeCreator) return null;

  const displayCreator = projectCreatorPlatformView(activeCreator, selectedPlatformAccountId);
  const identityCreator = activeCreator;
  const platforms = sortPlatformsStable(identityCreator.platforms);
  const selectedPlatform =
    platforms.find((p) => p.id === selectedPlatformAccountId) ?? platforms[0] ?? null;
  const selectedMetadata = (selectedPlatform?.metadata ?? null) as Record<string, unknown> | null;
  const metadataReelsPlays =
    typeof selectedMetadata?.avg_reels_plays === "number" ? selectedMetadata.avg_reels_plays : null;
  const engagementMetricBundle = resolveCreatorEngagementMetricBundle({
    publications: displayCreator.recent_publications,
    avgLikes: displayCreator.metrics.avg_likes.value,
    avgComments: displayCreator.metrics.avg_comments.value,
    reelsViewsAvg: metadataReelsPlays,
  });
  const avgEngagementsMetric: MetricWithConfidence = {
    value: engagementMetricBundle.avgEngagements,
    confidence:
      engagementMetricBundle.avgEngagements != null
        ? displayCreator.metrics.avg_likes.confidence
        : "estimated",
  };
  const avgLikesMetric: MetricWithConfidence = {
    value: engagementMetricBundle.avgLikes,
    confidence: displayCreator.metrics.avg_likes.confidence,
  };
  const avgReelsPlaysMetric: MetricWithConfidence = {
    value: engagementMetricBundle.avgReelsPlays,
    confidence:
      engagementMetricBundle.avgReelsPlays != null
        ? displayCreator.metrics.avg_views.confidence
        : "estimated",
  };

  const matchedDetail = detail?.unifiedId === identityCreator.unified_id ? detail : null;
  const loading = matchedDetail == null;
  const history = matchedDetail?.history ?? null;
  const quotationPriceReference = matchedDetail?.quotationPriceReference ?? null;

  const primary = selectedPlatform;
  const handle = selectedPlatform?.handle ? `@${selectedPlatform.handle.replace(/^@/, "")}` : null;
  const hasContact = creatorHasAnyContact(identityCreator);
  const profileUrl = selectedPlatform
    ? resolvePrimaryProfileUrl([selectedPlatform])
    : resolvePrimaryProfileUrl(platforms);
  const platformName = primary ? platformLabel(primary.platform) : null;
  const canAssign = isAssignableCreator(identityCreator) && Boolean(onAssign);
  const latestFollowers = history?.followers.at(-1)?.value ?? null;
  const displayCategories = resolveDiscoveryCreatorDisplayCategories(displayCreator);
  const brandCategory =
    displayCategories[0] ??
    displayCreator.ai_niche ??
    displayCreator.ai_category ??
    "No niche tagged";
  const investmentScore =
    displayCreator.eci_investment_score != null &&
    Number.isFinite(displayCreator.eci_investment_score)
      ? Math.min(100, Math.max(0, Math.round(displayCreator.eci_investment_score)))
      : null;
  const investmentRecommendation =
    displayCreator.eci_investment_recommendation?.trim() || null;
  const brandFitWidth =
    investmentScore != null
      ? `${Math.max(8, Math.round((investmentScore / 100) * 32))}px`
      : "32px";

  function handleCreatorUpdated(
    next: UnifiedCreatorResult,
    options?: CreatorDetailSheetUpdateMeta
  ) {
    const previous = baseCreator ?? creator;
    setBaseCreator(next);
    setEnrichmentStatus(resolveCreatorEnrichmentStatus(next.enrichment_status));

    if (
      !options?.forceListSync &&
      !options?.removedUnifiedId &&
      previous &&
      creatorListRowEquivalent(previous, next)
    ) {
      return;
    }

    onCreatorUpdated?.(next, options);
  }

  function preventOutsideDismiss(event: { target: EventTarget | null; preventDefault: () => void }) {
    if (
      shouldPreventCreatorDetailSheetOutsideDismiss(event.target, {
        preserveOnCreatorRows: preserveOpenOnCreatorRows,
      })
    ) {
      event.preventDefault();
    }
  }

  const nestedDialogOpen =
    addPlatformOpen ||
    editContactOpen ||
    editAveragePriceOpen ||
    editProfileUrlOpen ||
    combineCreatorsOpen ||
    deletePlatformOpen ||
    similarMaximizedOpen;
  const canEditProfileUrl = Boolean(identityCreator.influencer_id && selectedPlatform);
  const canCombineCreators = Boolean(identityCreator.influencer_id);

  function openSimilarCreatorsMaximize() {
    setSimilarMaximizedOpen(true);
    const unifiedId = identityCreator.unified_id;
    setMaximizedSimilarLoading(true);
    void getSimilarCreatorsAction(unifiedId, SIMILAR_CREATORS_MAXIMIZE_LIMIT).then((results) => {
      if (identityCreator.unified_id !== unifiedId) return;
      setMaximizedSimilar(results);
      setMaximizedSimilarLoading(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && nestedDialogOpen) return;
        onOpenChange(nextOpen);
      }}
      modal={false}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        showOverlay={false}
        style={CREATOR_DETAIL_SHEET_STYLE}
        className={CREATOR_DETAIL_SHEET_CLASS}
        onInteractOutside={preventOutsideDismiss}
        onPointerDownOutside={preventOutsideDismiss}
        onFocusOutside={preventOutsideDismiss}
      >
        <SheetTitle className="sr-only">{identityCreator.display_name} creator profile</SheetTitle>
        <SheetDescription className="sr-only">
          Creator profile, metrics confidence, and similar creators.
        </SheetDescription>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DetailTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="creator-detail-sheet-command-bar-wrap shrink-0">
            <div className="creator-detail-sheet-command-bar">
            <div className="creator-detail-sheet-command-bar__actions">
              <div className="creator-detail-sheet-command-bar__context">
                <PanelLeftIcon className="creator-detail-sheet-command-bar__context-icon" aria-hidden />
                <span className="truncate">
                  {platformName ?? "Creator"}
                  {handle ? (
                    <>
                      <span> · </span>
                      <span className="creator-detail-sheet-command-bar__context-handle">{handle}</span>
                    </>
                  ) : null}
                </span>
              </div>
              <div className="creator-detail-sheet-command-bar__action-group">
                {identityCreator.influencer_id ? (
                  <RefreshCreatorMenu
                    influencerId={identityCreator.influencer_id}
                    unifiedId={identityCreator.unified_id}
                    enrichmentStatus={enrichmentStatus}
                    size="sm"
                    variant="outline"
                    className="creator-detail-sheet-action-btn"
                    onStatusChange={setEnrichmentStatus}
                    onCreatorUpdated={handleCreatorUpdated}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="creator-detail-sheet-action-btn"
                    disabled
                  >
                    <RefreshCwIcon aria-hidden />
                    Refresh Metrics
                  </Button>
                )}
                {profileUrl ? (
                  <Button asChild variant="outline" size="sm" className="creator-detail-sheet-action-btn">
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon aria-hidden />
                      {platformName ? `View on ${platformName}` : "View profile"}
                    </a>
                  </Button>
                ) : null}
                {canEditProfileUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="creator-detail-sheet-action-btn"
                    onClick={() => setEditProfileUrlOpen(true)}
                  >
                    <PencilIcon aria-hidden />
                    Edit URL
                  </Button>
                ) : null}
                {canCombineCreators ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="creator-detail-sheet-action-btn"
                    onClick={() => setCombineCreatorsOpen(true)}
                  >
                    <GitMergeIcon aria-hidden />
                    Combine
                  </Button>
                ) : null}
                <SheetClose asChild>
                  <button
                    type="button"
                    className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--icon"
                    aria-label="Close"
                  >
                    <XIcon aria-hidden />
                  </button>
                </SheetClose>
              </div>
            </div>

            <div className="creator-detail-sheet-command-bar__body">
              <CreatorDetailSheetIdentityCard
                creator={identityCreator}
                profileUrl={profileUrl}
              />

              {platforms.length > 0 ? (
                <div className="creator-detail-sheet-platform-scope">
                  <div className="creator-detail-sheet-platform-row">
                    {platforms.map((platform) => {
                      const active = platform.id === selectedPlatformAccountId;
                      const canRemovePlatform =
                        Boolean(identityCreator.influencer_id) && platforms.length >= 2;
                      return (
                        <div
                          key={platform.id}
                          className={cn(
                            "creator-detail-sheet-platform-pill",
                            active && "creator-detail-sheet-platform-pill--active"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedPlatformAccountId(platform.id)}
                            className="creator-detail-sheet-platform-pill__select"
                          >
                            <PlatformIcon platform={platform.platform} size="xs" className="size-3 rounded-full border-0" />
                            {platformLabel(platform.platform)}
                          </button>
                          {canRemovePlatform ? (
                            <button
                              type="button"
                              className="creator-detail-sheet-platform-pill__remove"
                              aria-label={`Remove ${platformLabel(platform.platform)} profile`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPlatformToDelete(platform);
                                setDeletePlatformOpen(true);
                              }}
                            >
                              <XIcon className="size-3" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setAddPlatformOpen(true)}
                      className="creator-detail-sheet-platform-pill creator-detail-sheet-platform-pill--add"
                      aria-label="Add platform profile"
                    >
                      <PlusIcon className="size-3" aria-hidden />
                      Add
                    </button>
                  </div>
                  <p className="creator-detail-sheet-platform-scope__note">
                    Switching platform rewrites platform-scoped figures below.
                  </p>
                </div>
              ) : (
                <div className="creator-detail-sheet-platform-row">
                  <button
                    type="button"
                    onClick={() => setAddPlatformOpen(true)}
                    className="creator-detail-sheet-platform-pill creator-detail-sheet-platform-pill--add"
                  >
                    <PlusIcon className="size-3" aria-hidden />
                    Add platform
                  </button>
                </div>
              )}

              <TabsList
                variant="line"
                className="creator-detail-sheet-tabs h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
              >
                <TabsTrigger value="overview" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="contact" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Contact
                </TabsTrigger>
                <TabsTrigger value="publications" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Publications
                </TabsTrigger>
                <TabsTrigger value="confidence" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Confidence
                </TabsTrigger>
                <TabsTrigger value="similar" className={cn(DETAIL_TAB_TRIGGER_CLASS, "lg:hidden")}>
                  Similar creators
                </TabsTrigger>
              </TabsList>
            </div>
            </div>
          </div>

          <div className="creator-detail-sheet-main min-h-0 flex-1">
            <div className="creator-detail-sheet-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
            <TabsContent value="overview" className="mt-0 outline-none">
              <div className="min-w-0">
                  <DetailSection>
                    <div className="creator-detail-sheet-highlight-grid">
                      <div className="creator-detail-sheet-highlight-card creator-detail-sheet-highlight-card--score">
                        <p className="creator-detail-sheet-highlight-card__label">Investment score</p>
                        <p className="creator-detail-sheet-highlight-card__value">
                          {investmentScore != null ? (
                            investmentScore
                          ) : eciLoading && !eciLoadingSkipped ? (
                            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="creator-detail-sheet-highlight-card__meta">
                          {investmentRecommendation ??
                            (eciLoading && !eciLoadingSkipped
                              ? "Loading Enterprise Creator Intelligence…"
                              : `Source confidence ${Math.round(displayCreator.source_confidence)}%`)}
                        </p>
                        {eciLoading && !eciLoadingSkipped ? (
                          <div
                            className="creator-detail-sheet-eci-loading"
                            role="status"
                            aria-live="polite"
                          >
                            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                            <span>Loading Enterprise Creator Intelligence</span>
                            <button
                              type="button"
                              className="creator-detail-sheet-eci-loading__skip"
                              onClick={() => setEciLoadingSkipped(true)}
                            >
                              Skip
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="creator-detail-sheet-highlight-card">
                        <p className="creator-detail-sheet-highlight-card__label">Category</p>
                        <div
                          className="creator-detail-sheet-highlight-card__bar"
                          style={{ width: brandFitWidth }}
                        />
                        <p className="creator-detail-sheet-highlight-card__category">{brandCategory}</p>
                        {investmentScore != null ? (
                          <p className="creator-detail-sheet-highlight-card__meta">
                            Investment {investmentScore}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DetailSection>

                  {formatCreatorCountryLabels(identityCreator) !== "—" ? (
                    <DetailSection>
                      <SectionTitle icon={<UsersIcon className="size-3" />}>
                        Location
                      </SectionTitle>
                      <CreatorCountriesDisplay creator={identityCreator} variant="stacked" />
                    </DetailSection>
                  ) : null}

                  {identityCreator.influencer_id ? (
                    <DetailSection>
                      <SectionTitle icon={<DollarSignIcon className="size-3" />}>
                        Pricing
                      </SectionTitle>
                      <div className="space-y-3">
                        <CreatorAveragePriceCard
                          creator={identityCreator}
                          onEdit={() => setEditAveragePriceOpen(true)}
                        />
                        <CreatorQuotationPriceReferencePanel
                          reference={quotationPriceReference}
                          loading={loading && quotationPriceReference == null}
                          compact
                        />
                      </div>
                    </DetailSection>
                  ) : null}

                  {(displayCreator.bio ||
                    (displayCreator.hashtags?.length ?? 0) > 0 ||
                    (displayCreator.mentions?.length ?? 0) > 0) && (
                    <DetailSection>
                      <SectionTitle icon={<TextQuoteIcon className="size-3" />}>Profile</SectionTitle>
                      {displayCreator.bio ? (
                        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
                          {displayCreator.bio}
                        </p>
                      ) : null}
                      {(displayCreator.hashtags?.length ?? 0) > 0 ||
                      (displayCreator.mentions?.length ?? 0) > 0 ? (
                        <div
                          className={cn(
                            "grid grid-cols-1 gap-3.5",
                            displayCreator.bio ? "mt-3.5" : undefined
                          )}
                        >
                          {(displayCreator.hashtags?.length ?? 0) > 0 ? (
                            <div>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                                Hashtags
                              </p>
                              <ProfileTagChips tags={displayCreator.hashtags ?? []} variant="hashtag" />
                            </div>
                          ) : null}
                          {(displayCreator.mentions?.length ?? 0) > 0 ? (
                            <div>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                                Mentions
                              </p>
                              <ProfileTagChips tags={displayCreator.mentions ?? []} variant="mention" />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </DetailSection>
                  )}

                  {identityCreator.influencer_id || hasContact ? (
                    <DetailSection>
                      <SectionTitle icon={<MailIcon className="size-3" />}>Contact</SectionTitle>
                      <div className="flex flex-wrap items-center gap-3">
                        {hasContact ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("contact")}
                            className="text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            View contact details →
                          </button>
                        ) : (
                          <p className="text-[12px] text-muted-foreground">No contact details yet</p>
                        )}
                        {identityCreator.influencer_id ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 px-2.5 text-[11px]"
                            onClick={() => setEditContactOpen(true)}
                          >
                            {hasContact ? (
                              <PencilIcon className="size-3" aria-hidden />
                            ) : (
                              <PlusIcon className="size-3" aria-hidden />
                            )}
                            {hasContact ? "Edit" : "Add contact"}
                          </Button>
                        ) : null}
                      </div>
                    </DetailSection>
                  ) : null}

                  <DetailSection>
                    <SectionTitle icon={<UsersIcon className="size-3" />}>
                      Audience & engagement
                    </SectionTitle>
                    <div className="creator-detail-sheet-kpi-grid">
                      <KpiCard label="Followers" metric={displayCreator.metrics.followers} />
                      <KpiCard
                        label="Engagement"
                        metric={displayCreator.metrics.engagement_rate}
                        suffix="%"
                      />
                      <KpiCard
                        label="Avg. Engagements"
                        metric={avgEngagementsMetric}
                        description={CREATOR_METRIC_DEFINITIONS.avg_engagements}
                      />
                    </div>
                    <div className="creator-detail-sheet-kpi-grid mt-2.5">
                      <KpiCard
                        label="Avg. Likes"
                        metric={avgLikesMetric}
                        description={CREATOR_METRIC_DEFINITIONS.avg_likes}
                      />
                      <KpiCard
                        label="Avg. Reels Plays"
                        metric={avgReelsPlaysMetric}
                        description={CREATOR_METRIC_DEFINITIONS.avg_reels_plays}
                      />
                      <KpiCard
                        label="Posts / week"
                        metric={displayCreator.metrics.posting_frequency_per_week}
                      />
                    </div>
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle
                      icon={<ImageIcon className="size-3" />}
                      action={
                        (displayCreator.recent_publications?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("publications")}
                            className="ml-auto text-[10px] font-semibold normal-case tracking-normal text-blue-600 hover:underline dark:text-blue-400"
                          >
                            View all →
                          </button>
                        ) : null
                      }
                    >
                      Recent publications
                    </SectionTitle>
                    <RecentPublicationsGallery
                      publications={displayCreator.recent_publications ?? []}
                      variant="drawer"
                      columns={3}
                      imageHeightClass="h-[100px]"
                      limit={3}
                    />
                  </DetailSection>

                  <DetailSection className="lg:hidden">
                    <SectionTitle
                      icon={<UsersIcon className="size-3" />}
                      action={
                        <button
                          type="button"
                          className="creator-detail-sheet-similar-rail__maximize"
                          aria-label="Maximize similar creators"
                          title="Maximize similar creators"
                          onClick={openSimilarCreatorsMaximize}
                        >
                          <Maximize2Icon className="size-3.5" aria-hidden />
                        </button>
                      }
                    >
                      Similar creators
                    </SectionTitle>
                    <SimilarCreatorsList similar={similar} loading={similarLoading} />
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle icon={<ShieldCheckIcon className="size-3" />}>
                      Confidence & authenticity
                    </SectionTitle>
                    <ConfidenceRows displayCreator={displayCreator} />
                  </DetailSection>
                </div>
            </TabsContent>

            <TabsContent value="contact" className="mt-0 outline-none">
              <ContactPanel
                identityCreator={identityCreator}
                platforms={platforms}
                enrichmentStatus={enrichmentStatus}
                onEditContact={() => setEditContactOpen(true)}
                onEnrichmentStatusChange={setEnrichmentStatus}
                onCreatorUpdated={handleCreatorUpdated}
              />
            </TabsContent>

            <TabsContent value="publications" className="mt-0 outline-none">
              <DetailSection className="border-b-0">
                <SectionTitle icon={<ImageIcon className="size-3" />}>All publications</SectionTitle>
                <RecentPublicationsGallery
                  publications={displayCreator.recent_publications ?? []}
                  variant="drawer"
                  columns={3}
                  imageHeightClass="h-[140px]"
                />
              </DetailSection>
            </TabsContent>

            <TabsContent value="confidence" className="mt-0 outline-none">
              <ConfidencePanel
                displayCreator={displayCreator}
                history={history}
                loading={loading}
                latestFollowers={latestFollowers}
              />
            </TabsContent>

            <TabsContent value="similar" className="mt-0 outline-none">
              <DetailSection className="border-b-0">
                <SectionTitle
                  icon={<UsersIcon className="size-3" />}
                  action={
                    <button
                      type="button"
                      className="creator-detail-sheet-similar-rail__maximize"
                      aria-label="Maximize similar creators"
                      title="Maximize similar creators"
                      onClick={openSimilarCreatorsMaximize}
                    >
                      <Maximize2Icon className="size-3.5" aria-hidden />
                    </button>
                  }
                >
                  Similar creators
                </SectionTitle>
                <SimilarCreatorsList similar={similar} loading={similarLoading} />
              </DetailSection>
            </TabsContent>
          </div>

            <aside className="creator-detail-sheet-similar-rail hidden lg:flex">
              <div className="creator-detail-sheet-similar-rail__inner">
                <SectionTitle
                  icon={<UsersIcon className="size-3 text-[#0057FF]" />}
                  action={
                    <button
                      type="button"
                      className="creator-detail-sheet-similar-rail__maximize"
                      aria-label="Maximize similar creators"
                      title="Maximize similar creators"
                      onClick={openSimilarCreatorsMaximize}
                    >
                      <Maximize2Icon className="size-3.5" aria-hidden />
                    </button>
                  }
                >
                  Similar creators
                </SectionTitle>
                <div className="creator-detail-sheet-similar-rail__scroll">
                  <SimilarCreatorsList similar={similar} loading={similarLoading} compact />
                </div>
              </div>
            </aside>
          </div>
        </Tabs>

        {canAssign || campaignHeaderId ? (
          <div className="creator-detail-sheet-footer">
            <div className="creator-detail-sheet-footer__actions">
              {campaignHeaderId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="creator-detail-sheet-action-btn"
                  onClick={() =>
                    void addCreatorToCampaignShortlistAction(campaignHeaderId, identityCreator)
                  }
                >
                  Save to shortlist
                </Button>
              ) : null}
              {canAssign ? (
                <Button
                  size="sm"
                  className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary"
                  onClick={() => onAssign?.(identityCreator)}
                >
                  Assign to line
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>

      <SimilarCreatorsMaximizeDialog
        open={similarMaximizedOpen}
        onOpenChange={setSimilarMaximizedOpen}
        creatorName={identityCreator.display_name}
        similar={maximizedSimilar ?? similar}
        loading={maximizedSimilarLoading && maximizedSimilar == null}
      />

      <AddCreatorPlatformDialog
        open={addPlatformOpen}
        onOpenChange={setAddPlatformOpen}
        creatorName={identityCreator.display_name}
        unifiedId={identityCreator.unified_id}
        influencerId={identityCreator.influencer_id}
        discoveredProfileId={identityCreator.discovered_profile_id}
        existingPlatforms={platforms.map((p) => p.platform)}
        onSuccess={(next, platformAccountId) => {
          handleCreatorUpdated(next);
          setSelectedPlatformAccountId(platformAccountId);
        }}
        onEnrichmentStatusChange={(_unifiedId, status) => {
          setEnrichmentStatus(status);
        }}
        onCreatorUpdated={handleCreatorUpdated}
      />

      <EditCreatorContactDialog
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        creator={identityCreator}
        onSaved={handleCreatorUpdated}
      />

      <EditCreatorProfileUrlDialog
        open={editProfileUrlOpen}
        onOpenChange={setEditProfileUrlOpen}
        creator={identityCreator}
        platform={selectedPlatform}
        onSaved={handleCreatorUpdated}
        onEnrichmentStatusChange={(_unifiedId, status) => {
          setEnrichmentStatus(status);
        }}
      />

      <CombineCreatorsDialog
        open={combineCreatorsOpen}
        onOpenChange={setCombineCreatorsOpen}
        targetCreator={identityCreator}
        onMerged={(next, meta: CombineCreatorsMergedMeta) =>
          handleCreatorUpdated(next, {
            forceListSync: true,
            removedUnifiedId: meta.removedUnifiedId,
            removedInfluencerId: meta.removedInfluencerId,
          })
        }
      />

      <EditCreatorAveragePriceDialog
        open={editAveragePriceOpen}
        onOpenChange={setEditAveragePriceOpen}
        creator={identityCreator}
        onSaved={handleCreatorUpdated}
      />

      <DeleteCreatorPlatformDialog
        open={deletePlatformOpen}
        onOpenChange={(open) => {
          setDeletePlatformOpen(open);
          if (!open) {
            if (deletePlatformResetTimeoutRef.current != null) {
              window.clearTimeout(deletePlatformResetTimeoutRef.current);
            }
            deletePlatformResetTimeoutRef.current = window.setTimeout(() => {
              setPlatformToDelete(null);
              deletePlatformResetTimeoutRef.current = null;
            }, 200);
          }
        }}
        creator={identityCreator}
        platform={platformToDelete}
        onDeleted={(next, removedPlatformAccountId) => {
          detailFetchGenerationRef.current += 1;
          handleCreatorUpdated(next, { forceListSync: true });
          setSelectedPlatformAccountId((current) => {
            if (current !== removedPlatformAccountId) return current;
            return (
              next.default_metrics_platform_account_id ??
              next.platforms[0]?.id ??
              null
            );
          });
        }}
      />
    </Sheet>
  );
}
