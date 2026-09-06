"use client";

import type { ReactNode } from "react";

import { PublicationPreviewImage } from "@/components/creator/publication-preview-image";
import { TabsContent } from "@/components/ui/tabs";
import { RefreshCreatorMenu } from "@/features/discovery/enrichment/components/refresh-creator-menu";
import { platformLabel } from "@/lib/campaigns/line-assignment";
import {
  resolveCreatorContactSections,
  type PlatformContactSection,
} from "@/lib/creators/contact-info";
import {
  resolveDiscoveryCreatorDisplayCategories,
  takeDiscoveryCategoryChips,
} from "@/lib/creators/creator-display-categories";
import type { CreatorQuotationPriceReference } from "@/lib/creators/quotation-price-reference";
import type {
  CreatorEnrichmentStatus,
  CreatorHistoricalMetrics,
  CreatorRecentPublication,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { AB, D } from "@/lib/discovery/suite/helpers";
import { formatPricing, parseRateCard } from "@/features/vendors/utils";

import { formatDiscoveryPackQuoteReference } from "./discovery-suite-creator-profile";

function Note({
  children,
  warning,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return <div className={warning ? "tw-note wrn" : "tw-note"}>{children}</div>;
}

function Section({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="tw-sec2">
      <div className="h">
        {title}
        {badge}
        {action ? <span className="tw-sp" /> : null}
        {action}
      </div>
      {children}
    </div>
  );
}

function OutRow({
  label,
  value,
  missing,
  total,
}: {
  label: string;
  value: ReactNode;
  missing?: boolean;
  total?: boolean;
}) {
  return (
    <div className={total ? "r tot" : "r"}>
      <span>{label}</span>
      <b className={missing ? "tw-miss" : undefined}>{value}</b>
    </div>
  );
}

function formatEngagement(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(2)}%`;
}

function formatPostsPerWeek(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function platformBadgeClass(platform: string | null | undefined): string {
  const key = (platform ?? "").toLowerCase();
  return key === "instagram" || key === "ig" ? "p-v" : "p-n";
}

function monthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function publicationsRangeNote(publications: CreatorRecentPublication[]): ReactNode {
  const dated = publications
    .map((pub) => {
      const at = pub.posted_at ? new Date(pub.posted_at) : null;
      return {
        pub,
        at: at && !Number.isNaN(at.getTime()) ? at : null,
      };
    })
    .filter((row) => row.at);

  if (dated.length === 0) {
    return (
      <>
        Publication dates are not on file for this set. Averages here should be read as a snapshot,
        not a trend.
      </>
    );
  }

  const sorted = [...dated].sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const first = monthYear(sorted[0]!.at!.toISOString());
  const last = monthYear(sorted[sorted.length - 1]!.at!.toISOString());
  const topPlays = [...dated]
    .filter((row) => row.pub.views != null && Number.isFinite(row.pub.views))
    .sort((a, b) => (b.pub.views ?? 0) - (a.pub.views ?? 0))
    .slice(0, 2);

  return (
    <>
      Publication dates run from <b>{first}</b>
      {last && last !== first ? (
        <>
          {" "}
          to <b>{last}</b>
        </>
      ) : null}
      .{" "}
      {topPlays.length >= 2 ? (
        <>
          The strongest numbers — {AB(topPlays[0]!.pub.views)} and {AB(topPlays[1]!.pub.views)} plays
          — come from {monthYear(topPlays[0]!.at!.toISOString())} and{" "}
          {monthYear(topPlays[1]!.at!.toISOString())}, so any average across this set is carrying
          older results alongside current ones.
        </>
      ) : (
        <>Any average across this set should be read with the date span in mind.</>
      )}
    </>
  );
}

function packPublicationCaption(caption: string | null | undefined): string {
  const normalized = caption?.trim().replace(/\s+/g, " ");
  if (!normalized) return "Untitled publication";
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 87).trimEnd()}…`;
}

function PackPublicationCard({ pub }: { pub: CreatorRecentPublication }) {
  const body = (
    <>
      <div className="im">
        <PublicationPreviewImage publication={pub} emptyGlyph="▣" />
      </div>
      <div className="tx">
        <p>{packPublicationCaption(pub.caption)}</p>
        <div className="mm">
          <span>♡ {AB(pub.likes)}</span>
          <span>💬 {pub.comments ?? "—"}</span>
          {pub.views != null ? <span>▷ {AB(pub.views)}</span> : null}
        </div>
        {pub.posted_at ? (
          <div className="tw-d" style={{ marginTop: 4 }}>
            {D(pub.posted_at)}
          </div>
        ) : null}
      </div>
    </>
  );

  if (pub.url) {
    return (
      <a className="tw-pub" href={pub.url} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }

  return <div className="tw-pub">{body}</div>;
}

function PackPublicationsGrid({
  publications,
  limit,
}: {
  publications: CreatorRecentPublication[];
  limit?: number;
}) {
  const rows = limit != null ? publications.slice(0, limit) : publications;
  if (rows.length === 0) {
    return (
      <div className="tw-empty" style={{ padding: "26px 16px" }}>
        <b>No publications yet</b>
        <p>Refresh metrics or enrich this profile to pull recent posts into Discovery.</p>
      </div>
    );
  }
  return (
    <div className="tw-pubs">
      {rows.map((pub, index) => (
        <PackPublicationCard key={`${pub.url ?? pub.posted_at ?? "pub"}-${index}`} pub={pub} />
      ))}
    </div>
  );
}

function PackContactRows({ section }: { section: PlatformContactSection }) {
  const { contact } = section;
  const title =
    section.platform === "profile" ? "Creator profile" : platformLabel(section.platform);
  return (
    <div className="tw-out" style={{ margin: "0 0 10px" }}>
      <OutRow
        label={title}
        value={section.handle ? `@${section.handle}` : "—"}
      />
      {contact.contact_email ? <OutRow label="Email" value={contact.contact_email} /> : null}
      {contact.contact_phone ? <OutRow label="Phone" value={contact.contact_phone} /> : null}
      {contact.contact_links.map((link) => (
        <OutRow
          key={link}
          label="Link"
          value={
            <a href={link} target="_blank" rel="noopener noreferrer">
              {link.replace(/^https?:\/\//i, "")}
            </a>
          }
        />
      ))}
    </div>
  );
}

type Props = {
  displayCreator: UnifiedCreatorResult;
  identityCreator: UnifiedCreatorResult;
  platformName: string | null;
  platformKey: string | null;
  followers: number | null;
  engagement: number | null;
  avgEngagements: number | null;
  avgLikes: number | null;
  avgPlays: number | null;
  postsPerWeek: number | null;
  publications: CreatorRecentPublication[];
  quotationPriceReference: CreatorQuotationPriceReference | null;
  history: CreatorHistoricalMetrics | null;
  historyLoading: boolean;
  latestFollowers: number | null;
  enrichmentStatus: CreatorEnrichmentStatus;
  onShowPublications: () => void;
  onEditContact: () => void;
  onEditAveragePrice: () => void;
  onEnrichmentStatusChange: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated: (creator: UnifiedCreatorResult) => void;
};

export function DiscoverySuiteCreatorProfileTabs({
  displayCreator,
  identityCreator,
  platformName,
  platformKey,
  followers,
  engagement,
  avgEngagements,
  avgLikes,
  avgPlays,
  postsPerWeek,
  publications,
  quotationPriceReference,
  history,
  historyLoading,
  latestFollowers,
  enrichmentStatus,
  onShowPublications,
  onEditContact,
  onEditAveragePrice,
  onEnrichmentStatusChange,
  onCreatorUpdated,
}: Props) {
  const rate = parseRateCard(identityCreator.rate_card);
  const hasRate = rate.base_rate != null && !Number.isNaN(rate.base_rate);
  const quoteCount = quotationPriceReference?.quote_count ?? 0;
  const quoteAmount = quotationPriceReference?.avg_cost ?? rate.base_rate ?? null;
  const quoteCurrency =
    quotationPriceReference?.avg_cost_currency ??
    rate.currency ??
    identityCreator.suggested_currency ??
    "EGP";
  const quoteLabel = formatDiscoveryPackQuoteReference({
    amount: quoteAmount,
    currency: quoteCurrency,
  });
  const studioLabel =
    quoteAmount != null
      ? formatDiscoveryPackQuoteReference({ amount: quoteAmount, currency: quoteCurrency })
      : "—";
  const contactSections = resolveCreatorContactSections({
    platforms: identityCreator.platforms,
    contact_email: identityCreator.contact_email,
    contact_phone: identityCreator.contact_phone,
    contact_links: identityCreator.contact_links,
  });
  const hasContact = contactSections.length > 0;
  const canEdit = Boolean(identityCreator.influencer_id);
  const canEnrich = Boolean(identityCreator.influencer_id);
  const categories = resolveDiscoveryCreatorDisplayCategories(displayCreator);
  const sourceConfidence = Math.round(displayCreator.source_confidence);
  const verified = displayCreator.is_platform_verified;
  const authenticity =
    displayCreator.authenticity_score != null && Number.isFinite(displayCreator.authenticity_score)
      ? String(displayCreator.authenticity_score)
      : null;
  const platformLabelText = platformName ?? "this platform";

  return (
    <>
      <TabsContent value="overview" className="mt-0 outline-none">
        <Section
          title="Audience & engagement"
          badge={
            platformName ? (
              <span className={`tw-p ${platformBadgeClass(platformKey)}`}>{platformName}</span>
            ) : null
          }
        >
          <div className="tw-mgrid">
            {(
              [
                ["Followers", AB(followers)],
                ["Engagement", formatEngagement(engagement)],
                ["Avg engagements", AB(avgEngagements)],
                ["Avg likes", AB(avgLikes)],
                ["Avg plays", AB(avgPlays)],
                ["Posts / week", formatPostsPerWeek(postsPerWeek)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <i>{label}</i>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <Note>
            These six figures are <b>{platformLabelText} only</b> and change with the chip above.
            Investment score, category, location and pricing sit on the creator and stay the same on
            both platforms.
          </Note>
        </Section>

        <Section title="Pricing">
          <div className="tw-out" style={{ margin: 0 }}>
            <OutRow
              label="Average price per content"
              value={hasRate ? formatPricing(identityCreator.rate_card) : "not set"}
              missing={!hasRate}
            />
            <OutRow
              label={
                platformName ? `Quotation reference · ${platformName}` : "Quotation reference"
              }
              value={quoteCount > 0 && quotationPriceReference ? `${quoteLabel} avg` : quoteLabel}
            />
            <OutRow label="Quotes behind it" value={String(quoteCount)} />
            <OutRow label="Studio reference" value={studioLabel} total />
          </div>
          <div className="tw-hint" style={{ marginTop: 7 }}>
            Vendor rate card is used only when quotation averages are unavailable.
            {quoteCount === 1
              ? " This creator has one quote, so the average rests on a single data point."
              : quoteCount > 1
                ? ` This average rests on ${quoteCount} quotes.`
                : hasRate
                  ? " No quotation average yet — the studio reference uses the vendor rate card."
                  : null}
          </div>
          {canEdit ? (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="tw-b sm" onClick={onEditAveragePrice}>
                {hasRate ? "Edit average price" : "Set average price"}
              </button>
            </div>
          ) : null}
        </Section>

        <Section
          title="Recent publications"
          action={
            publications.length > 0 ? (
              <button type="button" className="tw-b sm" onClick={onShowPublications}>
                View all →
              </button>
            ) : null
          }
        >
          <PackPublicationsGrid publications={publications} limit={3} />
        </Section>
      </TabsContent>

      <TabsContent value="contact" className="mt-0 outline-none">
        <Section
          title="Contact information"
          action={
            canEdit ? (
              <button type="button" className="tw-b sm" onClick={onEditContact}>
                {hasContact ? "Edit contact" : "+ Add contact"}
              </button>
            ) : null
          }
        >
          {hasContact ? (
            contactSections.map((section) => (
              <PackContactRows key={section.accountId} section={section} />
            ))
          ) : (
            <div className="tw-empty" style={{ padding: "30px 16px" }}>
              <b>No contact information yet</b>
              <p>
                Add email, phone or links manually — or run enrichment to pull them from the
                profile.
              </p>
              <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {canEnrich ? (
                  <RefreshCreatorMenu
                    influencerId={identityCreator.influencer_id!}
                    unifiedId={identityCreator.unified_id}
                    enrichmentStatus={enrichmentStatus}
                    size="sm"
                    variant="outline"
                    className="tw-b tw-cp__pack-refresh"
                    label="Run enrichment"
                    onStatusChange={onEnrichmentStatusChange}
                    onCreatorUpdated={onCreatorUpdated}
                  />
                ) : null}
                {canEdit ? (
                  <button type="button" className="tw-b pri" onClick={onEditContact}>
                    Add contact details
                  </button>
                ) : null}
              </span>
            </div>
          )}
        </Section>
        {!hasContact ? (
          <Note warning>
            Outreach has to go through the platform until a contact exists — there is no email or
            phone on this creator, and nothing records who owns the relationship.
          </Note>
        ) : null}
      </TabsContent>

      <TabsContent value="publications" className="mt-0 outline-none">
        <Section
          title={`All publications · ${publications.length}`}
          action={
            publications.length > 0 ? (
              <button type="button" className="tw-b sm" onClick={onShowPublications}>
                View all →
              </button>
            ) : null
          }
        >
          <PackPublicationsGrid publications={publications} />
          {publications.length > 0 ? (
            <Note warning>{publicationsRangeNote(publications)}</Note>
          ) : null}
        </Section>
      </TabsContent>

      <TabsContent value="confidence" className="mt-0 outline-none">
        <Section title="Confidence & authenticity">
          <div className="tw-out" style={{ margin: 0, background: "#fff", borderColor: "var(--tw-hair)" }}>
            <OutRow label="Authenticity" value={authenticity ?? "not scored"} missing={!authenticity} />
            <OutRow label="Source confidence" value={`${sourceConfidence}%`} />
            <OutRow
              label="Verification"
              value={verified ? "Verified" : "Unverified"}
              missing={!verified}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="tw-lbl">Source confidence</div>
            <span className="tw-bar3">
              <i style={{ width: `${Math.min(100, Math.max(0, sourceConfidence))}%` }} />
            </span>
          </div>
        </Section>

        <Section title="Categories">
          {categories.length > 0 ? (
            <div className="tw-tags">
              {takeDiscoveryCategoryChips(categories, 5).map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
          ) : (
            <b className="tw-miss">not tagged</b>
          )}
        </Section>

        <Section title="Historical metrics">
          {historyLoading ? (
            <div className="tw-empty" style={{ padding: "26px 16px" }}>
              <b>Loading historical snapshots…</b>
              <p>The enrichment worker is assembling follower and engagement history.</p>
            </div>
          ) : history && history.followers.length > 0 ? (
            <div className="tw-out" style={{ margin: 0, background: "#fff", borderColor: "var(--tw-hair)" }}>
              <OutRow
                label="Follower snapshots"
                value={String(history.followers.length)}
              />
              <OutRow
                label="Latest"
                value={
                  latestFollowers != null ? `${latestFollowers.toLocaleString()} followers` : "—"
                }
              />
            </div>
          ) : (
            <div className="tw-empty" style={{ padding: "26px 16px" }}>
              <b>No historical snapshots yet</b>
              <p>
                The enrichment worker will populate trends once it has run more than once. Until
                then there is no way to see whether this audience is growing or shrinking.
              </p>
            </div>
          )}
        </Section>

        <Note warning>
          <b>
            Authenticity is {authenticity ? "scored" : "unscored"} and the account is{" "}
            {verified ? "verified" : "unverified"}
          </b>
          , yet source confidence reads {sourceConfidence}%. Confidence in the data is not the same
          as confidence in the audience.
        </Note>
      </TabsContent>
    </>
  );
}
