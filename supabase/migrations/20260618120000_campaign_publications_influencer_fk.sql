-- Repair: ensure campaign_publications.influencer_id FK exists for PostgREST embeds.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS influencer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_publications_influencer_id_fkey'
      AND conrelid = 'public.campaign_publications'::regclass
  ) THEN
    ALTER TABLE public.campaign_publications
      ADD CONSTRAINT campaign_publications_influencer_id_fkey
      FOREIGN KEY (influencer_id)
      REFERENCES public.influencers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_publications_influencer_id_idx
  ON public.campaign_publications (influencer_id);
