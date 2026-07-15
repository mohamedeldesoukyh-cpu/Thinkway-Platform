import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type { MediaPlanCampaignContext, MediaPlanData } from "../generators/media-plan";
import {
  MediaPlanCalendar,
  type MediaPlanCreatorMoveTarget,
} from "./media-plan-calendar";
import { MEDIA_PLAN_BRAND } from "./media-plan-brand";
import { mergeMediaPlanContext } from "./media-plan-context-merge";
import {
  MEDIA_PLAN_DEADLINES_HEADING,
  MediaPlanCampaignCostBadge,
  MediaPlanContextStrip,
  MediaPlanDeadlinesTable,
  MediaPlanStrategySection,
  shouldSkipMediaPlanSection,
} from "./media-plan-preview-sections";

function isMediaPlanData(data: unknown): data is MediaPlanData {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as { weeks?: unknown }).weeks) &&
      typeof (data as { durationWeeks?: unknown }).durationWeeks === "number"
  );
}

function SectionBlock({ section }: { section: CampaignOutputContentSection }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">{section.heading}</h3>
      {section.body ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
          {section.body}
        </p>
      ) : null}
      {section.items?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-foreground/85">
          {section.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {section.table.columns.map((col) => (
                  <th key={col} className="px-2 py-1.5 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-foreground/85">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Renders a Campaign Output exactly as its export would — the Preview surface.
 * The Media Plan renders as a visual calendar; every output renders its
 * sections (paragraphs, lists, tables) uniformly.
 */
export function OutputViewer({
  content,
  mediaPlanContextOverride,
  editableMediaPlan = false,
  savingMediaPlanSchedule = false,
  onMoveMediaPlanCreator,
}: {
  content: CampaignOutputContent;
  mediaPlanContextOverride?: MediaPlanCampaignContext;
  editableMediaPlan?: boolean;
  savingMediaPlanSchedule?: boolean;
  onMoveMediaPlanCreator?: (target: MediaPlanCreatorMoveTarget) => void;
}) {
  const mediaPlan = isMediaPlanData(content.data) ? content.data : undefined;
  const hasDeadlines = Boolean(mediaPlan?.deadlines?.length);
  const mediaPlanContext = mergeMediaPlanContext(
    mediaPlan?.campaignContext,
    mediaPlanContextOverride
  );

  return (
    <article className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-extrabold tracking-tight" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
              {content.title}
            </h2>
            {content.summary ? (
              <p className="text-[13px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {content.summary}
              </p>
            ) : null}
          </div>
          {mediaPlan ? <MediaPlanCampaignCostBadge cost={mediaPlanContext?.campaignCost} /> : null}
        </div>
        {mediaPlan ? <MediaPlanContextStrip context={mediaPlanContext} /> : null}
      </header>

      {mediaPlan ? (
        <MediaPlanStrategySection summary={mediaPlan.strategySummary} />
      ) : null}

      {mediaPlan ? (
        <MediaPlanCalendar
          data={mediaPlan}
          orientation="landscape"
          editable={editableMediaPlan}
          saving={savingMediaPlanSchedule}
          onMoveCreator={onMoveMediaPlanCreator}
        />
      ) : null}

      {mediaPlan && hasDeadlines ? (
        <section className="space-y-2">
          <h3 className="text-sm font-bold" style={{ color: MEDIA_PLAN_BRAND.electricBlue }}>
            {MEDIA_PLAN_DEADLINES_HEADING}
          </h3>
          <MediaPlanDeadlinesTable deadlines={mediaPlan.deadlines} variant="inline" />
        </section>
      ) : null}

      <div className="space-y-5">
        {content.sections
          .filter((s) => !mediaPlan || !shouldSkipMediaPlanSection(s.heading, hasDeadlines))
          .map((section, i) => (
            <SectionBlock key={`${section.heading}-${i}`} section={section} />
          ))}
      </div>
    </article>
  );
}
