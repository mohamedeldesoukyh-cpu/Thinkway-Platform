import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatPlatformLabel, NOT_AVAILABLE, providedText, TO_BE_CONFIRMED } from "../format";
import { allocationSlices, rosterHeadline } from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { MetricCard, MixBars, Panel } from "./media-plan-ui";

export function CommercialWorkspace({ view }: { view: ClientWorkspaceView }) {
  const commercial = view.commercial;
  const platforms = [
    ...new Set(
      view.creators
        .map((creator) => formatPlatformLabel(creator.platform) ?? creator.platform)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const deliverableCount = view.mediaPlanSummary.activityMix.reduce((sum, item) => sum + item.count, 0);
  const allocation = allocationSlices(commercial);
  const extraLines = commercial.lines.filter((line) =>
    !view.creators.some((creator) => creator.displayName === line.label)
  );

  return (
    <div className="space-y-5">
      <Panel eyebrow="Campaign investment" title="Total investment">
        <p className="text-3xl font-semibold tracking-tight">
          {commercial.totalInvestment > 0
            ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
            : TO_BE_CONFIRMED}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {rosterHeadline(view.creators.length)} · Proposal v{view.review.reviewNumber}
          {view.quotation?.serialNumber ? ` · ${view.quotation.serialNumber}` : ""}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Creators" value={String(view.creators.length)} />
          <MetricCard
            label="Deliverables"
            value={deliverableCount > 0 ? String(deliverableCount) : TO_BE_CONFIRMED}
          />
          <MetricCard
            label="Platforms"
            value={platforms.length > 0 ? platforms.join(" · ") : NOT_AVAILABLE}
          />
          <MetricCard
            label="Campaign duration"
            value={providedText(view.overview.durationLabel, TO_BE_CONFIRMED)}
          />
        </div>
      </Panel>

      {allocation ? (
        <Panel eyebrow="Budget allocation" title="How the investment is split">
          <MixBars items={allocation} />
        </Panel>
      ) : null}

      <Panel eyebrow="Creator investment" title="Proposed roster">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="pb-3 pr-4">Creator</th>
                <th className="pb-3 pr-4">Platform</th>
                <th className="pb-3 pr-4">Deliverables</th>
                <th className="pb-3 text-right">Investment</th>
              </tr>
            </thead>
            <tbody>
              {view.creators.map((creator) => (
                <tr key={creator.creatorId} className="border-t border-zinc-100">
                  <td className="py-3 pr-4 font-medium">{creator.displayName}</td>
                  <td className="py-3 pr-4 text-zinc-600">
                    {formatPlatformLabel(creator.platform) ?? NOT_AVAILABLE}
                  </td>
                  <td className="py-3 pr-4 text-zinc-600">
                    {creator.deliverables ||
                      creator.deliverableItems?.map((item) => `${item.quantity ?? 1} ${item.type}`).join(" · ") ||
                      TO_BE_CONFIRMED}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {creator.investmentAmount != null
                      ? formatMoneyKpi(creator.investmentAmount, creator.investmentCurrency ?? commercial.currency)
                      : TO_BE_CONFIRMED}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200">
                <td className="pt-3 font-semibold" colSpan={3}>
                  Subtotal · creator investment
                </td>
                <td className="pt-3 text-right font-semibold">
                  {commercial.creatorInvestment > 0
                    ? formatMoneyKpi(commercial.creatorInvestment, commercial.currency)
                    : TO_BE_CONFIRMED}
                </td>
              </tr>
              <tr>
                <td className="pt-1 font-semibold" colSpan={3}>
                  Total campaign investment
                </td>
                <td className="pt-1 text-right text-base font-semibold">
                  {commercial.totalInvestment > 0
                    ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
                    : TO_BE_CONFIRMED}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {view.creators.map((creator) => (
            <article key={creator.creatorId} className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="font-semibold">{creator.displayName}</p>
              <p className="text-sm text-zinc-500">
                {formatPlatformLabel(creator.platform) ?? NOT_AVAILABLE} ·{" "}
                {creator.deliverables || TO_BE_CONFIRMED}
              </p>
              <p className="mt-1 font-semibold">
                {creator.investmentAmount != null
                  ? formatMoneyKpi(creator.investmentAmount, creator.investmentCurrency ?? commercial.currency)
                  : TO_BE_CONFIRMED}
              </p>
            </article>
          ))}
          <p className="flex justify-between text-sm font-semibold">
            <span>Total campaign investment</span>
            <span>
              {commercial.totalInvestment > 0
                ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
                : TO_BE_CONFIRMED}
            </span>
          </p>
        </div>
      </Panel>

      {extraLines.length > 0 ? (
        <Panel
          eyebrow="Additional commercial items"
          title={view.quotation?.serialNumber ? view.quotation.serialNumber : "Proposal commercial items"}
        >
          {view.quotation?.name ? (
            <p className="mb-3 text-sm text-zinc-500">
              {view.quotation.name}
              {view.quotation.version ? ` · Version ${view.quotation.version}` : ""}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {extraLines.map((line) => (
              <li key={line.label} className="flex justify-between gap-4">
                <span>{line.label}</span>
                <span>
                  {line.amount != null ? formatMoneyKpi(line.amount, commercial.currency) : TO_BE_CONFIRMED}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
