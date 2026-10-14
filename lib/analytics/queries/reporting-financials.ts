import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { aggregateCampaignDisplayFinancials, resolveLineCostAmount, type CampaignLineCommercialFxInput } from "@/lib/campaigns/campaign-display-financials";
import { distributeAmountByWeights } from "@/lib/assignments/commercial-calculations";
import { resolveClientTaxableBase } from "@/lib/assignments/client-billing-commercial";

export type RecognitionLine = CampaignLineCommercialFxInput & { id: string; campaign_header_id: string };
export type RecognitionDeliverable = {
  platform?: string; deliverable_type?: string; id: string; campaign_line_id: string; quantity: number; live_date: string | null;
  revenue_before_vat: number; cost_before_vat: number; usage_rights_amount: number;
  usage_rights_cost: number; agency_fee_amount: number; metadata?: Record<string, unknown> | null;
};
export type RecognitionPost = {
  id: string; assignment_deliverable_id: string; live_date: string | null; status: string;
  revenue_before_vat: number; cost_before_vat: number;
};
export type RecognitionPublication = {
  views?: number | null; plays?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; engagement_views?: number | null;
  id?: string; campaign_line_id?: string | null; platform?: string; publication_type?: string; content_url?: string | null;
  assignment_deliverable_id: string | null; assignment_post_schedule_id: string | null;
  publication_date: string | null; status: string;
};
export type RecognitionEvent = { campaign_line_id?: string; campaign_header_id: string; date: string; revenue: number; cost: number; gp: number };
const LIVE = new Set(["posted", "published", "live", "verified"]);

function hasPublicationEvidence(publication: RecognitionPublication): boolean {
  if (LIVE.has(publication.status)) return true;
  // Historical imports can retain Draft even after performance was collected.
  // A dated live URL plus observed engagement is evidence; forecasts are excluded.
  return !!publication.content_url?.trim() && ["draft", "scheduled", "archived"].includes(publication.status) &&
    [publication.views, publication.plays, publication.likes, publication.comments, publication.shares, publication.engagement_views]
      .some(value => Number(value ?? 0) > 0);
}

