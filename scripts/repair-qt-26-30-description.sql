-- Repair only the two verified corrupt descriptions; preserve all commercial data.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE description_repair_before ON COMMIT DROP AS
 SELECT i.id, to_jsonb(i)-'service_description'-'updated_at' AS preserved
 FROM quotation_items i JOIN quotations q ON q.id=i.quotation_id
 WHERE q.serial_number='QT-2026-0030' AND i.service_description IN ('1× IG Reel + 1× IG Story + 1× Mirrored TT + 1× Boosting · 1 month + 1× Boosting · 1 month + 1× IG Story + 1× Mirrored TT + 1× Boosting · 1 month + 1× IG Story + 1× Mirrored TT','1× IG Reel + 1× IG Story + 1× Mirrored TT + 1× Boosting · 1 month + 1× IG Story + 1× Mirrored TT + 1× Boosting · 1 month + 1× IG Story + 1× Mirrored TT');
UPDATE quotation_items i SET service_description='1× IG Reel + 1× IG Story + 1× Mirrored TT + 1× Boosting · 1 month'
 FROM description_repair_before b WHERE i.id=b.id;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM quotation_items i JOIN description_repair_before b ON b.id=i.id
 WHERE to_jsonb(i)-'service_description'-'updated_at' IS DISTINCT FROM b.preserved)
 THEN RAISE EXCEPTION 'Description repair modified other quotation item data'; END IF;
END $$;
SELECT count(*) AS repaired_descriptions FROM description_repair_before;
COMMIT;
