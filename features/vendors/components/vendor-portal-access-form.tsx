"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setInfluencerProfileLinkAction,
  type FormActionState,
} from "@/features/vendors/actions";

const INITIAL: FormActionState = { ok: false };

type ProfileOption = { id: string; full_name: string | null; email: string };

type Props = {
  influencerId: string;
  currentProfileId: string | null;
  profiles: ProfileOption[];
};

export function VendorPortalAccessForm({
  influencerId,
  currentProfileId,
  profiles,
}: Props) {
  const [profileId, setProfileId] = useState(currentProfileId ?? "");
  const [state, action, pending] = useActionState(setInfluencerProfileLinkAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <CampaignFlatSection
      title="Creator portal login"
      description="Links this vendor to a user with the influencer role so they can sign in to the creator portal."
    >
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="influencer_id" value={influencerId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <div className="grid gap-2 min-w-[240px]">
            <Label>Linked user</Label>
            <Select
              value={profileId || "__none__"}
              onValueChange={(v) => setProfileId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select portal user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not linked</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save link"}
          </Button>
        </form>
    </CampaignFlatSection>
  );
}
