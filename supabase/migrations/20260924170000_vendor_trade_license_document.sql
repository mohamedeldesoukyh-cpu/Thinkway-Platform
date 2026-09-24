ALTER TYPE public.influencer_document_type ADD VALUE IF NOT EXISTS 'trade_license';
NOTIFY pgrst, 'reload schema';
