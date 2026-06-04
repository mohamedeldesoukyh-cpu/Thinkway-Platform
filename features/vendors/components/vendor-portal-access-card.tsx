import { VendorPortalAccessForm } from "@/features/vendors/components/vendor-portal-access-form";
import { getLinkableCreatorProfiles } from "@/features/vendors/queries";

type Props = {
  influencerId: string;
  profileId: string | null;
};

export async function VendorPortalAccessCard({ influencerId, profileId }: Props) {
  const profiles = await getLinkableCreatorProfiles(influencerId);

  return (
    <VendorPortalAccessForm
      influencerId={influencerId}
      currentProfileId={profileId}
      profiles={profiles}
    />
  );
}
