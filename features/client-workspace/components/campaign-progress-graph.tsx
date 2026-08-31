"use client";

import {
  CAMPAIGN_PROGRESS_COPY,
  campaignProgressRangeCopy,
  projectCampaignProgressGraph,
  type CampaignProgressCheckpoint,
  type CampaignProgressCreator,
  type CampaignProgressGraph as CampaignProgressGraphModel,
  type CampaignProgressTrack,
} from "../campaign-progress-graph";
import { matchClientCreatorByName } from "../campaign-tab-aggregates";
import type { ClientCampaignPostRow } from "../campaign-execution";
import type { ClientCreatorCard } from "../types";
import { ReviewAvatar } from "./review-avatar";

export function CampaignProgressGraph({
  posts,
  startDate,
  endDate,
  creators,
  token,
}: {
  posts: ClientCampaignPostRow[];
  startDate?: string | null;
  endDate?: string | null;
  creators: Array<
    Pick<
      ClientCreatorCard,
      "displayName" | "handle" | "avatarUrl" | "profileUrl" | "platform" | "platformAccounts"
    >
  >;
  token: string;
}) {
  const graph = projectCampaignProgressGraph({ posts, startDate, endDate });
  if (!graph) return null;

  return (
    <section className="card" id="campaignProgress" aria-label={`Campaign progress from ${graph.startLabel} to ${graph.endLabel}`}>
      <p className="ck">Campaign progress</p>
      <h2>Creator delivery timeline</h2>
      <p className="cx-tl__range">{campaignProgressRangeCopy(graph.startFullLabel, graph.endFullLabel)}</p>
      <p className="note">{CAMPAIGN_PROGRESS_COPY}</p>
      <div className="cx-tl">
        <Axis graph={graph} />
        {graph.creators.map((creator, index) => (
          <CreatorBlock
            key={creator.creatorName}
            creator={creator}
            graph={graph}
            index={index}
            creators={creators}
            token={token}
          />
        ))}
      </div>
      <div className="cx-tl__legend">
        <span>
          <i className="cx-tl__cap cx-tl__cap--start" />
          Start · {graph.startLabel}
        </span>
        <span>
          <i className="cx-tl__dot cx-tl__dot--live" />
          Live
        </span>
        <span>
          <i className="cx-tl__dot cx-tl__dot--sched" />
          Scheduled
        </span>
        <span>
          <i className="cx-tl__dot cx-tl__dot--od" />
          Overdue
        </span>
        <span>
          <i className="cx-tl__dot cx-tl__dot--added" />
          Added value
        </span>
        <span>
          <i className="cx-tl__cap cx-tl__cap--end" />
          End · {graph.endLabel}
        </span>
      </div>
    </section>
  );
}

function Axis({ graph }: { graph: CampaignProgressGraphModel }) {
  return (
    <div className="cx-tl__axis" aria-hidden="true">
      <span className="cx-tl__fmt" />
      <span className="cx-tl__rail">
        <span className="cx-tl__start">Start · {graph.startLabel}</span>
        {graph.todayPercent != null ? (
          <span className="cx-tl__now" style={{ left: `${graph.todayPercent}%` }}>
            Today
          </span>
        ) : null}
        <span className="cx-tl__end">End · {graph.endLabel}</span>
      </span>
    </div>
  );
}

function CreatorBlock({
  creator,
  graph,
  index,
  creators,
  token,
}: {
  creator: CampaignProgressCreator;
  graph: CampaignProgressGraphModel;
  index: number;
  creators: Array<
    Pick<
      ClientCreatorCard,
      "displayName" | "handle" | "avatarUrl" | "profileUrl" | "platform" | "platformAccounts"
    >
  >;
  token: string;
}) {
  const matched = matchClientCreatorByName(creator.creatorName, creators);
  return (
    <article className="cx-tl__creator">
      <header className="cx-tl__who">
        <ReviewAvatar
          className="cx-av"
          url={creator.avatarUrl || matched?.avatarUrl}
          profileUrl={matched?.profileUrl}
          handle={matched?.handle}
          platform={matched?.platform}
          platformAccounts={matched?.platformAccounts}
          name={creator.creatorName}
          index={index}
          token={token}
        />
        <div className="cx-tl__who-t">
          <p className="cx-tl__name">{creator.creatorName}</p>
          <p className="cx-tl__count num">
            {creator.reachedCount} of {creator.totalCount} live
          </p>
        </div>
      </header>
      {creator.tracks.map((track) => (
        <TrackRow key={track.key} track={track} graph={graph} added={track.valueScope === "added_value"} />
      ))}
    </article>
  );
}

function TrackRow({
  track,
  graph,
  added,
}: {
  track: CampaignProgressTrack;
  graph: CampaignProgressGraphModel;
  added: boolean;
}) {
  return (
    <div className={added ? "cx-tl__row cx-tl__row--added" : "cx-tl__row"}>
      <span className="cx-tl__fmt">
        {track.format}
        {added ? <span className="cx-tl__fmt-av">Added value</span> : null}
      </span>
      <span className="cx-tl__rail">
        <span className="cx-tl__line" />
        <span className="cx-tl__fill" style={{ width: `${track.filledPercent}%` }} />
        {graph.todayPercent != null ? (
          <span className="cx-tl__today" style={{ left: `${graph.todayPercent}%` }} />
        ) : null}
        <span className="cx-tl__cap cx-tl__cap--start" title={`Start · ${graph.startLabel}`} />
        {track.checkpoints.map((checkpoint) => (
          <Checkpoint key={checkpoint.id} checkpoint={checkpoint} />
        ))}
        <span
          className={`cx-tl__cap cx-tl__cap--end${track.filledPercent >= 100 ? " is-done" : ""}`}
          title={`End · ${graph.endLabel}`}
        />
      </span>
    </div>
  );
}

function Checkpoint({ checkpoint }: { checkpoint: CampaignProgressCheckpoint }) {
  const className = `cx-tl__dot cx-tl__dot--${checkpoint.tone}`;
  const style = { left: `${checkpoint.percent}%` };
  const date = checkpoint.showLabel ? (
    <span className="cx-tl__d">{checkpoint.label}</span>
  ) : null;
  if (checkpoint.contentUrl) {
    return (
      <a
        className="cx-tl__mark"
        href={checkpoint.contentUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        title={checkpoint.title}
      >
        <span className={className} />
        {date}
      </a>
    );
  }
  return (
    <span className="cx-tl__mark" style={style} title={checkpoint.title}>
      <span className={className} />
      {date}
    </span>
  );
}
