"use client";

import { deliverablesLabel } from "../deliverables";
import { formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import { contentRowsForSelection } from "../selection-view";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { ReviewAvatar } from "./review-avatar";

export function ContentPlanWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token?: string;
}) {
  const { selection, selectedCreators } = useClientWorkspaceState();
  const rows = contentRowsForSelection(view.content, view.creators, selection);
  const keyMessage = rows.find((row) => row.keyMessage)?.keyMessage;
  const cta = rows.find((row) => row.cta)?.cta;
  const direction = view.strategyBody?.split("\n")[0];

  return (
    <>
      <div className="card">
        <p className="ck">Content plan</p>
        <h2>What selected creators will deliver</h2>
        <p className="note">
          {selectedCreators.length > 0
            ? `${selectedCreators.length} accepted of ${view.creators.length} proposed. Direction is confirmed with each creator once the selection is approved.`
            : "Accept creators on the Creators tab to build this content plan."}
        </p>
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
            <p className="l">Call to action</p>
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

      <div className="card">
        <p className="ck">Creator content</p>
        <h2>Assigned creators</h2>
        {selectedCreators.length > 0 ? (
          <div className="clip">
            {selectedCreators.map((creator, index) => (
              <div className="cli" key={creator.creatorId}>
                <ReviewAvatar
                  className="av"
                  url={creator.avatarUrl}
                  profileUrl={creator.profileUrl}
                  handle={creator.handle}
                  platform={creator.platform}
                  platformAccounts={creator.platformAccounts}
                  name={creator.displayName}
                  index={view.creators.findIndex((item) => item.creatorId === creator.creatorId) || index}
                  token={token}
                />
                <span className="nm">{creator.displayName}</span>
                <span className="r">
                  {[formatPlatformLabel(creator.platform) ?? creator.platform, deliverablesLabel(creator.deliverableItems, creator.deliverables)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="note">Accept creators on the Creators tab to see their deliverables here.</p>
        )}
      </div>

      {rows.map((row, index) => (
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
              <p className={row.timing?.trim() ? "v" : "v tbc"}>{providedText(row.timing, "Timing to be confirmed")}</p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
