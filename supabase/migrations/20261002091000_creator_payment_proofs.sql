BEGIN;
CREATE TABLE public.creator_payment_proofs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.creator_payment_entries(id),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 storage_path text NOT NULL UNIQUE,
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),
 uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 uploaded_at timestamptz,
 removed_at timestamptz
);
CREATE INDEX creator_payment_proofs_payment ON public.creator_payment_proofs(payment_id);
ALTER TABLE public.creator_payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_proofs_read ON public.creator_payment_proofs FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.creator_payment_entries e WHERE e.id=payment_id AND public.can_manage_creator_payments(e.campaign_id,false))
);
CREATE POLICY payment_proofs_insert ON public.creator_payment_proofs FOR INSERT TO authenticated WITH CHECK (
 uploaded_by=auth.uid() AND EXISTS(SELECT 1 FROM public.creator_payment_entries e WHERE e.id=payment_id AND e.status='paid' AND public.can_manage_creator_payments(e.campaign_id,true))
);
CREATE POLICY payment_proofs_update ON public.creator_payment_proofs FOR UPDATE TO authenticated USING (
 EXISTS(SELECT 1 FROM public.creator_payment_entries e WHERE e.id=payment_id AND public.can_manage_creator_payments(e.campaign_id,true))
) WITH CHECK (
 EXISTS(SELECT 1 FROM public.creator_payment_entries e WHERE e.id=payment_id AND public.can_manage_creator_payments(e.campaign_id,true))
);
GRANT SELECT,INSERT,UPDATE ON public.creator_payment_proofs TO authenticated;
REVOKE DELETE ON public.creator_payment_proofs FROM authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('creator-payment-proofs','creator-payment-proofs',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp']);
-- Exact registered object path, finance permission AND campaign access. No public URLs.
CREATE OR REPLACE FUNCTION public.can_access_creator_payment_proof(p_path text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.creator_payment_proofs p JOIN public.creator_payment_entries e ON e.id=p.payment_id
 WHERE p.storage_path=p_path AND p.removed_at IS NULL
 AND (NOT p_write OR (p.uploaded_at IS NULL AND p.uploaded_by=auth.uid()))
 AND public.can_manage_creator_payments(e.campaign_id,p_write));
$$;
REVOKE ALL ON FUNCTION public.can_access_creator_payment_proof(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_creator_payment_proof(text,boolean) TO authenticated;
CREATE POLICY payment_proof_objects_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='creator-payment-proofs' AND public.can_access_creator_payment_proof(name,false)
);
CREATE POLICY payment_proof_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='creator-payment-proofs' AND public.can_access_creator_payment_proof(name,true)
);
NOTIFY pgrst,'reload schema';
COMMIT;
