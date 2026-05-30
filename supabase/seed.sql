-- =============================================================
-- Thinkway Platform — Seed Data
-- Apply AFTER schema.sql and policies.sql
-- =============================================================
-- IMPORTANT: Admin user must be created via Supabase Auth API first.
--
-- To create the initial admin user:
--   1. Sign up via the Supabase dashboard or Auth API with your email
--   2. Retrieve the user UUID from auth.users
--   3. Run the UPDATE below with the correct UUID
--
-- Example (replace with actual admin UUID after signup):
--   UPDATE public.profiles
--   SET role = 'admin', full_name = 'System Administrator', status = 'active'
--   WHERE email = 'admin@iconnect.com';
-- =============================================================

-- Ensure sequences table is seeded with starting values
INSERT INTO public.sequences (key, last_value)
VALUES
  ('client_code',  0),
  ('vendor_code',  0)
ON CONFLICT (key) DO NOTHING;

-- =============================================================
-- SAMPLE CLIENT — for development use only
-- Remove before production deployment
-- =============================================================
DO $$
DECLARE
  v_client_id UUID;
BEGIN
  INSERT INTO public.clients (
    name, trading_name, industry, tier, status, currency,
    payment_terms_days, tags
  )
  VALUES (
    'IConnect Internal', 'IConnect', 'marketing_advertising_media',
    'strategic', 'active', 'AED', 30, ARRAY['internal', 'seed']
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_client_id;
END $$;

-- =============================================================
-- PRESET GROUP REFERENCE
-- These correspond to PRESET_GROUPS in lib/constants/app.ts
-- The parent_group column in clients is a free-text field
-- populated from this list. No separate table needed.
-- =============================================================
-- Groups: L'Oréal, Alshaya Group, Armada Group, Landmark Retail,
-- Publicis Groupe, Chalhoub Group, Dentsu Group, MCN, OMG,
-- Assembly Global, Al Tayer Group, Maznexa, Marcom Arabia,
-- Al Futtaim Trading, Abdul Samad Al Qurashi, Bridges, Matrix,
-- Tact, Digitect Agency, Mullers, Major Agency, Ability,
-- Zamakan Agency, Al Qalzam Group, Apparel Group

-- =============================================================
-- VERIFICATION QUERIES (run manually to confirm seed)
-- =============================================================
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT COUNT(*) FROM public.clients;
-- SELECT * FROM public.sequences;
