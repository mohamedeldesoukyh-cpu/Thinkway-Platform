import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { CampaignMatchWorkspace } from "@/features/discovery/components/campaign-match/campaign-match-workspace";

export default function DiscoveryCampaignMatchPage() {
  return (
    <DiscoveryPageShell page="campaign-match" variant="flush">
      <CampaignMatchWorkspace />
    </DiscoveryPageShell>
  );
}
