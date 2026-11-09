ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS option_label text;

ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_option_label_check
  CHECK (option_label IS NULL OR option_label IN ('Additional Service', 'Deliverables'));

COMMENT ON COLUMN public.quotation_items.option_label IS
  'Optional presentation label replacing Option N in quotation views and reports; does not affect pricing or grouping.';
