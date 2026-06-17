SELECT i.id, i.display_name, h.handle
FROM public.influencers i
LEFT JOIN public.influencer_platform_accounts h ON h.influencer_id = i.id
ORDER BY i.display_name, h.handle;
