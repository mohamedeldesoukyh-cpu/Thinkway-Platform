import { CreatorWorkspaceAccessPanel } from "@/features/vendors/components/creator-workspace-access-panel";
import { VendorPortalAccessForm } from "@/features/vendors/components/vendor-portal-access-form";
import { loadCreatorWorkspaceAccessView } from "@/features/creator-workspace/onboarding-service";
import { getLinkableCreatorProfiles } from "@/features/vendors/queries";

type Props = {
  influencerId: string;
  profileId: string | null;
};

export async function VendorPortalAccessCard({ influencerId, profileId }: Props) {
  const [profiles, access] = await Promise.all([
    getLinkableCreatorProfiles(influencerId),
    loadCreatorWorkspaceAccessView(influencerId),
  ]);

  return (
    <>
      {access ? <CreatorWorkspaceAccessPanel access={access} /> : null}
      <VendorPortalAccessForm
        influencerId={influencerId}
        currentProfileId={profileId}
        profiles={profiles}
      />
    </>
  );
}
