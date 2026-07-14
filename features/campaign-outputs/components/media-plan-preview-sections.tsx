import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import type { MediaPlanCampaignContext, MediaPlanDeadline, MediaPlanData } from "../generators/media-plan";
import { MEDIA_PLAN_COST_VAT_DISCLAIMER } from "../generators/media-plan";
import { formatMoney } from "../generators/generator-utils";
import { MEDIA_PLAN_BRAND } from "./media-plan-brand";

function deadlineDeliverables(deadline: MediaPlanDeadline): string[] {
  if (deadline.serviceTypes?.length) return deadline.serviceTypes;
  return deadline.serviceType?.trim() ? [deadline.serviceType] : [];
}

export const MEDIA_PLAN_DEADLINES_HEADING = "Production & Asset Delivery Deadlines";

export function MediaPlanCampaignCostBadge({
  cost,
  className = "",
  variant = "cover",
}: {
  cost?: { amount: number; currency: string };
  className?: string;
  variant?: "cover" | "inline";
}) {
  if (!cost) return null;

  if (variant === "cover") {
    return (
      <aside
        className={`inline-block rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm ${className}`}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/80">
          Campaign cost
        </p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {formatMoney(cost.amount, cost.currency)}
        </p>
        <p className="mt-1.5 text-[9px] text-white/70">{MEDIA_PLAN_COST_VAT_DISCLAIMER}</p>
      </aside>
    );
  }

  return (
    <aside
      className={`shrink-0 rounded-xl border border-[#0B0F1A]/8 bg-white px-4 py-3 text-right shadow-sm ${className}`}
    >
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
        style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
      >
        Campaign cost
      </p>
      <p
        className="mt-1 text-xl font-extrabold tracking-tight"
        style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
      >
        {formatMoney(cost.amount, cost.currency)}
      </p>
      <p className="mt-1 text-[10px] font-medium" style={{ color: MEDIA_PLAN_BRAND.muted }}>
        {MEDIA_PLAN_COST_VAT_DISCLAIMER}
      </p>
    </aside>
  );
}

