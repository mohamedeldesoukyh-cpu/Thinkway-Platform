-- Entity URL slugs: human-readable route keys alongside stable UUIDs.
-- Canonical URLs use `{slug}-{route_short_id}` (see lib/routing/entity-slug.ts).

CREATE OR REPLACE FUNCTION public.slugify_display_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    regexp_replace(
      lower(trim(coalesce(input, ''))),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '-+',
    '-',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.entity_route_short_id(entity_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(replace(entity_id::text, '-', ''), 8);
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'campaign_headers',
    'clients',
    'influencers',
    'groups',
    'quotations',
    'discovery_shortlists'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS slug text',
      tbl
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS route_short_id text GENERATED ALWAYS AS (public.entity_route_short_id(id)) STORED',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (slug, route_short_id) WHERE slug IS NOT NULL',
      tbl || '_slug_route_short_id_idx',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (route_short_id)',
      tbl || '_route_short_id_idx',
      tbl
    );
  END LOOP;
END $$;

-- Backfill slugs from display names.
UPDATE public.campaign_headers
SET slug = public.slugify_display_name(name)
WHERE slug IS NULL OR slug = '';

UPDATE public.clients
SET slug = public.slugify_display_name(name)
WHERE slug IS NULL OR slug = '';

UPDATE public.influencers
SET slug = public.slugify_display_name(display_name)
WHERE slug IS NULL OR slug = '';

UPDATE public.groups
SET slug = public.slugify_display_name(name)
WHERE slug IS NULL OR slug = '';

UPDATE public.quotations
SET slug = public.slugify_display_name(name)
WHERE slug IS NULL OR slug = '';

UPDATE public.discovery_shortlists
SET slug = public.slugify_display_name(name)
WHERE slug IS NULL OR slug = '';

-- Keep slug in sync when names change.
CREATE OR REPLACE FUNCTION public.sync_entity_slug_from_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name OR NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.slugify_display_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_influencer_slug_from_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name OR NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.slugify_display_name(NEW.display_name);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'campaign_headers',
    'clients',
    'influencers',
    'groups',
    'quotations',
    'discovery_shortlists'
  ]
  LOOP
    IF tbl = 'influencers' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_sync_slug', tbl);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF display_name ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_influencer_slug_from_display_name()',
        tbl || '_sync_slug',
        tbl
      );
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_sync_slug', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF name ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_entity_slug_from_name()',
      tbl || '_sync_slug',
      tbl
    );
  END LOOP;
END $$;

COMMENT ON COLUMN public.campaign_headers.slug IS 'URL slug derived from campaign name; paired with route_short_id for canonical routes.';
COMMENT ON COLUMN public.clients.slug IS 'URL slug derived from legal entity name.';
COMMENT ON COLUMN public.influencers.slug IS 'URL slug derived from creator/vendor name.';
COMMENT ON COLUMN public.groups.slug IS 'URL slug derived from group name.';
COMMENT ON COLUMN public.quotations.slug IS 'URL slug derived from quotation name.';
COMMENT ON COLUMN public.discovery_shortlists.slug IS 'URL slug derived from shortlist name.';
