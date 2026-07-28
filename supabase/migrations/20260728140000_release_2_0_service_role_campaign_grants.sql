-- Release 2.0 soak: restore service_role DML on Assignment convert tables.
-- Development first. Authenticated app path already had INSERT; service_role was
-- SELECT-only on campaign_headers/campaign_lines which blocks workers and Dev soak.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_headers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_deliverables TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_commercial_snapshots TO service_role;

-- VAT lookup used by createCampaignLine (service-role workers / Dev soak harness)
GRANT SELECT ON public.md_vat_rates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_post_schedule TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.discovery_shortlists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_shortlist_items TO service_role;

-- Posts table may not exist on older DBs; ignore if missing via DO block.
DO $$
BEGIN
  IF to_regclass('public.assignment_deliverable_posts') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_deliverable_posts TO service_role';
  END IF;
END $$;
