-- =============================================================================
-- Thinkway Platform — Seed Data
-- Run AFTER schema.sql (policies.sql can run before or after seed)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
INSERT INTO public.roles (slug, name, description, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Full platform access including system configuration.', true),
  ('admin', 'Admin', 'Full operational access across all modules.', true),
  ('account_manager', 'Account Manager', 'Manages assigned clients, campaigns, and deliverables.', true),
  ('finance', 'Finance', 'Manages invoices, payments, and financial reporting.', true),
  ('operations', 'Operations', 'Coordinates influencers, deliverables, and campaign execution.', true),
  ('client_user', 'Client User', 'Read-only and approval access for assigned client accounts.', true),
  ('influencer', 'Influencer', 'Access to assigned campaigns and own deliverables.', true),
  ('viewer', 'Viewer', 'Minimal read-only access for invited users.', true)
ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    updated_at = timezone('utc', now());

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('clients.read', 'clients', 'read', 'View client records'),
  ('clients.write', 'clients', 'write', 'Create and update client records'),
  ('clients.delete', 'clients', 'delete', 'Archive or delete client records'),

  ('campaigns.read', 'campaigns', 'read', 'View campaigns'),
  ('campaigns.write', 'campaigns', 'write', 'Create and update campaigns'),
  ('campaigns.delete', 'campaigns', 'delete', 'Delete or cancel campaigns'),

  ('influencers.read', 'influencers', 'read', 'View influencer profiles'),
  ('influencers.write', 'influencers', 'write', 'Create and update influencer profiles'),
  ('influencers.delete', 'influencers', 'delete', 'Remove influencer records'),

  ('deliverables.read', 'deliverables', 'read', 'View deliverables'),
  ('deliverables.write', 'deliverables', 'write', 'Create and update deliverables'),
  ('deliverables.delete', 'deliverables', 'delete', 'Delete deliverables'),

  ('invoices.read', 'invoices', 'read', 'View invoices'),
  ('invoices.write', 'invoices', 'write', 'Create and update invoices'),
  ('invoices.delete', 'invoices', 'delete', 'Void or delete invoices'),

  ('payments.read', 'payments', 'read', 'View payments'),
  ('payments.write', 'payments', 'write', 'Record and update payments'),
  ('payments.delete', 'payments', 'delete', 'Remove payment records'),

  ('finance.read', 'finance', 'read', 'Read finance control documents, postings, and adjustments'),
  ('finance.write', 'finance', 'write', 'Create and update finance control documents and postings'),
  ('finance.override', 'finance', 'override', 'Override invoice/period locks and mutate FX rates'),

  ('approvals.read', 'approvals', 'read', 'View approval requests'),
  ('approvals.write', 'approvals', 'write', 'Create approval requests'),
  ('approvals.decide', 'approvals', 'decide', 'Approve or reject requests'),
  ('approvals.delete', 'approvals', 'delete', 'Cancel approval requests'),

  ('users.read', 'users', 'read', 'View user profiles'),
  ('users.write', 'users', 'write', 'Manage user profiles and roles'),

  ('audit.read', 'audit', 'read', 'View audit logs'),

  ('analytics.read', 'analytics', 'read', 'View dashboards and analytics')
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

-- -----------------------------------------------------------------------------
-- Role → permission mappings
-- -----------------------------------------------------------------------------
WITH role_map AS (
  SELECT slug, id FROM public.roles
),
perm_map AS (
  SELECT slug, id FROM public.permissions
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
CROSS JOIN perm_map p
WHERE
  -- Super admin: all permissions
  (r.slug = 'super_admin')
  OR
  -- Admin: all except nothing (same as super_admin operationally)
  (r.slug = 'admin')
  OR
  -- Account manager
  (r.slug = 'account_manager' AND p.slug IN (
    'clients.read', 'clients.write',
    'campaigns.read', 'campaigns.write',
    'influencers.read', 'influencers.write',
    'deliverables.read', 'deliverables.write',
    'invoices.read',
    'approvals.read', 'approvals.write', 'approvals.decide',
    'users.read',
    'analytics.read'
  ))
  OR
  -- Finance
  (r.slug = 'finance' AND p.slug IN (
    'clients.read',
    'campaigns.read',
    'invoices.read', 'invoices.write',
    'payments.read', 'payments.write',
    'finance.read', 'finance.write', 'finance.override',
    'approvals.read', 'approvals.decide',
    'audit.read',
    'analytics.read'
  ))
  OR
  -- Operations
  (r.slug = 'operations' AND p.slug IN (
    'clients.read',
    'campaigns.read', 'campaigns.write',
    'influencers.read', 'influencers.write',
    'deliverables.read', 'deliverables.write',
    'approvals.read', 'approvals.write',
    'analytics.read'
  ))
  OR
  -- Client portal user
  (r.slug = 'client_user' AND p.slug IN (
    'clients.read',
    'campaigns.read',
    'deliverables.read',
    'invoices.read',
    'approvals.read', 'approvals.decide',
    'analytics.read'
  ))
  OR
  -- Influencer
  (r.slug = 'influencer' AND p.slug IN (
    'campaigns.read',
    'deliverables.read', 'deliverables.write',
    'approvals.read', 'approvals.write'
  ))
  OR
  -- Viewer
  (r.slug = 'viewer' AND p.slug IN (
    'clients.read',
    'campaigns.read',
    'analytics.read'
  ))
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Document sequence registry (starting values)
-- -----------------------------------------------------------------------------
INSERT INTO public.document_sequences (prefix, last_value)
VALUES
  ('CLT', 0),
  ('CMP', 0),
  ('INF', 0),
  ('DLV', 0),
  ('INV', 0),
  ('PAY', 0),
  ('APR', 0)
ON CONFLICT (prefix) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Demo / development sample data (optional — safe to remove in production)
-- Requires at least one authenticated user in auth.users to link profiles.
-- Uncomment and replace UUIDs after creating users in Supabase Auth.
-- -----------------------------------------------------------------------------

/*
-- Example: promote first auth user to super_admin after signup
UPDATE public.profiles
SET role_id = (SELECT id FROM public.roles WHERE slug = 'super_admin')
WHERE id = '<YOUR_AUTH_USER_UUID>';

INSERT INTO public.clients (
  name,
  legal_name,
  industry,
  website,
  status,
  billing_email,
  billing_address,
  currency,
  notes
)
VALUES (
  'Acme Beauty Co.',
  'Acme Beauty Co. Ltd.',
  'Beauty & Cosmetics',
  'https://acmebeauty.example',
  'active',
  'billing@acmebeauty.example',
  '{"line1":"100 Market Street","city":"San Francisco","state":"CA","postal_code":"94105","country":"US"}'::jsonb,
  'USD',
  'Seed client for development.'
);

INSERT INTO public.client_contacts (client_id, full_name, email, job_title, is_primary)
SELECT id, 'Jane Cooper', 'jane.cooper@acmebeauty.example', 'Marketing Director', true
FROM public.clients
WHERE name = 'Acme Beauty Co.'
LIMIT 1;

INSERT INTO public.campaigns (
  client_id,
  name,
  description,
  status,
  budget,
  currency,
  start_date,
  end_date,
  objectives
)
SELECT
  c.id,
  'Summer Glow Launch',
  'Influencer seeding campaign for the Summer Glow product line.',
  'planning',
  75000.00,
  'USD',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '90 days',
  '["brand_awareness","product_launch","ugc"]'::jsonb
FROM public.clients c
WHERE c.name = 'Acme Beauty Co.'
LIMIT 1;

INSERT INTO public.influencers (
  display_name,
  legal_name,
  email,
  status,
  country_code,
  languages,
  categories,
  rate_card,
  notes
)
VALUES
  (
    'Maya Styles',
    'Maya Styles LLC',
    'maya@influencer.example',
    'active',
    'US',
    ARRAY['en'],
    ARRAY['beauty', 'lifestyle'],
    '{"instagram_reel":2500,"instagram_story":800}'::jsonb,
    'Top-tier beauty creator.'
  ),
  (
    'Alex Chen',
    NULL,
    'alex@creator.example',
    'active',
    'CA',
    ARRAY['en', 'fr'],
    ARRAY['tech', 'lifestyle'],
    '{"youtube_video":5000}'::jsonb,
    'Tech lifestyle creator.'
  );

INSERT INTO public.influencer_platform_accounts (
  influencer_id,
  platform,
  handle,
  profile_url,
  follower_count,
  engagement_rate,
  is_verified,
  is_primary
)
SELECT i.id, 'instagram', 'mayastyles', 'https://instagram.com/mayastyles', 420000, 3.450, true, true
FROM public.influencers i
WHERE i.display_name = 'Maya Styles'
LIMIT 1;

INSERT INTO public.campaign_influencers (
  campaign_id,
  influencer_id,
  status,
  agreed_fee,
  currency,
  deliverable_count,
  invited_at
)
SELECT
  camp.id,
  inf.id,
  'confirmed',
  15000.00,
  'USD',
  3,
  timezone('utc', now())
FROM public.campaigns camp
CROSS JOIN public.influencers inf
WHERE camp.name = 'Summer Glow Launch'
  AND inf.display_name = 'Maya Styles'
LIMIT 1;

INSERT INTO public.deliverables (
  campaign_id,
  influencer_id,
  campaign_influencer_id,
  deliverable_type,
  title,
  description,
  status,
  due_date,
  platform
)
SELECT
  ci.campaign_id,
  ci.influencer_id,
  ci.id,
  'instagram_reel',
  'Summer Glow Reel #1',
  '60-second reel showcasing the Summer Glow serum.',
  'pending',
  timezone('utc', now()) + INTERVAL '14 days',
  'instagram'
FROM public.campaign_influencers ci
JOIN public.campaigns camp ON camp.id = ci.campaign_id
JOIN public.influencers inf ON inf.id = ci.influencer_id
WHERE camp.name = 'Summer Glow Launch'
  AND inf.display_name = 'Maya Styles'
LIMIT 1;

INSERT INTO public.invoices (
  client_id,
  campaign_id,
  status,
  issue_date,
  due_date,
  tax_amount,
  currency,
  notes
)
SELECT
  camp.client_id,
  camp.id,
  'draft',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  0,
  'USD',
  'Seed invoice for Summer Glow Launch.'
FROM public.campaigns camp
WHERE camp.name = 'Summer Glow Launch'
LIMIT 1;

INSERT INTO public.invoice_line_items (
  invoice_id,
  sort_order,
  description,
  quantity,
  unit_price,
  campaign_id
)
SELECT
  inv.id,
  1,
  'Influencer management fee — Summer Glow Launch',
  1,
  7500.00,
  inv.campaign_id
FROM public.invoices inv
JOIN public.campaigns camp ON camp.id = inv.campaign_id
WHERE camp.name = 'Summer Glow Launch'
LIMIT 1;

INSERT INTO public.approvals (
  entity_type,
  entity_id,
  status,
  title,
  description,
  due_at
)
SELECT
  'campaign',
  camp.id,
  'pending',
  'Campaign plan approval',
  'Review and approve the Summer Glow Launch campaign plan.',
  timezone('utc', now()) + INTERVAL '7 days'
FROM public.campaigns camp
WHERE camp.name = 'Summer Glow Launch'
LIMIT 1;
*/
