"use client";

import { useState } from "react";

import {
  brandFaviconUrl,
  brandLogoUrl,
  brandMentionsForDisplay,
  brandMentionsInsight,
  visibleBrandLogos,
} from "../brand-mentions";
import { DATA_NOT_AVAILABLE } from "../format";
import { estimatedReachInsight } from "../presentation";
import type { ClientBrandMention } from "../types";

export function EstimatedReachCard({
  reach,
  followers,
}: {
  reach?: number | null;
  followers?: number | null;
}) {
  const insight = estimatedReachInsight({ reach, followers });
  return (
    <section className="insight">
      <p className="st">Estimated reach</p>
      {insight ? (
        <>
          <p className="rp-big">
            <span className="n">{insight.value}</span>
            {insight.badge ? <span className={`badge ${insight.badge.className}`}>{insight.badge.text}</span> : null}
          </p>
          <p className="desc">{insight.explanation}</p>
        </>
      ) : (
        <p className="unavailable">{DATA_NOT_AVAILABLE}</p>
      )}
    </section>
  );
}

export function BrandMentionsCard({ mentions }: { mentions: ClientBrandMention[] }) {
  const insight = brandMentionsInsight(mentions);
  const logos = visibleBrandLogos(mentions);
  const extra = brandMentionsForDisplay(mentions).extraCount;
  if (!insight) {
    return (
      <section className="insight">
        <p className="st">Brand mentions</p>
        <p className="unavailable">{DATA_NOT_AVAILABLE}</p>
      </section>
    );
  }
  return (
    <section className="insight">
      <p className="st">
        {insight.windowDays === 180 ? "Brand mentions over the past 180 days" : "Brand mentions"}
      </p>
      <p className="rp-big">
        <span className="n">{insight.count}</span>
        {insight.badge ? <span className={`badge ${insight.badge.className}`}>{insight.badge.text}</span> : null}
      </p>
      <p className="desc">{insight.explanation}</p>
      {logos.length > 0 ? (
        <div className="brands">
          {logos.map((brand, index) => (
            <BrandLogo key={`${brand.name}-${index}`} mention={brand} />
          ))}
          {extra > 0 ? <span className="brand more">+{extra}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function BrandLogo({ mention }: { mention: ClientBrandMention }) {
  const [stage, setStage] = useState<"logo" | "favicon" | "initial">("logo");
  const src = stage === "logo" ? brandLogoUrl(mention) : stage === "favicon" ? brandFaviconUrl(mention) : null;
  return (
    <span className="brand" title={mention.name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setStage(stage === "logo" ? "favicon" : "initial")}
        />
      ) : (
        mention.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
