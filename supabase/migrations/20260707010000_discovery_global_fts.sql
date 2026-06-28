-- Discovery global full-text search — weighted tsvector across creator attributes.
-- Weight A: username / display name
-- Weight B: categories, bio, location, languages
-- Weight C: recent publication captions
-- Weight D: hashtags, interests, mentions, contact, AI metadata, platform

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creator_jsonb_array_text(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    (
      SELECT string_agg(elem, ' ')
      FROM jsonb_array_elements_text(coalesce(value, '[]'::jsonb)) AS elem
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.creator_recent_publications_text(pubs jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    (
      SELECT string_agg(
        coalesce(elem->>'caption', '') || ' ' ||
        public.creator_jsonb_array_text(elem->'hashtags') || ' ' ||
        public.creator_jsonb_array_text(elem->'mentions'),
        ' '
      )
      FROM jsonb_array_elements(coalesce(pubs, '[]'::jsonb)) AS elem
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.creator_metadata_search_text(meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both ' ' FROM concat_ws(
    ' ',
    coalesce(meta->>'extracted_keywords', ''),
    coalesce(meta->>'ai_categories', ''),
    coalesce(meta->>'campaign_tags', ''),
    public.creator_jsonb_array_text(meta->'extracted_keywords'),
    public.creator_jsonb_array_text(meta->'ai_categories'),
    public.creator_jsonb_array_text(meta->'campaign_tags'),
    public.creator_jsonb_array_text(meta->'audience_interests'),
    public.creator_jsonb_array_text(meta->'niches'),
    public.creator_jsonb_array_text(meta->'categories'),
    coalesce(meta->>'audience_interests', ''),
    coalesce(meta->>'niches', '')
  ));
$$;

CREATE OR REPLACE FUNCTION public.creator_contact_links_text(links jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    (
      SELECT string_agg(link, ' ')
      FROM jsonb_array_elements_text(coalesce(links, '[]'::jsonb)) AS link
    ),
    ''
  );
$$;

-- -----------------------------------------------------------------------------
-- Influencers — search_vector (aggregates platform account enrichment)
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS influencers_search_idx
  ON public.influencers USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.build_influencer_search_vector(p_influencer_id uuid)
RETURNS tsvector
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  inf record;
  acc record;
  vec tsvector := ''::tsvector;
  pub_text text;
  meta_text text;
  acc_meta_text text;
  verified_text text;
BEGIN
  SELECT *
  INTO inf
  FROM public.influencers
  WHERE id = p_influencer_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  meta_text := public.creator_metadata_search_text(inf.metadata);

  vec :=
    setweight(to_tsvector('simple', coalesce(inf.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(inf.legal_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(inf.document_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(inf.categories, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.notes, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.country_code::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.nationality, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(inf.languages, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.email::text, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(inf.influencer_url, '')), 'D') ||
    setweight(to_tsvector('simple', meta_text), 'D');

  FOR acc IN
    SELECT *
    FROM public.influencer_platform_accounts
    WHERE influencer_id = p_influencer_id
  LOOP
    pub_text := public.creator_recent_publications_text(acc.recent_publications);
    acc_meta_text := public.creator_metadata_search_text(acc.metadata);
    verified_text := CASE WHEN coalesce(acc.is_verified, false) THEN 'verified' ELSE '' END;

    vec := vec ||
      setweight(to_tsvector('simple', coalesce(acc.handle::text, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.username::text, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.profile_display_name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.profile_bio, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(acc.platform, '')), 'D') ||
      setweight(to_tsvector('simple', verified_text), 'D') ||
      setweight(to_tsvector('simple', coalesce(acc.audience_country, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.interest_categories, ' '), '')), 'B') ||
      setweight(to_tsvector('simple', acc_meta_text), 'B') ||
      setweight(to_tsvector('simple', pub_text), 'C') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.hashtags, ' '), '')), 'D') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.mentions, ' '), '')), 'D') ||
      setweight(to_tsvector('simple', coalesce(acc.contact_email::text, '')), 'D') ||
      setweight(to_tsvector('simple', public.creator_contact_links_text(acc.contact_links)), 'D');
  END LOOP;

  RETURN vec;
END;
$$;

CREATE OR REPLACE FUNCTION public.influencers_search_vector_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := public.build_influencer_search_vector(NEW.id);
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.influencer_platform_accounts_search_vector_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.influencers i
  SET
    search_vector = public.build_influencer_search_vector(i.id),
    updated_at = timezone('utc', now())
  WHERE i.id = COALESCE(NEW.influencer_id, OLD.influencer_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS influencers_search_vector_trg ON public.influencers;
CREATE TRIGGER influencers_search_vector_trg
  BEFORE INSERT OR UPDATE OF
    display_name,
    legal_name,
    document_number,
    email,
    country_code,
    city,
    nationality,
    languages,
    categories,
    notes,
    influencer_url,
    metadata
  ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.influencers_search_vector_refresh();

DROP TRIGGER IF EXISTS influencer_platform_accounts_search_vector_trg
  ON public.influencer_platform_accounts;
CREATE TRIGGER influencer_platform_accounts_search_vector_trg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.influencer_platform_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.influencer_platform_accounts_search_vector_refresh();

UPDATE public.influencers i
SET search_vector = public.build_influencer_search_vector(i.id)
WHERE search_vector IS NULL OR search_vector = ''::tsvector;

-- -----------------------------------------------------------------------------
-- Discovered profiles — extended search_vector
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_discovered_profile_search_vector(p_profile_id uuid)
RETURNS tsvector
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  p record;
  posts_text text;
  ai_text text;
  meta_text text;
BEGIN
  SELECT *
  INTO p
  FROM public.discovered_profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    string_agg(
      coalesce(caption, '') || ' ' || coalesce(array_to_string(hashtags, ' '), ''),
      ' '
    ),
    ''
  )
  INTO posts_text
  FROM public.profile_posts
  WHERE profile_id = p_profile_id;

  SELECT coalesce(
    category, ''
  ) || ' ' || coalesce(
    niche, ''
  ) || ' ' || coalesce(
    influencer_summary, ''
  ) || ' ' || coalesce(
    content_style, ''
  ) || ' ' || coalesce(
    audience_persona, ''
  )
  INTO ai_text
  FROM public.profile_ai_scores
  WHERE profile_id = p_profile_id
  ORDER BY scored_at DESC
  LIMIT 1;

  meta_text := public.creator_metadata_search_text(p.metadata);

  RETURN
    setweight(to_tsvector('simple', coalesce(p.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(p.username::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(p.bio, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(p.category_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(p.city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(p.country_code::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(p.language_codes, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(p.platform::text, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(p.email_in_bio::text, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(posts_text, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(meta_text, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(ai_text, '')), 'D');
END;
$$;

CREATE OR REPLACE FUNCTION public.discovered_profiles_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := public.build_discovered_profile_search_vector(NEW.id);
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS discovered_profiles_search_vector_trg ON public.discovered_profiles;
CREATE TRIGGER discovered_profiles_search_vector_trg
  BEFORE INSERT OR UPDATE OF
    display_name,
    username,
    bio,
    category_tags,
    city,
    country_code,
    language_codes,
    email_in_bio,
    platform,
    metadata
  ON public.discovered_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.discovered_profiles_search_vector_update();

CREATE OR REPLACE FUNCTION public.profile_posts_search_vector_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.discovered_profiles dp
  SET
    search_vector = public.build_discovered_profile_search_vector(dp.id),
    updated_at = timezone('utc', now())
  WHERE dp.id = COALESCE(NEW.profile_id, OLD.profile_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS profile_posts_search_vector_trg ON public.profile_posts;
CREATE TRIGGER profile_posts_search_vector_trg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.profile_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_posts_search_vector_refresh();

CREATE OR REPLACE FUNCTION public.profile_ai_scores_search_vector_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.discovered_profiles dp
  SET
    search_vector = public.build_discovered_profile_search_vector(dp.id),
    updated_at = timezone('utc', now())
  WHERE dp.id = COALESCE(NEW.profile_id, OLD.profile_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS profile_ai_scores_search_vector_trg ON public.profile_ai_scores;
CREATE TRIGGER profile_ai_scores_search_vector_trg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.profile_ai_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_ai_scores_search_vector_refresh();

UPDATE public.discovered_profiles dp
SET search_vector = public.build_discovered_profile_search_vector(dp.id);

-- -----------------------------------------------------------------------------
-- Ranked search RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_influencers_fts(
  search_query text,
  result_limit integer DEFAULT 500
)
RETURNS TABLE (
  influencer_id uuid,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    i.id AS influencer_id,
    ts_rank_cd(i.search_vector, websearch_to_tsquery('simple', search_query)) AS rank
  FROM public.influencers i
  WHERE i.status = 'active'
    AND btrim(search_query) <> ''
    AND i.search_vector @@ websearch_to_tsquery('simple', search_query)
  ORDER BY rank DESC, i.display_name ASC
  LIMIT GREATEST(1, LEAST(result_limit, 1000));
$$;

CREATE OR REPLACE FUNCTION public.search_discovered_profiles_fts(
  search_query text,
  result_limit integer DEFAULT 500
)
RETURNS TABLE (
  profile_id uuid,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dp.id AS profile_id,
    ts_rank_cd(dp.search_vector, websearch_to_tsquery('simple', search_query)) AS rank
  FROM public.discovered_profiles dp
  WHERE btrim(search_query) <> ''
    AND dp.search_vector @@ websearch_to_tsquery('simple', search_query)
  ORDER BY rank DESC, dp.updated_at DESC
  LIMIT GREATEST(1, LEAST(result_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.search_influencers_fts(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_discovered_profiles_fts(text, integer) TO authenticated, service_role;
