"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { CLIENT_PROPOSAL_STATUS_LABEL, CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { summarizeCreatorDeliverables } from "../deliverables";
import { formatPlatformLabel, TO_BE_CONFIRMED } from "../format";
import { flagFromCountry, rosterHeadline, rosterSourceLine } from "../presentation";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { IconCheck, LogoMark } from "./review-icons";
import { ReviewPlatformMark } from "./review-platform-mark";
import { ReviewUpdateBanner } from "./review-update-banner";

export function ClientWorkspaceShell({
  view,
  token,
  children,
}: {
  view: ClientWorkspaceView;
  token: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const section = view.visibleSections.find((item) => pathname?.includes(`/${item}`)) ?? "overview";
  const hideInvest = section === "commercial" || section === "approval";
  const platforms = [
    ...new Set(
      [
        ...view.overview.platforms,
        ...view.creators.flatMap((creator) => {
          const fromItems = summarizeCreatorDeliverables(creator.deliverableItems).platforms;
          return fromItems.length > 0 ? fromItems : creator.platform ? [creator.platform] : [];
        }),
      ]
        .map((platform) => platform?.trim().toLowerCase())
        .filter((platform): platform is string => Boolean(platform))
    ),
  ];
  const markets = view.creators.reduce<Record<string, number>>((acc, creator) => {
    const key = creator.country?.trim();
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const marketChip = Object.entries(markets)
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => `${flagFromCountry(country)} ${country} · ${count}`)
    .join("  ·  ");
  const quotationTotal =
    view.commercial.quotationTotal > 0
      ? formatMoneyKpi(view.commercial.quotationTotal, view.commercial.currency)
      : TO_BE_CONFIRMED;

  return (
    <div className="tw-review">
      <header className="appbar">
        <div className="wrap row">
          <div className="logo">
            <LogoMark />
            <span className="wm">
              THINK<b>WAY</b>
            </span>
          </div>
          <div className="abx">
            <span className="pill review dot">{CLIENT_PROPOSAL_STATUS_LABEL[view.review.status]}</span>
            <span className="pill current">
              {view.newerReviewNumber ? `Updated · v${view.newerReviewNumber}` : `Current · v${view.review.reviewNumber}`}
            </span>
            {view.canDecide ? (
              <>
                <Link className="btn" href={buildClientReviewPath(view.review.id, token, "feedback")}>
                  Request changes
                </Link>
                <Link className="btn primary" href={buildClientReviewPath(view.review.id, token, "approval")}>
                  <IconCheck />
                  Approve proposal
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>
      {view.clientUpdate?.items.length ? (
        <ReviewUpdateBanner
          reviewId={view.review.id}
          token={token}
          updatedAt={view.clientUpdate.updatedAt}
          items={view.clientUpdate.items}
        />
      ) : null}

      <section className="hero">
        <div className="wrap row">
          <div>
            <div className="kicker">
              Influencer Marketing Proposal · Proposal v{view.review.reviewNumber}
            </div>
            <h1>{view.overview.campaignName}</h1>
            <div className="chips">
              {platforms.map((platform) => (
                <span key={platform} className="chip">
                  <ReviewPlatformMark platform={platform} />
                  {formatPlatformLabel(platform) ?? platform}
                </span>
              ))}
              <span className="chip">{rosterHeadline(view.creators.length)}</span>
              {marketChip ? <span className="chip">{marketChip}</span> : null}
              <span className="chip">{rosterSourceLine(view.review.source)}</span>
            </div>
          </div>
          {hideInvest ? null : (
            <div className="invest">
              <p className="l">Total quotation</p>
              <p className="v">{quotationTotal}</p>
              <p className="s">
                {rosterHeadline(view.commercial.totalCount || view.creators.length)} on this quotation
              </p>
            </div>
          )}
        </div>
      </section>

      <nav className="tabbar">
        <div className="wrap">
          <div className="tabs">
            {view.visibleSections.map((item) => (
              <Link
                key={item}
                href={buildClientReviewPath(view.review.id, token, item)}
                className={item === section ? "tab active" : "tab"}
              >
                {CLIENT_WORKSPACE_SECTION_LABEL[item]}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="wrap">{children}</main>
      <p className="foot">
        Confidential · Thinkway Platform
        {view.overview.clientLabel ? ` · Prepared for ${view.overview.clientLabel}` : ""}
      </p>
    </div>
  );
}
