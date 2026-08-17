import type { ClientCreatorSelectionState } from "./constants";
import type {
  ClientCommercialSummary,
  ClientCreatorCard,
  ClientOverview,
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseSourceSnapshot(raw: unknown): ClientReviewSourceSnapshot | null {
  if (!isRecord(raw)) return null;
  const source = raw.source;
  if (source !== "studio" && source !== "shortlist" && source !== "quotation") return null;
  const creators = Array.isArray(raw.creators) ? raw.creators.filter(isRecord) : [];
  const content = Array.isArray(raw.content) ? raw.content.filter(isRecord) : [];
  const commercial = isRecord(raw.commercial) ? raw.commercial : {};
  const timeline = isRecord(raw.timeline) ? raw.timeline : {};
  const quotation = isRecord(raw.quotation) ? raw.quotation : null;
  const creatorIds = Array.isArray(raw.creatorIds)
    ? raw.creatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : creators
        .map((row) => asString(row.creatorId))
        .filter((id): id is string => Boolean(id));

  return {
    source,
    brandName: asString(raw.brandName) || "Brand",
    campaignName: asString(raw.campaignName) || "Campaign",
    clientLabel: asString(raw.clientLabel) || "Client",
    objective: asString(raw.objective),
    audience: asString(raw.audience),
    market: asString(raw.market),
    durationLabel: asString(raw.durationLabel),
    platforms: Array.isArray(raw.platforms)
      ? raw.platforms.filter((item): item is string => typeof item === "string")
      : [],
    deliverables: Array.isArray(raw.deliverables)
      ? raw.deliverables.filter((item): item is string => typeof item === "string")
      : [],
    whyThisApproach: asString(raw.whyThisApproach),
    strategyBody: asString(raw.strategyBody),
    creators: creators.map((row) => ({
      creatorId: asString(row.creatorId) || "",
      displayName: asString(row.displayName) || "Creator",
      handle: asString(row.handle),
      platform: asString(row.platform),
      followers: asNumber(row.followers),
      engagementRate: asNumber(row.engagementRate),
      country: asString(row.country),
      city: asString(row.city),
      category: asString(row.category),
      audienceHighlight: asString(row.audienceHighlight),
      fitExplanation: asString(row.fitExplanation),
      deliverables: asString(row.deliverables),
      investmentAmount: asNumber(row.investmentAmount),
      investmentCurrency: asString(row.investmentCurrency),
      avatarUrl: asString(row.avatarUrl),
      bio: asString(row.bio),
    })),
    content: content.map((row) => ({
      creatorId: asString(row.creatorId),
      creatorName: asString(row.creatorName) || "Creator",
      platform: asString(row.platform) || "",
      deliverable: asString(row.deliverable) || "",
      contentConcept: asString(row.contentConcept),
      keyMessage: asString(row.keyMessage),
      hook: asString(row.hook),
      cta: asString(row.cta),
      timing: asString(row.timing),
    })),
    timeline: {
      durationWeeks: asNumber(timeline.durationWeeks) ?? null,
      durationLabel: asString(timeline.durationLabel) || "Duration not confirmed",
      phases: Array.isArray(timeline.phases)
        ? timeline.phases.filter(isRecord).map((phase) => ({
            week: asNumber(phase.week) ?? 0,
            label: asString(phase.label) || "",
            activities: Array.isArray(phase.activities)
              ? phase.activities.filter((item): item is string => typeof item === "string")
              : [],
          }))
        : [],
    },
    commercial: {
      currency: asString(commercial.currency) || "EGP",
      creatorInvestment: asNumber(commercial.creatorInvestment) ?? 0,
      feeAmount: asNumber(commercial.feeAmount),
      totalInvestment: asNumber(commercial.totalInvestment) ?? 0,
      lines: Array.isArray(commercial.lines)
        ? commercial.lines.filter(isRecord).map((line) => ({
            label: asString(line.label) || "",
            amount: asNumber(line.amount),
            note: asString(line.note),
          }))
        : [],
      selectedCount: asNumber(commercial.selectedCount) ?? creatorIds.length,
      totalCount: asNumber(commercial.totalCount) ?? creatorIds.length,
    },
    quotation: quotation
      ? {
          id: asString(quotation.id) || "",
          serialNumber: asString(quotation.serialNumber) ?? null,
          name: asString(quotation.name) || "Quotation",
          version: asString(quotation.version) ?? null,
          lines: Array.isArray(quotation.lines)
            ? quotation.lines.filter(isRecord).map((line) => ({
                creatorId: asString(line.creatorId) || "",
                label: asString(line.label) || "",
                amount: asNumber(line.amount) ?? 0,
              }))
            : [],
        }
      : undefined,
    creatorIds,
  };
}

export function projectCommercialFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>
): ClientCommercialSummary {
  const selected = snapshot.creators.filter(
    (creator) => (selection[creator.creatorId] ?? "in_review") !== "rejected"
  );
  const selectedIds = new Set(selected.map((creator) => creator.creatorId));
  const hasPerCreator = snapshot.creators.some((creator) => creator.investmentAmount != null);
  if (hasPerCreator) {
    const creatorInvestment = selected.reduce(
      (sum, creator) => sum + (creator.investmentAmount ?? 0),
      0
    );
    const lines = snapshot.creators
      .filter((creator) => selectedIds.has(creator.creatorId) && creator.investmentAmount != null)
      .map((creator) => ({
        label: creator.displayName,
        amount: creator.investmentAmount,
      }));
    const quotationLines = snapshot.quotation?.lines.filter((line) => selectedIds.has(line.creatorId));
    return {
      currency: snapshot.commercial.currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      lines: quotationLines?.length
        ? quotationLines.map((line) => ({ label: line.label, amount: line.amount }))
        : lines.length > 0
          ? lines
          : snapshot.commercial.lines,
      selectedCount: selected.length,
      totalCount: snapshot.creators.length,
    };
  }

  const selectedRatio =
    snapshot.creators.length === 0 ? 1 : selected.length / snapshot.creators.length;
  const total = Math.round(snapshot.commercial.totalInvestment * selectedRatio);
  return {
    currency: snapshot.commercial.currency,
    creatorInvestment: total,
    feeAmount: snapshot.commercial.feeAmount,
    totalInvestment: total,
    lines: snapshot.commercial.lines.map((line) => ({
      ...line,
      amount: line.amount != null ? Math.round(line.amount * selectedRatio) : undefined,
    })),
    selectedCount: selected.length,
    totalCount: snapshot.creators.length,
  };
}

