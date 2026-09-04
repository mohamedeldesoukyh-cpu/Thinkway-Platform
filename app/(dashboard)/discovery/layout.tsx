/**
 * Discovery + quotations + campaign brief/requirements surfaces share the
 * campaign workspace design tokens/classes (thinkway-campaign_*).
 *
 * Foundation (FROZEN Session 0): docs/architecture/discovery-specs/00-FOUNDATION.md
 * → app/styles/discovery.css (read-only). Pack: docs/architecture/discovery-specs/
 * Legacy suite sheet kept until page sessions 1–8 cut over; do not grow overrides.
 */
import "@/app/styles/campaign-workspace.css";
import "@/app/styles/discovery.css";
import "@/app/styles/discovery-suite.css";

/** Live Refresh Metrics waits on Apify in the server action. */
export const maxDuration = 300;

export default function DiscoveryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="discovery-suite flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}
