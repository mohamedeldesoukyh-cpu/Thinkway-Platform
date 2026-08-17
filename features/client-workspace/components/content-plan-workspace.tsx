import { formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import type { ClientWorkspaceView } from "../types";
import { Panel } from "./media-plan-ui";

export function ContentPlanWorkspace({ view }: { view: ClientWorkspaceView }) {
  return (
    <div className="space-y-5">
      <Panel eyebrow="Content plan" title="What creators will deliver">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Campaign objective" value={providedText(view.overview.objective, TO_BE_CONFIRMED)} />
          <Fact
            label="Content direction"
            value={providedText(view.strategyBody?.split("\n")[0], "Content direction to be confirmed")}
          />
          <Fact
            label="Key message"
            value={providedText(view.content.find((row) => row.keyMessage)?.keyMessage, TO_BE_CONFIRMED)}
          />
          <Fact
            label="CTA"
            value={providedText(view.content.find((row) => row.cta)?.cta, TO_BE_CONFIRMED)}
          />
          <Fact label="Timing" value={providedText(view.overview.durationLabel, TO_BE_CONFIRMED)} />
        </dl>
      </Panel>

      {view.content.length > 0 ? (
        <div className="space-y-3">
          {view.content.map((row, index) => (
            <article
              key={`${row.creatorId ?? row.creatorName}-${index}`}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{row.creatorName}</h3>
                  <p className="text-sm text-zinc-500">
                    {formatPlatformLabel(row.platform) ?? row.platform} · {row.deliverable || TO_BE_CONFIRMED}
                  </p>
                </div>
                <p className="text-sm text-zinc-500">{providedText(row.timing, "Timing to be confirmed")}</p>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Fact label="Content concept" value={providedText(row.contentConcept, TO_BE_CONFIRMED)} />
                <Fact label="Hook" value={providedText(row.hook, TO_BE_CONFIRMED)} />
                <Fact label="Key message" value={providedText(row.keyMessage, TO_BE_CONFIRMED)} />
                <Fact label="CTA" value={providedText(row.cta, TO_BE_CONFIRMED)} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <Panel title="Creator content">
          <p className="text-sm text-zinc-500">Content direction to be confirmed</p>
          {view.creators.length > 0 ? (
            <div className="mt-4 space-y-2">
              {view.creators.map((creator) => (
                <div
                  key={creator.creatorId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{creator.displayName}</span>
                  <span className="text-zinc-500">
                    {formatPlatformLabel(creator.platform) ?? "Platform to be confirmed"} ·{" "}
                    {creator.deliverables || TO_BE_CONFIRMED}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-zinc-800">{value}</dd>
    </div>
  );
}
