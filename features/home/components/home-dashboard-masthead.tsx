"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import {
  DiscoverySuiteMasthead,
  type DiscoverySuiteMetric,
} from "@/features/discovery/components/design-system/discovery-suite-masthead";
import { HomeDashboardJump } from "@/features/home/components/home-dashboard-pack";
import {
  HomeDashboardPageSwitcher,
  type HomeDashboardPageKey,
} from "@/features/home/components/home-dashboard-page-switcher";

export type HomeDashboardMastheadProps = {
  page: HomeDashboardPageKey;
  id?: string | null;
  subtitle: string;
  badgeLabel: string;
  badgeTone?: "r" | "";
  userHandle: string;
  metrics: DiscoverySuiteMetric[];
  bandMessage: string;
  bandSub: string;
  bandHref: string;
  bandCta: string;
  actions: ReactNode;
  jumps: { href: string; label: string; count?: number | null }[];
};

export function HomeDashboardMasthead({
  page,
  id,
  subtitle,
  badgeLabel,
  badgeTone = "",
  userHandle,
  metrics,
  bandMessage,
  bandSub,
  bandHref,
  bandCta,
  actions,
  jumps,
}: HomeDashboardMastheadProps) {
  const title = page === "home" ? "Home" : "Executive dashboard";

  return (
    <DiscoverySuiteMasthead
      title={title}
      id={id}
      subtitle={subtitle}
      badge={<span className={badgeTone === "r" ? "st r" : "st"}>{badgeLabel}</span>}
      hideJump
      titleSlot={<HomeDashboardPageSwitcher page={page} />}
      jumpSlot={<HomeDashboardJump items={jumps} />}
      metricsSlot={
        <>
          <div className="tw-ms2" role="group" aria-label="Page metrics">
            {metrics
              .filter((metric) => metric.value !== "" && metric.value != null)
              .map((metric) => (
                <div key={metric.label}>
                  <i>{metric.label}</i>
                  <b className={metric.tone}>{metric.value}</b>
                </div>
              ))}
          </div>
          <div className="tw-mr">
            {actions}
            <span style={{ flex: 1 }} />
            <span className="tw-crumb">
              Thinkway v2.6 · last sync <b>just now</b>
            </span>
          </div>
        </>
      }
      mastLead={
        <>
          <span className="wm" aria-hidden />
          <Link className="tw-idbar" href="/" title="Thinkway">
            <span className="tw-mkfig">
              <span className="tw-mkdot" />
              <span className="tw-mkchip" />
            </span>
            <span className="tw-wordmark">
              THINK<em>WAY</em>
            </span>
            <span className="tw-iddv" />
            <span className="tw-idtag">Influencer operations</span>
            <span className="tw-idmeta">
              <span className="tw-live on" />
              v2.6 · MENA
            </span>
          </Link>
        </>
      }
      top={
        <div className="tw-top">
          <span className="tw-crumb">
            Thinkway <b>{title}</b>
            {id ? ` · ${id}` : ""}
          </span>
          <span style={{ flex: 1 }} />
          <span className="tw-p p-y">
            <span className="tw-live on" /> Development
          </span>
          <span className="tw-crumb">
            <b>{userHandle}</b>
          </span>
        </div>
      }
      band={
        <>
          <span className="lb">Focus</span>
          <span className="msg">{bandMessage}</span>
          <span className="sub">{bandSub}</span>
          <span style={{ flex: 1 }} />
          <Link className="go" href={bandHref}>
            {bandCta}
          </Link>
        </>
      }
      trailing={
        <span className="sub">
          <span className="tw-live on" /> {userHandle}
        </span>
      }
    />
  );
}
