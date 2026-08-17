import { formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import type { ClientWorkspaceView } from "../types";

export function ContentPlanWorkspace({ view }: { view: ClientWorkspaceView }) {
  const keyMessage = view.content.find((row) => row.keyMessage)?.keyMessage;
  const cta = view.content.find((row) => row.cta)?.cta;
  const direction = view.strategyBody?.split("\n")[0];

  return (
    <>
      <div className="card">
        <p className="ck">Content plan</p>
        <h2>What creators will deliver</h2>
        <div className="glance">
          <div className="gi">
            <p className="l">Campaign objective</p>
            <p className={view.overview.objective?.trim() ? "v" : "v tbc"}>
              {providedText(view.overview.objective, TO_BE_CONFIRMED)}
            </p>
          </div>
          <div className="gi">
            <p className="l">Content direction</p>
            <p className={direction?.trim() ? "v" : "v tbc"}>
              {providedText(direction, "Content direction to be confirmed")}
            </p>
          </div>
          <div className="gi">
            <p className="l">Key message</p>
            <p className={keyMessage?.trim() ? "v" : "v tbc"}>{providedText(keyMessage, TO_BE_CONFIRMED)}</p>
          </div>
          <div className="gi">
            <p className="l">CTA</p>
            <p className={cta?.trim() ? "v" : "v tbc"}>{providedText(cta, TO_BE_CONFIRMED)}</p>
          </div>
          <div className="gi">
            <p className="l">Timing</p>
            <p className={view.overview.durationLabel?.trim() ? "v" : "v tbc"}>
              {providedText(view.overview.durationLabel, TO_BE_CONFIRMED)}
            </p>
          </div>
        </div>
      </div>

      {view.content.length > 0 ? (
        view.content.map((row, index) => (
          <div className="card" key={`${row.creatorId ?? row.creatorName}-${index}`}>
            <p className="ck">{formatPlatformLabel(row.platform) ?? row.platform}</p>
            <h2>{row.creatorName}</h2>
            <p className="note">{row.deliverable || TO_BE_CONFIRMED}</p>
            <div className="glance">
              <div className="gi">
                <p className="l">Content concept</p>
                <p className={row.contentConcept?.trim() ? "v" : "v tbc"}>
                  {providedText(row.contentConcept, TO_BE_CONFIRMED)}
                </p>
              </div>
              <div className="gi">
                <p className="l">Hook</p>
                <p className={row.hook?.trim() ? "v" : "v tbc"}>{providedText(row.hook, TO_BE_CONFIRMED)}</p>
              </div>
              <div className="gi">
                <p className="l">Key message</p>
                <p className={row.keyMessage?.trim() ? "v" : "v tbc"}>
                  {providedText(row.keyMessage, TO_BE_CONFIRMED)}
                </p>
              </div>
              <div className="gi">
                <p className="l">CTA</p>
                <p className={row.cta?.trim() ? "v" : "v tbc"}>{providedText(row.cta, TO_BE_CONFIRMED)}</p>
              </div>
              <div className="gi">
                <p className="l">Timing</p>
                <p className={row.timing?.trim() ? "v" : "v tbc"}>
                  {providedText(row.timing, "Timing to be confirmed")}
                </p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <p className="ck">Creator content</p>
          <h2>Assigned creators</h2>
          <p className="note">Content direction to be confirmed</p>
          {view.creators.length > 0 ? (
            <div className="clist">
              {view.creators.map((creator) => (
                <div className="cli" key={creator.creatorId}>
                  <span className="nm">{creator.displayName}</span>
                  <span className="rt">
                    {formatPlatformLabel(creator.platform) ?? "Platform to be confirmed"} ·{" "}
                    {creator.deliverables || TO_BE_CONFIRMED}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
