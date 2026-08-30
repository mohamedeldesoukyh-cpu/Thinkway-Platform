"use client";

const FEATURE_TAGS = [
  "Insertion Orders",
  "Influencers",
  "Invoicing",
  "Campaigns",
  "SOOH",
] as const;

const DEFAULT_TAGLINE = "Manage IOs, influencers & campaigns — all in one place.";

export function LoginBrandPanel({
  tagline = DEFAULT_TAGLINE,
  tags = FEATURE_TAGS,
}: {
  tagline?: string;
  tags?: readonly string[];
}) {
  return (
    <div aria-hidden className="login-v2-brand-panel hidden min-[681px]:flex">
      <div className="login-v2-orb login-v2-orb-1" />
      <div className="login-v2-orb login-v2-orb-2" />
      <div className="login-v2-orb login-v2-orb-3" />
      <div className="login-v2-dots login-v2-dots-t" />
      <div className="login-v2-dots login-v2-dots-b" />
      <div className="login-v2-shape login-v2-sh1" />
      <div className="login-v2-shape login-v2-sh2" />
      <div className="login-v2-shape login-v2-sh3" />

      <div className="login-v2-brand-content">
        <div className="login-v2-illus">
          <span className="login-v2-spark login-v2-sp1">✦</span>
          <span className="login-v2-spark login-v2-sp2">★</span>
          <span className="login-v2-spark login-v2-sp3">✦</span>

          <div className="login-v2-camera">
            <div className="login-v2-cam-body">
              <div className="login-v2-cam-lens" />
              <div className="login-v2-cam-reel" />
              <div className="login-v2-cam-reel2" />
            </div>
          </div>

          <div className="login-v2-person">
            <div className="login-v2-p-head" />
            <div className="login-v2-p-body">
              <div className="login-v2-p-arm-l" />
              <div className="login-v2-p-arm-r" />
            </div>
            <div className="login-v2-p-leg-l" />
            <div className="login-v2-p-leg-r" />
          </div>
        </div>

        <h2 className="login-v2-brand-title">
          Hello,
          <br />
          friend!
        </h2>
        <p className="login-v2-brand-tagline">{tagline}</p>

        <div className="login-v2-tags">
          {tags.map((tag) => (
            <span key={tag} className="login-v2-tag">
              <span className="login-v2-tag-dot" />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
