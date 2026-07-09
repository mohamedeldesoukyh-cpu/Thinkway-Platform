-- Persist structured brief representation alongside flattened parsed_text.

ALTER TABLE public.campaign_intelligence_documents
  ADD COLUMN IF NOT EXISTS llm_brief_text text,
  ADD COLUMN IF NOT EXISTS structured_document jsonb;

COMMENT ON COLUMN public.campaign_intelligence_documents.llm_brief_text IS
  'LLM-friendly serialized brief text derived from structured blocks (preferred for re-analysis).';
COMMENT ON COLUMN public.campaign_intelligence_documents.structured_document IS
  'Structured brief document blocks (headings, tables, lists) — not flattened.';
