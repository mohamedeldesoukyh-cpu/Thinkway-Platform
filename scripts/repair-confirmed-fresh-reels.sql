-- Source verified 2026-11-19: existing Apify datasets report productType=clips.
-- Match IDs AND exact URL AND previous type. Preserve payment and IO records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.confirmed_reel_repair_backup_20261119 (
 id uuid PRIMARY KEY, captured_at timestamptz DEFAULT now(), previous_row jsonb NOT NULL
);
ALTER TABLE public.confirmed_reel_repair_backup_20261119 ENABLE ROW LEVEL SECURITY;
CREATE TEMP TABLE confirmed_reel_targets(id uuid, url text) ON COMMIT DROP;
INSERT INTO confirmed_reel_targets VALUES
 ('7422ef32-bee9-40ed-988c-f79550d411d0','https://www.instagram.com/p/Df5Y5OXRaY-/'),
 ('93809463-7491-4c0e-8140-3173a759ae9d','https://www.instagram.com/p/Df5Y5OXRaY-/'),
 ('ef2b7ed6-2ddd-4546-b808-209f4afc656f','https://www.instagram.com/p/Df5N_HwMQ_C/'),
 ('c4c69c6a-67f4-4ad6-ac7c-f62625ceb780','https://www.instagram.com/p/Dfpup3ixmZG/');
INSERT INTO confirmed_reel_repair_backup_20261119(id,previous_row)
 SELECT p.id,to_jsonb(p) FROM campaign_publications p JOIN confirmed_reel_targets t ON p.id=t.id AND p.content_url=t.url
 WHERE p.platform='instagram' AND p.publication_type='instagram_post' ON CONFLICT DO NOTHING;
UPDATE campaign_publications p SET publication_type='instagram_reel'
 FROM confirmed_reel_targets t WHERE p.id=t.id AND p.content_url=t.url AND p.platform='instagram' AND p.publication_type='instagram_post';
COMMIT;