export function projectCreatorsFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>
): ClientCreatorCard[] {
  return snapshot.creators.map((creator) => ({
    ...creator,
    selection: selection[creator.creatorId] ?? "in_review",
    contentExamples: [],
  }));
}

export function projectOverviewFromSnapshot(
  snapshot: ClientReviewSourceSnapshot,
  commercial: ClientCommercialSummary
): ClientOverview {
  return {
    brandName: snapshot.brandName,
    campaignName: snapshot.campaignName,
    clientLabel: snapshot.clientLabel,
    objective: snapshot.objective,
    audience: snapshot.audience,
    market: snapshot.market,
    durationLabel: snapshot.durationLabel,
    platforms: snapshot.platforms,
    deliverables: snapshot.deliverables,
    creatorCount: snapshot.creators.length,
    whyThisApproach:
      snapshot.whyThisApproach?.slice(0, 480) ||
      "Thinkway recommends this creator-led approach based on the confirmed campaign facts.",
    commercial,
  };
}

export function snapshotCreatorIds(snapshot: ClientReviewSourceSnapshot): string[] {
  return snapshot.creatorIds.length > 0
    ? snapshot.creatorIds
    : snapshot.creators.map((creator) => creator.creatorId);
}

export function fingerprintFromSnapshotCreators(
  creators: ClientReviewSourceSnapshotCreator[],
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const ids = [...creators.map((creator) => creator.creatorId)].sort();
  const revenues = Object.fromEntries(
    [...creators]
      .sort((a, b) => a.creatorId.localeCompare(b.creatorId))
      .map((creator) => [creator.creatorId, creator.investmentAmount ?? 0])
  );
  return { creatorIds: ids, revenues, ...extra };
}
