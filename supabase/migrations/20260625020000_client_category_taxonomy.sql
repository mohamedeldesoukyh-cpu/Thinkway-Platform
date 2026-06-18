-- Client intelligence taxonomy: store category/subcategory slugs as text (not legacy enum).
-- Aligns with Thinkway Intelligence Engine workbook categories (emoji labels in app layer).

ALTER TABLE public.clients
  ALTER COLUMN client_category DROP DEFAULT;

ALTER TABLE public.clients
  ALTER COLUMN client_category TYPE text
  USING client_category::text;

DROP TYPE IF EXISTS public.client_category;

COMMENT ON COLUMN public.clients.client_category IS
  'Intelligence-engine category slug (see lib/clients/client-category-taxonomy.ts). Distinct from brand md_categories.';

COMMENT ON COLUMN public.clients.client_subcategory IS
  'Intelligence-engine subcategory slug paired with client_category.';