/** A planned date, commercial approval, invoice, or payment is not proof of going live. */
export function buildRecognitionEvents(input: {
  lines: RecognitionLine[]; deliverables: RecognitionDeliverable[]; posts: RecognitionPost[];
  publications: RecognitionPublication[]; rates: ReadonlyMap<string, number>;
  campaignCurrencies: ReadonlyMap<string, string>; today: string;
}): RecognitionEvent[] {
  const events: RecognitionEvent[] = [];
  const dateOnly = (date: string | null | undefined) => {
    const value = date?.slice(0, 10);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= input.today ? value : null;
  };
  for (const line of input.lines) {
    const lineEvents: RecognitionEvent[] = [];
    const children = input.deliverables.filter(d => d.campaign_line_id === line.id).sort((a, b) => a.id.localeCompare(b.id));
    if (!children.length) continue;
    const weights = (pick: (d: RecognitionDeliverable) => number) => {
      const values = children.map(d => Math.max(0, Number(pick(d)) || 0));
      return values.some(v => v > 0) ? values : children.map(d => Math.max(1, d.quantity));
    };
    const baseRevenue = Number(line.revenue_before_vat ?? line.revenue ?? 0);
    const ur = Number(line.usage_rights_amount ?? 0);
    const fee = resolveClientTaxableBase({ revenueBeforeVat: baseRevenue, usageRightsAmount: ur,
      agencyFeeAmount: line.agency_fee_amount, agencyFeePercent: Number(line.agency_fee_percent ?? 0) }) - baseRevenue - ur;
    // Allocate authoritative line totals, preserving negotiated FX and cent rounding.
    const revenues = distributeAmountByWeights(baseRevenue, weights(d => d.revenue_before_vat));
    const costs = distributeAmountByWeights(resolveLineCostAmount(line), weights(d => d.cost_before_vat));
    const urs = distributeAmountByWeights(ur, weights(d => d.usage_rights_amount));
    const urCosts = distributeAmountByWeights(Number(line.usage_rights_cost ?? 0), weights(d => d.usage_rights_cost));
    const fees = distributeAmountByWeights(fee, weights(d => d.agency_fee_amount));
    const legacyByChild = new Map<string, RecognitionPublication[]>();
    const seenPublications = new Set<string>();
    for (const publication of input.publications) {
      if (!hasPublicationEvidence(publication) || !dateOnly(publication.publication_date) || publication.assignment_post_schedule_id) continue;
      let candidates = publication.assignment_deliverable_id
        ? children.filter(d => d.id === publication.assignment_deliverable_id)
        : publication.campaign_line_id === line.id && publication.platform
          ? children.filter(d => d.platform && canonicalPlatformKey(d.platform) === canonicalPlatformKey(publication.platform!)) : [];
      const exact = candidates.filter(d => d.deliverable_type === publication.publication_type);
      if (exact.length) candidates = exact;
      // Older publications used assignment + platform instead of a post foreign key.
      // Only unambiguous contracted matches can earn revenue; added-value posts cannot.
      if (candidates.length !== 1) continue;
      const key = publication.content_url || publication.id;
      if (key && seenPublications.has(key)) continue;
      if (key) seenPublications.add(key);
      const list = legacyByChild.get(candidates[0].id) ?? [];
      list.push(publication); legacyByChild.set(candidates[0].id, list);
    }
    children.forEach((child, i) => {
      const posts = input.posts.filter(p => p.assignment_deliverable_id === child.id).sort((a, b) => a.id.localeCompare(b.id));
      const units = posts.length ? posts : Array.from({ length: Math.max(1, child.quantity || 1) }, (_, index) => ({ id: `${child.id}:${index}`, assignment_deliverable_id: child.id,
        live_date: child.live_date, status: String(child.metadata?.workflow_status ?? "draft"),
        revenue_before_vat: child.revenue_before_vat, cost_before_vat: child.cost_before_vat }));
      const unitWeights = (key: "revenue_before_vat" | "cost_before_vat") => {
        const values = units.map(p => Math.max(0, Number(p[key]) || 0));
        return values.some(v => v > 0) ? values : units.map(() => 1);
      };
      const revWeights = unitWeights("revenue_before_vat");
      const rev = distributeAmountByWeights(revenues[i], revWeights);
      const cost = distributeAmountByWeights(costs[i], unitWeights("cost_before_vat"));
      const urRev = distributeAmountByWeights(urs[i], revWeights);
      const urCost = distributeAmountByWeights(urCosts[i], unitWeights("cost_before_vat"));
      const af = distributeAmountByWeights(fees[i], revWeights);
      const dates = units.map(unit => {
        const linked = input.publications.filter(p => hasPublicationEvidence(p) && p.assignment_post_schedule_id === unit.id)
          .map(p => dateOnly(p.publication_date)).filter((d): d is string => !!d).sort();
        return linked[0] ?? (LIVE.has(unit.status) ? dateOnly(unit.live_date) : null);
      });
      const occupied = new Set<number>();
      for (const publication of (legacyByChild.get(child.id) ?? []).sort((a,b) => (a.publication_date ?? "").localeCompare(b.publication_date ?? ""))) {
        const date = dateOnly(publication.publication_date)!;
        let index = dates.findIndex((d, i) => d === date && !occupied.has(i));
        if (index < 0) index = dates.findIndex((d, i) => !d && !occupied.has(i));
        if (index < 0) continue;
        dates[index] = date; occupied.add(index);
      }
      units.forEach((unit, j) => {
        const date = dates[j];
        const financials = aggregateCampaignDisplayFinancials({ displayCurrency: "EGP", rateToEgpByCurrency: input.rates,
          lines: [{ ...line, currency_code: line.currency_code || input.campaignCurrencies.get(line.campaign_header_id) || "EGP",
            revenue_before_vat: rev[j], usage_rights_amount: urRev[j], agency_fee_amount: af[j], agency_fee_percent: 0,
            cost_received: cost[j], cost_before_vat: cost[j], usage_rights_cost: urCost[j] }] });
        lineEvents.push({ campaign_line_id: line.id, campaign_header_id: line.campaign_header_id, date: date ?? "",
          revenue: financials.revenue, gp: financials.gp, cost: Math.round((financials.revenue - financials.gp) * 100) / 100 });
      });
    });
    // Converting each allocated post separately can create phantom cents. Keep
    // the allocation equal to the workspace total, including non-live units.
    const total = aggregateCampaignDisplayFinancials({ lines: [{ ...line,
      currency_code: line.currency_code || input.campaignCurrencies.get(line.campaign_header_id) || "EGP" }],
      displayCurrency: "EGP", rateToEgpByCurrency: input.rates });
    const last = lineEvents[lineEvents.length - 1];
    if (last) {
      const cents = (value: number) => Math.round(value * 100) / 100;
      last.revenue = cents(last.revenue + total.revenue - lineEvents.reduce((n, e) => n + e.revenue, 0));
      last.cost = cents(last.cost + total.revenue - total.gp - lineEvents.reduce((n, e) => n + e.cost, 0));
      last.gp = cents(last.revenue - last.cost);
    }
    events.push(...lineEvents.filter(e => !!e.date));
  }
  return events;
}
