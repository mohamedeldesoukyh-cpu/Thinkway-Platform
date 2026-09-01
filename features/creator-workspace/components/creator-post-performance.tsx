import type { PostPerformanceAnalysis } from "@/lib/creator-insights/post-performance";
import { formatMetricNumber } from "@/lib/creator-insights/stats";

const VERDICT_PILL: Record<PostPerformanceAnalysis["verdict"], { className: string; label: string }> = {
  strong: { className: "pill pill--ok", label: "Performing well" },
  on_track: { className: "pill pill--blue", label: "On track" },
  underperforming: { className: "pill pill--red", label: "Below your usual" },
  collecting: { className: "pill pill--pend", label: "Collecting" },
};

export function CreatorPostPerformancePanel({
  analysis,
}: {
  analysis: PostPerformanceAnalysis;
}) {
  const pill = VERDICT_PILL[analysis.verdict];
  const facts = [
    analysis.metricKey && analysis.metricValue != null
      ? {
          label: analysis.metricKey === "engagementRate" ? "Engagement" : analysis.metricKey,
          value: formatMetricNumber(analysis.metricValue, analysis.metricKey),
        }
      : null,
    analysis.feeLabel ? { label: "Fee on this post", value: analysis.feeLabel } : null,
    analysis.cpvLabel ? { label: "Cost per view", value: analysis.cpvLabel } : null,
    analysis.extraDelivery ? { label: "Mix", value: "Beyond the agreement" } : null,
  ].filter((row): row is { label: string; value: string } => row != null);

  return (
    <div className="pa">
      <div className="pa__top">
        <span className="blk__l">Performance analysis</span>
        <span className={pill.className}>{pill.label}</span>
      </div>
      <p className="pa__title">{analysis.title}</p>
      <p className="pa__exp">{analysis.explanation}</p>
      <p className="pa__advice">
        <span className="pa__advice-l">Advice</span>
        {analysis.advice}
      </p>
      {facts.length > 0 ? (
        <div className="pa__facts">
          {facts.map((fact) => (
            <span key={fact.label} className="pa__fact">
              <span className="pa__fact-l">{fact.label}</span>
              <span className="pa__fact-v num">{fact.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
