-- Run inside a transaction. Unqualified tables allow a dev rehearsal on temp copies.
CREATE TEMP TABLE quantity_targets(id uuid PRIMARY KEY, qty integer, expected_cost numeric);
INSERT INTO quantity_targets VALUES
('544584db-9f21-47f0-b628-4d08478b9a1a',3,2250),
('6100f065-6076-4946-b583-f46809b30558',4,7345),
('73a9fcfd-4101-48a4-b643-8e9f9009216f',4,7345),
('0d1e7ee2-5818-433f-8ee4-9a0f5e7443f0',2,1469),
('63e825cd-f8da-4bde-a301-3312cacc47ca',2,1400);
SELECT d.id FROM assignment_deliverables d JOIN quantity_targets t USING(id) FOR UPDATE OF d;
CREATE TEMP TABLE before_deliverables AS SELECT d.* FROM assignment_deliverables d JOIN quantity_targets t USING(id);
CREATE TEMP TABLE before_lines AS SELECT l.* FROM campaign_lines l WHERE id IN (SELECT campaign_line_id FROM before_deliverables);
CREATE TEMP TABLE before_posts AS SELECT p.* FROM assignment_post_schedule p WHERE assignment_deliverable_id IN (SELECT id FROM quantity_targets);
CREATE TEMP TABLE before_ios AS SELECT v.* FROM vendor_ios v WHERE id IN (SELECT vendor_io_id FROM vendor_io_lines WHERE campaign_line_id IN (SELECT id FROM before_lines));

DO $$ BEGIN
  IF (SELECT count(*) FROM before_deliverables)<>5 OR (SELECT count(*) FROM before_lines)<>4
     OR (SELECT count(*) FROM before_posts)<>5 OR (SELECT count(*) FROM before_ios)<>4 THEN
    RAISE EXCEPTION 'Unexpected repair scope';
  END IF;
  IF EXISTS(SELECT FROM before_deliverables d JOIN quantity_targets t USING(id)
      WHERE d.quantity<>1 OR d.total_cost<>t.expected_cost OR d.locked_at IS NOT NULL)
    OR EXISTS(SELECT FROM before_lines WHERE pricing_mode<>'package' OR vendor_assignment_locked)
    OR EXISTS(SELECT FROM before_ios WHERE status<>'generated' OR is_superseded)
    OR EXISTS(SELECT FROM before_posts WHERE sequence_number<>1 OR status<>'draft' OR live_date IS NOT NULL
      OR locked_at IS NOT NULL OR invoice_line_item_id IS NOT NULL OR invoiced_amount<>0 OR collected_amount<>0) THEN
    RAISE EXCEPTION 'Scope, status, fees or locks changed; stop and review';
  END IF;
END $$;

UPDATE assignment_deliverables d SET quantity=t.qty, unit_cost=d.total_cost/t.qty, schedule_mode='expanded'
FROM quantity_targets t WHERE d.id=t.id;

