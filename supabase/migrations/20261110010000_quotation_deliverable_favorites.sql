-- Default presentation for existing unlabeled lines and future additions.
ALTER TABLE public.quotation_items ALTER COLUMN option_label SET DEFAULT 'Deliverables';
UPDATE public.quotation_items SET option_label = 'Deliverables' WHERE option_label IS NULL;

CREATE TABLE IF NOT EXISTS public.quotation_deliverable_favorites (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotation_favorites_array CHECK (jsonb_typeof(favorites) = 'array' AND jsonb_array_length(favorites) <= 30)
);
ALTER TABLE public.quotation_deliverable_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_favorites_select ON public.quotation_deliverable_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY quotation_favorites_insert ON public.quotation_deliverable_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY quotation_favorites_update ON public.quotation_deliverable_favorites FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.quotation_deliverable_favorites TO authenticated;
