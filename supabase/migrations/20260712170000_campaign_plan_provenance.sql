-- Campaign Plan provenance — link quotations and campaigns to the approved
-- Campaign Plan (campaign_objects). Generators read the same source independently;
-- these columns record which plan version was used at generation time.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS campaign_object_id uuid
    REFERENCES public.campaign_objects (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_campaign_object_version integer;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS campaign_object_id uuid
    REFERENCES public.campaign_objects (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_campaign_object_version integer;

CREATE INDEX IF NOT EXISTS quotations_campaign_object_idx
  ON public.quotations (campaign_object_id)
  WHERE campaign_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_headers_campaign_object_idx
  ON public.campaign_headers (campaign_object_id)
  WHERE campaign_object_id IS NOT NULL;

COMMENT ON COLUMN public.quotations.campaign_object_id IS
  'Campaign Plan (campaign_objects) this quotation was generated from.';
COMMENT ON COLUMN public.quotations.source_campaign_object_version IS
  'campaign_object_versions.version snapshot used when the quotation was generated.';
COMMENT ON COLUMN public.campaign_headers.campaign_object_id IS
  'Campaign Plan (campaign_objects) this operational campaign was generated from.';
COMMENT ON COLUMN public.campaign_headers.source_campaign_object_version IS
  'campaign_object_versions.version snapshot used when the campaign was generated.';
