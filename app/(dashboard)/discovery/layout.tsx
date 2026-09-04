/**
 * Discovery + quotations + campaign brief/requirements surfaces share the
 * campaign workspace design tokens/classes (thinkway-campaign_*).
 * Discovery suite redesign: docs/architecture/discovery.html + THINKWAY_DISCOVERY_DESIGN_SPEC.md
 */
import "@/app/styles/campaign-workspace.css";
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
