\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'brand_integrity_test' THEN RAISE EXCEPTION 'Disposable test database required'; END IF; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '90000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION public.is_internal_user() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.internal',true),'yes')='yes' $$;
CREATE FUNCTION public.get_user_role_slug() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.role',true),'operations') $$;
CREATE TABLE public.clients (id uuid PRIMARY KEY, name text NOT NULL, group_id uuid, status text DEFAULT 'active');
CREATE TABLE public.brands (id uuid PRIMARY KEY, name text NOT NULL, client_id uuid NOT NULL REFERENCES public.clients(id), group_id uuid);
CREATE TABLE public.test_campaigns (id integer PRIMARY KEY, brand_id uuid REFERENCES public.brands(id), client_id uuid REFERENCES public.clients(id));
CREATE TABLE public.test_quotes (id integer PRIMARY KEY, brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL);
CREATE TABLE public.test_contacts (id integer PRIMARY KEY, client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE);
CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.allowed',true)='yes' $$;
CREATE FUNCTION public.can_access_client(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.blocked_client',true),'')<>$1::text $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.test_quotes ENABLE ROW LEVEL SECURITY;
-- Intentionally no quote SELECT policy: dependency checks must see beyond RLS.
\ir ../../migrations/20261013190000_client_brand_dependency_protection.sql
SET test.allowed='yes';
SET test.internal='yes';
SET test.role='operations';
INSERT INTO clients(id,name) VALUES ('10000000-0000-4000-8000-000000000001','Source'),('10000000-0000-4000-8000-000000000002','Destination'),('10000000-0000-4000-8000-000000000003','Unused');
INSERT INTO brands(id,name,client_id) VALUES ('20000000-0000-4000-8000-000000000001','Brand','10000000-0000-4000-8000-000000000001');
SET ROLE authenticated;
DO $$ BEGIN
 IF delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Wrong') THEN RAISE EXCEPTION 'Wrong confirmation accepted'; END IF;
 IF move_unused_brand_client('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Stale client accepted'; END IF;
 IF NOT move_unused_brand_client('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Unused brand did not move'; END IF;
 BEGIN DELETE FROM clients WHERE name='Destination'; RAISE EXCEPTION 'Deleted client owning brand'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 PERFORM set_config('test.internal','no',true);
 BEGIN PERFORM delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand'); RAISE EXCEPTION 'Portal deletion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.internal','yes',true);
 PERFORM set_config('test.role','admin',true);
 BEGIN PERFORM delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand'); RAISE EXCEPTION 'Missing MFA accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.role','operations',true);
 PERFORM set_config('test.allowed','no',true);
 BEGIN PERFORM delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand'); RAISE EXCEPTION 'Unauthorized deletion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.allowed','yes',true);
 PERFORM set_config('test.blocked_client','10000000-0000-4000-8000-000000000001',true);
 BEGIN PERFORM move_unused_brand_client('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'Unauthorized destination accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO test_quotes VALUES(1,'20000000-0000-4000-8000-000000000001');
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM test_quotes) THEN RAISE EXCEPTION 'Fixture should be RLS hidden'; END IF;
 BEGIN PERFORM delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand'); RAISE EXCEPTION 'SET NULL dependency lost'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN PERFORM move_unused_brand_client('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'Linked brand moved'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM test_quotes;
INSERT INTO test_contacts VALUES(1,'10000000-0000-4000-8000-000000000003');
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM delete_unused_client_entity('client','10000000-0000-4000-8000-000000000003','Unused'); RAISE EXCEPTION 'Cascade dependency deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM test_contacts;
INSERT INTO test_campaigns VALUES(1,'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand'); RAISE EXCEPTION 'Campaign brand deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN PERFORM delete_unused_client_entity('client','10000000-0000-4000-8000-000000000002','Destination'); RAISE EXCEPTION 'Campaign client deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM test_campaigns;
SET ROLE authenticated;
DO $$ BEGIN
 IF NOT delete_unused_client_entity('brand','20000000-0000-4000-8000-000000000001','Brand') THEN RAISE EXCEPTION 'Unused brand delete failed'; END IF;
 IF NOT delete_unused_client_entity('client','10000000-0000-4000-8000-000000000003','Unused') THEN RAISE EXCEPTION 'Unused client delete failed'; END IF;
 IF delete_unused_client_entity('client','10000000-0000-4000-8000-000000000003','Unused') THEN RAISE EXCEPTION 'Repeat delete falsely successful'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: move, stale ownership, typed confirmation, permission, destination access, hidden dependencies, cascade protection, campaign protection, successful delete and repeat delete' AS result;
