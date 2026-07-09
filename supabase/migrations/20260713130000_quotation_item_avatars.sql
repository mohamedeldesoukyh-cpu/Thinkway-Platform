-- Persist creator avatar snapshot on quotation lines for stable document rendering.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS profile_url text;

COMMENT ON COLUMN public.quotation_items.profile_image_url IS
  'Creator avatar URL snapshot (proxied at display time).';
COMMENT ON COLUMN public.quotation_items.profile_url IS
  'External social profile URL snapshot for avatar fallback and links.';
