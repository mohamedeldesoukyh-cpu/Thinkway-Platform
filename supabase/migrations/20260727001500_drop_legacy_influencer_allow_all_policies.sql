-- Remove legacy permissive "Allow authenticated users *" influencers policies.
-- These OR with the intended influencers_* policies and effectively bypass
-- influencers.write / can_access_influencer for SELECT/INSERT/UPDATE.
-- Required so Vendor Default Terms (and other influencer writes) enforce RLS.

DROP POLICY IF EXISTS "Allow authenticated users select influencers" ON public.influencers;
DROP POLICY IF EXISTS "Allow authenticated users insert influencers" ON public.influencers;
DROP POLICY IF EXISTS "Allow authenticated users update influencers" ON public.influencers;
