-- Minimal disposable integration schema. NEVER run against shared dev/production.
DO $$ BEGIN IF current_database()<>'signing_review' THEN RAISE EXCEPTION 'Local signing_review database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.influencers(id uuid PRIMARY KEY, profile_id uuid REFERENCES auth.users, display_name text, email text);
CREATE TABLE public.campaign_headers(id uuid PRIMARY KEY,name text);
CREATE TABLE public.vendor_ios(
 id uuid PRIMARY KEY,influencer_id uuid REFERENCES public.influencers,campaign_header_id uuid REFERENCES public.campaign_headers,
 document_number text,status text,revision_number integer NOT NULL DEFAULT 1,is_superseded boolean DEFAULT false,
 terms_html text,terms_text text,usage_rights text,exclusivity text,special_payment_terms text,compliance_country_code text,
 amount numeric,currency_code text,delivery_recipient text,approval_token_hash text,approval_token_consumed_hash text,
 approval_token_expires_at timestamptz,approved_at timestamptz,approved_by_name text,approved_by_email text,
 approved_revision_number integer,approval_ip inet,approval_accessed_at timestamptz,generated_pdf_url text,rejection_reason text,updated_at timestamptz
);
CREATE TABLE public.io_notifications(io_type text,io_id uuid,event_type text,payload jsonb);
CREATE FUNCTION public.hash_io_approval_token(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT encode(sha256(convert_to(t,'UTF8')),'hex')$$;
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text,metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,storage TO authenticated,anon,service_role;
GRANT ALL ON storage.objects TO authenticated,service_role;
CREATE POLICY existing_internal_storage_permissions ON storage.objects TO authenticated USING(true) WITH CHECK(true);
INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
INSERT INTO public.influencers VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Synthetic Creator','creator@example.invalid');
INSERT INTO public.campaign_headers VALUES('30000000-0000-4000-8000-000000000001','Synthetic signing review');
INSERT INTO public.vendor_ios(id,influencer_id,campaign_header_id,document_number,status,amount,currency_code,terms_html)
VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','SIGNING-TEST','sent',1,'AED','<html><body>Synthetic IO</body></html>');
