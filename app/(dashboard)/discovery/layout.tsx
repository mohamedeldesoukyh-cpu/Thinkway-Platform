/**
 * Discovery + quotations + campaign brief/requirements surfaces share the
 * campaign workspace design tokens/classes (thinkway-campaign_*).
 */
import "@/app/styles/campaign-workspace.css";

/** Live Refresh Metrics waits on Apify in the server action. */
export const maxDuration = 300;

export default function DiscoveryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