-- Preserve account identity and other metadata; only expand the contracted type list.
UPDATE campaign_lines l SET metadata=jsonb_set(l.metadata,'{influencer_assignment,platforms}',(
  SELECT jsonb_agg(jsonb_set(p.value,'{deliverables}',(
    SELECT jsonb_agg(d.deliverable_type ORDER BY d.sort_order,g.unit)
    FROM assignment_deliverables d CROSS JOIN LATERAL generate_series(1,d.quantity) g(unit)
    WHERE d.campaign_line_id=l.id AND d.platform=p.value->>'platform'
  )) ORDER BY p.ordinality)
  FROM jsonb_array_elements(l.metadata#>'{influencer_assignment,platforms}') WITH ORDINALITY p(value,ordinality)
)) WHERE l.id IN (SELECT id FROM before_lines);

-- Keep original schedule IDs/evidence; add the missing draft units.
INSERT INTO assignment_post_schedule(assignment_deliverable_id,campaign_line_id,sequence_number,status,revenue_vat_percent,cost_vat_percent)
SELECT p.assignment_deliverable_id,p.campaign_line_id,g.seq,'draft',p.revenue_vat_percent,p.cost_vat_percent
FROM before_posts p JOIN quantity_targets t ON t.id=p.assignment_deliverable_id
CROSS JOIN LATERAL generate_series(2,t.qty) g(seq);

-- Distribute original schedule amounts in cents, retaining exact aggregate totals.
UPDATE assignment_post_schedule p SET
 revenue_before_vat=trunc(b.revenue_before_vat/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.revenue_before_vat*100,t.qty) THEN .01 ELSE 0 END,
 cost_before_vat=trunc(b.cost_before_vat/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.cost_before_vat*100,t.qty) THEN .01 ELSE 0 END,
 revenue_vat_amount=trunc(b.revenue_vat_amount/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.revenue_vat_amount*100,t.qty) THEN .01 ELSE 0 END,
 cost_vat_amount=trunc(b.cost_vat_amount/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.cost_vat_amount*100,t.qty) THEN .01 ELSE 0 END,
 billable_amount=trunc(b.billable_amount/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.billable_amount*100,t.qty) THEN .01 ELSE 0 END,
 remaining_amount=trunc(b.remaining_amount/t.qty,2)+CASE WHEN p.sequence_number<=mod(b.remaining_amount*100,t.qty) THEN .01 ELSE 0 END
FROM before_posts b JOIN quantity_targets t ON t.id=b.assignment_deliverable_id
WHERE p.assignment_deliverable_id=t.id;

-- Force the next preview/download to use corrected quantities, preserving IO terms/status.
UPDATE vendor_ios SET generated_html_url=NULL,generated_pdf_url=NULL,terms_html=NULL,document_generated_at=NULL
WHERE id IN (SELECT id FROM before_ios);

DO $$ BEGIN
 IF EXISTS(SELECT FROM before_lines b JOIN campaign_lines l USING(id)
   WHERE to_jsonb(b)-ARRAY['metadata','updated_at'] IS DISTINCT FROM to_jsonb(l)-ARRAY['metadata','updated_at']) THEN
   RAISE EXCEPTION 'Assignment fields or finances changed'; END IF;
 IF EXISTS(SELECT FROM before_deliverables b JOIN assignment_deliverables d USING(id)
   WHERE to_jsonb(b)-ARRAY['quantity','unit_cost','schedule_mode','updated_at'] IS DISTINCT FROM to_jsonb(d)-ARRAY['quantity','unit_cost','schedule_mode','updated_at']) THEN
   RAISE EXCEPTION 'Deliverable fields or finances changed'; END IF;
 IF EXISTS(SELECT FROM before_ios b JOIN vendor_ios v USING(id)
   WHERE to_jsonb(b)-ARRAY['generated_html_url','generated_pdf_url','terms_html','document_generated_at','updated_at'] IS DISTINCT FROM to_jsonb(v)-ARRAY['generated_html_url','generated_pdf_url','terms_html','document_generated_at','updated_at']) THEN
   RAISE EXCEPTION 'IO fields, fees or custom terms changed'; END IF;
 IF EXISTS(SELECT FROM quantity_targets t JOIN assignment_deliverables d USING(id)
   WHERE d.quantity<>t.qty OR d.unit_cost*t.qty<>t.expected_cost
     OR (SELECT count(*) FROM assignment_post_schedule p WHERE p.assignment_deliverable_id=t.id)<>t.qty) THEN
   RAISE EXCEPTION 'Quantity or schedule count mismatch'; END IF;
 IF EXISTS(SELECT FROM before_posts b JOIN assignment_post_schedule p USING(id)
   WHERE to_jsonb(b)-ARRAY['revenue_before_vat','cost_before_vat','revenue_vat_amount','cost_vat_amount','billable_amount','remaining_amount','updated_at']
   IS DISTINCT FROM to_jsonb(p)-ARRAY['revenue_before_vat','cost_before_vat','revenue_vat_amount','cost_vat_amount','billable_amount','remaining_amount','updated_at']) THEN
   RAISE EXCEPTION 'Existing schedule identity or evidence changed'; END IF;
 IF EXISTS(SELECT FROM before_posts b JOIN LATERAL (
   SELECT sum(revenue_before_vat) r,sum(cost_before_vat) c,sum(revenue_vat_amount) rv,sum(cost_vat_amount) cv,
     sum(billable_amount) bill,sum(remaining_amount) rem
   FROM assignment_post_schedule p WHERE p.assignment_deliverable_id=b.assignment_deliverable_id
 ) s ON true WHERE ROW(b.revenue_before_vat,b.cost_before_vat,b.revenue_vat_amount,b.cost_vat_amount,b.billable_amount,b.remaining_amount)
 IS DISTINCT FROM ROW(s.r,s.c,s.rv,s.cv,s.bill,s.rem)) THEN
   RAISE EXCEPTION 'Schedule financial totals changed'; END IF;
END $$;
SELECT l.document_number,d.deliverable_type,d.quantity,d.unit_cost,d.total_cost,
 (SELECT count(*) FROM assignment_post_schedule p WHERE p.assignment_deliverable_id=d.id) AS post_count
FROM assignment_deliverables d JOIN quantity_targets t USING(id) JOIN campaign_lines l ON l.id=d.campaign_line_id
ORDER BY l.document_number,d.deliverable_type;
