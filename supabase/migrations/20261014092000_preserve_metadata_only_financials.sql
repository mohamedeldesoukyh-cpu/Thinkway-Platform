-- Updating operational tags must not recalculate frozen VAT/financial amounts.
BEGIN;
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.compute_campaign_line_financials()'::regprocedure);
 IF position('Metadata-only operational updates' in definition)=0 THEN
  definition:=regexp_replace(definition,'BEGIN', 'BEGIN
   -- Metadata-only operational updates preserve all financial fields.
   IF TG_OP = ''UPDATE'' AND (to_jsonb(NEW)-ARRAY[''metadata'',''updated_at'']) = (to_jsonb(OLD)-ARRAY[''metadata'',''updated_at'']) THEN RETURN NEW; END IF;');
  EXECUTE definition;
 END IF;
END $$;
COMMIT;
