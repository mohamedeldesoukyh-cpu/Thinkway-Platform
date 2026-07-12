import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type { MediaPlanData } from "../generators/media-plan";
import { MediaPlanCalendar } from "./media-plan-calendar";

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
export function OutputViewer({ content }: { content: CampaignOutputContent }) {
  const mediaPlan = isMediaPlanData(content.data) ? content.data : undefined;

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">{content.title}</h2>
        {content.summary ? (
          <p className="text-[13px] text-muted-foreground">{content.summary}</p>
        ) : null}
      </header>

      {mediaPlan ? <MediaPlanCalendar data={mediaPlan} /> : null}

      <div className="space-y-5">
        {content.sections
          // When the calendar is shown, skip the week-by-week markdown duplicates.
          .filter((s) => !(mediaPlan && s.heading.startsWith("Week ")))
          .map((section, i) => (
            <SectionBlock key={`${section.heading}-${i}`} section={section} />
          ))}
      </div>
    </article>
  );
}
