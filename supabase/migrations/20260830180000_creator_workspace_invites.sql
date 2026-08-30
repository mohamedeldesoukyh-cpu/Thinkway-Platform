-- Creator Workspace onboarding (A): bind hashed user_invites to one influencer.
-- Development only. Additive. Does not create a parallel invitation SSOT.
-- Does not grant campaigns.write. Does not change Production.

ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.user_invites.influencer_id IS
  'Creator Workspace invites: exactly one influencer. Null for internal/client Settings invites.';

CREATE INDEX IF NOT EXISTS user_invites_influencer_id_idx
  ON public.user_invites (influencer_id)
  WHERE influencer_id IS NOT NULL;

-- One pending Creator Workspace invitation per influencer.
CREATE UNIQUE INDEX IF NOT EXISTS user_invites_one_pending_creator_invite
  ON public.user_invites (influencer_id)
  WHERE portal_type = 'creator'
    AND status = 'invited'
    AND influencer_id IS NOT NULL;
