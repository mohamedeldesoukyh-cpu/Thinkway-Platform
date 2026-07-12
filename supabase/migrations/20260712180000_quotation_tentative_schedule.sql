-- Phase 3: tentative posting schedule on quotation deliverables (commercial snapshot).
-- Stored on quotation_items.deliverables JSONB — no new columns; documents expected shape.

COMMENT ON COLUMN public.quotation_items.deliverables IS
  'Per-creator deliverable scope and commercial lines (jsonb array). '
  'Each element includes platform, type, pricing fields, and optional tentative schedule: '
  'tentative_posting_date (ISO date), tentative_posting_label (e.g. Week 2 · Tuesday), '
  'planned_week, planned_day, schedule_source (campaign_plan | manual). '
  'Tentative dates are a commercial frozen snapshot from Campaign Plan media plan; '
  'operational live dates live on assignment_deliverables.live_date (Phase 6).';