export function MediaPlanContextStrip({
  context,
  variant = "document",
}: {
  context?: MediaPlanCampaignContext;
  variant?: "document" | "cover";
}) {
  if (!context?.clientName && !context?.brandName && !context?.groupName && !context?.agencyName) {
    return null;
  }

  const fields = [
    context.groupName ? { label: "Group", value: context.groupName } : null,
    context.clientName ? { label: "Legal entity", value: context.clientName } : null,
    context.brandName ? { label: "Brand", value: context.brandName } : null,
    context.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const isCover = variant === "cover";

  return (
    <dl
      className={
        isCover
          ? "mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-4"
          : "mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#0B0F1A]/8 pt-4"
      }
    >
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt
            className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
            style={{ color: isCover ? "rgba(255,255,255,0.7)" : MEDIA_PLAN_BRAND.muted }}
          >
            {label}
          </dt>
          <dd
            className="mt-0.5 text-[13px] font-semibold"
            style={{ color: isCover ? "#fff" : MEDIA_PLAN_BRAND.deepNavy }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MediaPlanDeadlinesTable({
  deadlines,
  variant = "document",
}: {
  deadlines: MediaPlanDeadline[];
  variant?: "document" | "inline";
}) {
  if (!deadlines.length) return null;

  const tableClass =
    variant === "document"
      ? "w-full min-w-[32rem] border-collapse text-[12px]"
      : "w-full min-w-[32rem] border-collapse text-[12px]";
  const wrapperClass =
    variant === "document"
      ? "overflow-x-auto rounded-xl border border-[#0B0F1A]/8 bg-white shadow-sm"
      : "overflow-x-auto rounded-lg border border-border";

  return (
    <div className={wrapperClass}>
      <table className={tableClass}>
        <thead>
          <tr
            className="text-left text-white"
            style={{ backgroundColor: MEDIA_PLAN_BRAND.deepNavy }}
          >
            {["Creator", "Deliverables", "Publish", "Production starts", "Assets due"].map((col) => (
              <th key={col} className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.5px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deadlines.map((deadline, index) => (
            <tr
              key={`${deadline.creator}-${deadline.publishWeek}-${deadline.publishDay}-${index}`}
              className="border-t border-[#0B0F1A]/6"
              style={
                index % 2 === 1
                  ? { backgroundColor: "rgba(232,239,254,0.35)" }
                  : undefined
              }
            >
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CreatorAvatarImage
                    avatarUrl={deadline.avatarUrl ?? null}
                    profileUrl={deadline.profileUrl ?? null}
                    size="sm"
                    className="shrink-0 ring-1 ring-[#0B0F1A]/8"
                    alt={deadline.shortName ?? deadline.creator}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate font-semibold"
                      style={{ color: MEDIA_PLAN_BRAND.ink }}
                    >
                      {deadline.shortName ?? deadline.creator}
                    </p>
                    {deadline.handle ? (
                      <p className="truncate text-[10px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                        @{deadline.handle.replace(/^@/, "")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                {deadlineDeliverables(deadline).length ? (
                  <ul className="space-y-0.5">
                    {deadlineDeliverables(deadline).map((type) => (
                      <li key={type} className="text-[11px] leading-snug">
                        {type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                Week {deadline.publishWeek} · {deadline.publishDay}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.productionStart}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.assetDelivery}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function shouldSkipMediaPlanSection(heading: string, hasDeadlinesData: boolean): boolean {
  if (heading.startsWith("Week ")) return true;
  if (heading === "Campaign Cost") return true;
  if (hasDeadlinesData && heading === MEDIA_PLAN_DEADLINES_HEADING) return true;
  if (
    heading === "Activation Waves" ||
    heading === "Platform Allocation" ||
    heading === "Creator Dependencies" ||
    heading === "Milestones & Windows"
  ) {
    return true;
  }
  return false;
}

const PLATFORM_BAR_COLORS = ["#0057FF", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"];

function platformAllocationBars(data: MediaPlanData): Array<{ platform: string; percentage: number }> {
  const entries = Object.entries(data.platformAllocation);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([platform, count]) => ({
    platform,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

export function MediaPlanCoverStats({ data }: { data: MediaPlanData }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {[
        { num: data.durationWeeks, lbl: "Weeks" },
        { num: data.postingSlotCount ?? data.creatorCount, lbl: "Ad slots" },
        { num: data.creatorCount, lbl: "Creators" },
      ].map(({ num, lbl }) => (
        <div
          key={lbl}
          className="min-w-[5.5rem] rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-center"
        >
          <p className="text-2xl font-extrabold text-white sm:text-3xl">{num}</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/75">
            {lbl}
          </p>
        </div>
      ))}
    </div>
  );
}

export function MediaPlanOperationsPanel({ data }: { data: MediaPlanData }) {
  const allocationBars = platformAllocationBars(data);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
        <h4
          className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
        >
          Activation Waves
        </h4>
        <ul className="space-y-1 text-xs" style={{ color: MEDIA_PLAN_BRAND.ink }}>
          {data.waves.map((wave) => (
            <li key={wave.wave}>
              <span className="font-semibold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                Wave {wave.wave}
              </span>{" "}
              — {wave.theme}{" "}
              <span style={{ color: MEDIA_PLAN_BRAND.muted }}>(wk {wave.weeks.join(", ")})</span>
            </li>
          ))}
        </ul>
      </div>

      {allocationBars.length > 0 ? (
        <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
          <h4
            className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
          >
            Platform Allocation
          </h4>
          <div className="space-y-2.5">
            {allocationBars.map((entry, index) => (
              <div key={entry.platform}>
                <div className="mb-1 flex justify-between text-[11px] font-semibold">
                  <span style={{ color: MEDIA_PLAN_BRAND.ink }}>{entry.platform}</span>
                  <span style={{ color: MEDIA_PLAN_BRAND.muted }}>{entry.percentage}%</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${entry.percentage}%`,
                      backgroundColor: PLATFORM_BAR_COLORS[index % PLATFORM_BAR_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
        <h4
          className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
        >
          Milestones &amp; Windows
        </h4>
        <ul
          className="max-h-48 space-y-1 overflow-y-auto text-xs"
          style={{ color: MEDIA_PLAN_BRAND.ink }}
        >
          {data.milestones.slice(0, 14).map((m, i) => (
            <li key={`${m.type}-${m.week}-${i}`}>
              <span className="font-mono font-medium" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                Wk {m.week}
              </span>{" "}
              · {m.label}
            </li>
          ))}
        </ul>
      </div>

      {data.dependencies.length > 0 ? (
        <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
          <h4
            className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
          >
            Creator Dependencies
          </h4>
          <ul className="space-y-1 text-xs" style={{ color: MEDIA_PLAN_BRAND.ink }}>
            {data.dependencies.map((dep) => (
              <li key={`${dep.creator}-${dep.dependsOn}`}>
                <span className="font-semibold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                  {dep.creator}
                </span>{" "}
                <span style={{ color: MEDIA_PLAN_BRAND.muted }}>→ {dep.dependsOn}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
