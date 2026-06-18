-- Client classification audit fields (slug-based taxonomy; no category_id FK)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS classification_source text,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(5, 2),
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_user uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

COMMENT ON COLUMN public.clients.classification_source IS
  'How category was determined: approved, rule, historical, ai_search, fallback';

COMMENT ON COLUMN public.clients.classification_confidence IS
  'Classification confidence score 0-100 at time of save';

COMMENT ON COLUMN public.clients.classification_reason IS
  'Human-readable explanation (rule name, matched client, AI reasoning)';

COMMENT ON COLUMN public.clients.classified_at IS
  'When classification metadata was last written';

COMMENT ON COLUMN public.clients.approved_by_user IS
  'User who approved category on save; NULL for legacy/unverified rows';

COMMENT ON COLUMN public.clients.last_verified_at IS
  'When classification was last explicitly verified on save';

CREATE INDEX IF NOT EXISTS clients_classification_source_idx
  ON public.clients (classification_source)
  WHERE classification_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_approved_by_user_idx
  ON public.clients (approved_by_user)
  WHERE approved_by_user IS NOT NULL;
