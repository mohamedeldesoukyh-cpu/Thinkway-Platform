-- Allow temporary chunk payloads (JSON) in creator-imports bucket.
-- Chunk files are stored at {importFileId}/chunks/{index}.json during processing.

UPDATE storage.buckets
SET allowed_mime_types = array(
  SELECT DISTINCT unnest(
    coalesce(allowed_mime_types, ARRAY[]::text[]) || ARRAY['application/json']::text[]
  )
)
WHERE id = 'creator-imports';
