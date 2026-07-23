import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { QuotationDocument } from "@/features/quotations/export/quotation-document";
import {
  isCreatorDeckTemplate,
  isLumpSumPricingTemplate,
  isPitchTemplate,
  isShowcaseTemplate,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import { getReportPlatformIconTitle } from "@/lib/performance/report/report-platform-icons";
import {
  creatorCountLabel,
  formatQuotationMoneyDisplay,
  showcaseInitialsFromHandle,
  tierProfileCountLabel,
  tierSlugFromLabel,
  tierSummaryLabel,
} from "./quotation-template-format";
import type { QuotationTemplateFlags, QuotationTemplatePayload } from "./quotation-template-types";

const LUMP_SUM_NOTE =
  "Deliverables below are covered by a single lump-sum fee; individual creator pricing is not itemized.";

const COMPANY = {
  legalLine: "Thinkway · CR 57920 · VAT 780-879-732",
  address: "44B Saraya Mall, Sheikh Zayed, Giza, Egypt · hello@thinkwaymedia.com",
} as const;

function resolveTemplateFlags(template: QuotationTemplateVariant): QuotationTemplateFlags {
  switch (template) {
    case "lump-sum":
      return {
        showcaseCreators: false,
        pitchCreators: false,
        showCommercialSummary: true,
        pricing: "lump_sum",
        itemizedPricing: false,
        showFees: false,
        includeTerms: true,
        includeAcceptance: true,
      };
    case "showcase":
      return {
        showcaseCreators: true,
        pitchCreators: false,
        showCommercialSummary: false,
        pricing: "none",
        itemizedPricing: false,
        showFees: true,
        includeTerms: false,
        includeAcceptance: false,
      };
    case "pitch":
      return {
        showcaseCreators: true,
        pitchCreators: true,
        showCommercialSummary: false,
        pricing: "none",
        itemizedPricing: false,
        showFees: true,
        includeTerms: false,
        includeAcceptance: false,
      };
    case "pitch-lump-sum":
      return {
        showcaseCreators: true,
        pitchCreators: true,
        showCommercialSummary: true,
        pricing: "lump_sum",
        itemizedPricing: false,
        showFees: false,
        includeTerms: false,
        includeAcceptance: false,
      };
    case "showcase-lump-sum":
      return {
        showcaseCreators: true,
        pitchCreators: false,
        showCommercialSummary: true,
        pricing: "lump_sum",
        itemizedPricing: false,
        showFees: true,
        includeTerms: false,
        includeAcceptance: false,
      };
    default:
      return {
        showcaseCreators: false,
        pitchCreators: false,
        showCommercialSummary: true,
        pricing: "itemized",
        itemizedPricing: true,
        showFees: true,
        includeTerms: true,
        includeAcceptance: true,
      };
  }
}

function formatShowcaseQuotationTitle(name: string): string {
  const prefix = "Showcase Quotation — ";
  const rewritten = name.replace(/^Quotation\s+[—–-]\s*/i, prefix);
  if (rewritten !== name) return rewritten;
  return `${prefix}${name}`;
}

function formatPitchQuotationTitle(name: string): string {
  const prefix = "Pitch Presentation — ";
  const rewritten = name.replace(/^Quotation\s+[—–-]\s*/i, prefix);
  if (rewritten !== name) return rewritten;
  return `${prefix}${name}`;
}

function coverKicker(template: QuotationTemplateVariant): string {
  if (template === "lump-sum" || template === "pitch-lump-sum") {
    return "Client Quotation · Lump Sum";
  }
  if (isPitchTemplate(template)) return "Client Quotation · Pitch Presentation";
  if (isShowcaseTemplate(template)) return "Client Quotation · Showcase";
  return "Client Quotation";
}

function coverStat3(doc: QuotationDocument): QuotationTemplatePayload["cover"]["stat3"] {
  if (
    (isShowcaseTemplate(doc.template) || isPitchTemplate(doc.template)) &&
    !isLumpSumPricingTemplate(doc.template)
  ) {
    return {
      label: "Est. Engagement",
      value: doc.summary.estimatedEngagement,
      valueShort: doc.summary.estimatedEngagement,
    };
  }
  const label = isLumpSumPricingTemplate(doc.template)
    ? QUOTATION_CLIENT_LABELS.totalCost
    : QUOTATION_CLIENT_LABELS.clientInvestment;
  const value = isLumpSumPricingTemplate(doc.template)
    ? doc.summary.grandTotal
    : doc.summary.totalClientCost;
  const formatted = formatQuotationMoneyDisplay(value);
  return {
    label,
    value,
    valueShort: formatted.short,
  };
}

function insightFromBullets(bullets: string[]): QuotationTemplatePayload["insight"] {
  const normalize = (prefix: string, fallback: string) => {
    const match = bullets.find((bullet) =>
      bullet.toLowerCase().startsWith(prefix.toLowerCase())
    );
    if (!match) return fallback;
    return match
      .replace(/^Category mix:/i, "Category mix —")
      .replace(/^Tier mix:/i, "Tier mix —")
      .replace(/^Campaign scale:/i, "Scale —");
  };
  return {
    categoryMix: normalize("Category mix", ""),
    tierMix: normalize("Tier mix", ""),
    scale: normalize("Campaign scale", ""),
  };
}

function platformLabelFromRow(row: {
  platform: string;
  platformIcons: string[];
  allPlatforms: boolean;
}): string {
  if (row.allPlatforms) return "All platforms";
  if (row.platformIcons.length === 1) {
    return getReportPlatformIconTitle(row.platformIcons[0]!);
  }
  if (row.platform && row.platform !== "—") {
    return row.platform.charAt(0).toUpperCase() + row.platform.slice(1);
  }
  return "—";
}

function deliverableLabel(row: {
  deliverables: string;
  serviceDescription: string;
  type: string;
}): string {
  if (row.deliverables && row.deliverables !== "—") return row.deliverables;
  if (row.serviceDescription && row.serviceDescription !== "—") return row.serviceDescription;
  return row.type !== "—" ? row.type : "—";
}

function grossFeeAmount(row: { clientCost: string }): string | undefined {
  const egpTail = row.clientCost.match(/([\d,.\s]+)\s*EGP\s*$/i);
  if (egpTail?.[1]) return egpTail[1].trim();
  const parsed = row.clientCost.match(/^([\d,.\s]+)/);
  return parsed?.[1]?.trim();
}

function resolveSectionNumbers(input: {
  template: QuotationTemplateVariant;
  creatorCount: number;
  flags: QuotationTemplateFlags;
}): {
  commercial: string;
  roster: string;
  terms: string;
  acceptance: string;
} {
  const { template, creatorCount, flags } = input;
  if (isCreatorDeckTemplate(template)) {
    const rosterNo = String(creatorCount + 2).padStart(2, "0");
    const commercialNo = flags.showCommercialSummary
      ? String(creatorCount + 3).padStart(2, "0")
      : rosterNo;
    return {
      commercial: commercialNo,
      roster: rosterNo,
      terms: String(creatorCount + (flags.showCommercialSummary ? 4 : 3)).padStart(2, "0"),
      acceptance: String(creatorCount + (flags.showCommercialSummary ? 5 : 4)).padStart(2, "0"),
    };
  }
  return {
    commercial: "02",
    roster: "02",
    terms: "03",
    acceptance: "04",
  };
}

export function buildQuotationTemplatePayload(doc: QuotationDocument): QuotationTemplatePayload {
  const flags = resolveTemplateFlags(doc.template);
  const title = isPitchTemplate(doc.template)
    ? formatPitchQuotationTitle(doc.name)
    : isShowcaseTemplate(doc.template)
      ? formatShowcaseQuotationTitle(doc.name)
      : doc.name;
  const sectionNos = resolveSectionNumbers({
    template: doc.template,
    creatorCount: doc.summary.creatorCount,
    flags,
  });

  const commercialHeadline = flags.itemizedPricing
    ? "Client investment"
    : QUOTATION_CLIENT_LABELS.lumpSumCost.toLowerCase();
  const commercialSubtotal = flags.itemizedPricing
    ? QUOTATION_CLIENT_LABELS.totalClientCost
    : QUOTATION_CLIENT_LABELS.lumpSumCost;

  const totalClient = formatQuotationMoneyDisplay(doc.summary.totalClientCost);
  const totalAf = formatQuotationMoneyDisplay(doc.summary.totalAf);
  const grandTotal = formatQuotationMoneyDisplay(doc.summary.grandTotal);

  const feeLines = doc.creatorGroups.flatMap((group) =>
    group.rows
      .filter((row) => !row.isCollapsePackageFollower)
      .map((row) => ({
        creator:
          row.isCollapsePackageLeader && row.collapseOptionLabel
            ? `${group.creator} · ${row.collapseOptionLabel}`
            : group.handle !== "—"
              ? group.handle.replace(/^@/, "")
              : group.creator,
        avatarGroupKey:
          group.handle !== "—" ? group.handle.replace(/^@/, "") : group.creator,
        tier: row.tier !== "—" ? row.tier : "—",
        platform: platformLabelFromRow(row),
        deliverable: row.isCollapsePackageLeader
          ? `Collap package · ${deliverableLabel(row)}`
          : deliverableLabel(row),
        ...(flags.itemizedPricing ? { grossFee: grossFeeAmount(row) } : {}),
        avatarInitials: showcaseInitialsFromHandle(group.handle || group.creator),
      }))
  );

  const showcaseCreators = doc.creatorGroups.map((group, index) => {
    const platforms = new Set<string>();
    let allPlatforms = false;
    for (const row of group.rows) {
      if (row.allPlatforms) {
        allPlatforms = true;
        break;
      }
      row.platformIcons.forEach((platform) => platforms.add(getReportPlatformIconTitle(platform)));
    }
    if (allPlatforms) {
      platforms.clear();
      platforms.add("All platforms");
    } else if (!platforms.size && group.platform) {
      platforms.add(group.platform);
    }

    return {
      sectionNo: String(index + 2).padStart(2, "0"),
      index: index + 1,
      initials: showcaseInitialsFromHandle(group.handle || group.creator),
      name: group.creator,
      handle:
        group.handle !== "—"
          ? group.handle.startsWith("@")
            ? group.handle
            : `@${group.handle}`
          : group.creator,
      profileUrl: group.profileUrl,
      followers: group.followers,
      engagement: group.engagementRate,
      views: group.views,
      tier: group.rows[0]?.tier ?? "—",
      categories: group.categories.length ? group.categories.join(", ") : "—",
      platforms: platforms.size ? [...platforms].join(", ") : "—",
      platformIcons: allPlatforms
        ? []
        : [
            ...new Set(
              group.rows.flatMap((row) => (row.allPlatforms ? [] : row.platformIcons))
            ),
          ],
      publications: (group.publicationShots ?? [])
        .map((shot) => shot.imageUrl)
        .filter(Boolean),
      deliverables: group.rows
        .filter((row) => !row.isCollapsePackageFollower)
        .map((row) => ({
          option:
            row.isCollapsePackageLeader && row.collapseOptionLabel
              ? `Collap · ${row.collapseOptionLabel}`
              : row.option,
          service: row.isCollapsePackageLeader
            ? `Collap package · ${row.serviceDescription}`
            : row.serviceDescription,
          platform: platformLabelFromRow(row),
          platformIcons: row.allPlatforms ? [] : row.platformIcons,
          type: row.type,
          ...(flags.showFees ? { grossFee: grossFeeAmount(row) } : {}),
        })),
    };
  });

  const rosterRows = doc.creatorGroups.map((group) => {
    const platforms = new Set<string>();
    let allPlatforms = false;
    for (const row of group.rows) {
      if (row.allPlatforms) {
        allPlatforms = true;
        break;
      }
      row.platformIcons.forEach((platform) => platforms.add(getReportPlatformIconTitle(platform)));
    }
    return {
      handle:
        group.handle !== "—"
          ? group.handle.startsWith("@")
            ? group.handle
            : `@${group.handle}`
          : group.creator,
      followers: group.followers,
      er: group.engagementRate,
      views: group.views,
      tier: group.rows[0]?.tier ?? "—",
      categories: group.categories.length ? group.categories.join(", ") : "—",
      platforms: allPlatforms ? "All platforms" : platforms.size ? [...platforms].join(", ") : "—",
      platformIcons: allPlatforms
        ? []
        : [
            ...new Set(
              group.rows.flatMap((row) => (row.allPlatforms ? [] : row.platformIcons))
            ),
          ],
    };
  });

  const tierBreakdown = doc.summary.fullTierBreakdown;

  return {
    flags,
    quotation: {
      number: doc.serial,
      title,
      client: doc.clientName,
      brand: doc.brandName,
      preparedBy: doc.preparedByName,
      issueDate: doc.issueDateLabel,
      validUntil: doc.validityDateLabel,
      version: doc.version,
      status: doc.isExpired ? "EXPIRED" : doc.statusLabel.toUpperCase(),
    },
    cover: {
      kicker: coverKicker(doc.template),
      subtitle:
        doc.preparedForLine.replace(
          /^Prepared exclusively for /i,
          "Influencer marketing proposal prepared exclusively for "
        ) + ".",
      stat3: coverStat3(doc),
    },
    campaign: {
      creatorCount: String(doc.summary.creatorCount),
      tierSummary: tierSummaryLabel(doc.summary.tierBreakdown),
      estEngagement: doc.summary.estimatedEngagement,
    },
    categories: doc.summary.categoryBreakdown.map((row) => ({
      name: row.label,
      count: String(row.count),
      countLabel: creatorCountLabel(row.count),
      share: row.sharePct,
    })),
    tiers: tierBreakdown.sections.map((section) => ({
      name: section.sectionLabel.charAt(0) + section.sectionLabel.slice(1).toLowerCase(),
      slug: tierSlugFromLabel(section.sectionLabel),
      profileCount: tierProfileCountLabel(section.profileCount),
      followers: section.totalFollowersLabel,
      avgER: section.avgEngagementRate,
      creators: section.creators.map((creator) => ({
        handle: creator.handle,
        platform: creator.platform,
        followers: creator.followers,
        category: creator.category,
        er: creator.engagementRate,
      })),
    })),
    totals: {
      creatorCount: String(doc.summary.creatorCount),
      followers: tierBreakdown.grandTotalFollowers,
      avgER: tierBreakdown.grandTotalEngagementRate,
    },
    insight: insightFromBullets(doc.summary.insightBullets),
    commercial: {
      sectionNo: sectionNos.commercial,
      headlineLabel: commercialHeadline,
      headlineValue: totalClient.full,
      subtotalLabel: commercialSubtotal,
      subtotalValue: totalClient.full,
      agencyFee: totalAf.full,
      totalInclAF: grandTotal.full,
      lumpSumNote: LUMP_SUM_NOTE,
    },
    feeLines,
    showcaseCreators,
    roster: {
      sectionNo: sectionNos.roster,
      rows: rosterRows,
    },
    terms: {
      sectionNo: sectionNos.terms,
      items: doc.termsSections.map((section) => ({
        heading: section.title,
        body: section.body,
      })),
    },
    acceptance: {
      sectionNo: sectionNos.acceptance,
      revision: doc.revisionLine ?? `${doc.version} · Initial issue`,
      preparedByName: doc.preparedByNameSignature ?? doc.preparedByName,
    },
    company: { ...COMPANY },
    footer: {
      left: `Confidential · Thinkway Platform · ${doc.issueDateLabel}`,
    },
  };
}
