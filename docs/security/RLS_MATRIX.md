# RLS Matrix — Thinkway Platform

**Release:** 1.0 Phase 0.1  
**Sources:** `supabase/policies.sql`, `supabase/migrations/*`, `supabase/storage.sql`  
**Policy count:** ~262 CREATE POLICY statements across migrations

---

## Summary

| Category | Tables | RLS enabled | FORCE RLS | Public access |
|----------|--------|:-----------:|:---------:|:-------------:|
| Core master data | 15+ | ✅ | Partial | ❌ |
| Campaign hierarchy | 8+ | ✅ | ✅ financial | ❌ |
| Billing/finance | 12+ | ✅ | ✅ | ❌ |
| IO documents | 4+ | ✅ | ✅ | ❌ (token RPC for external approve) |
| Discovery | 10+ | ✅ | Partial | ❌ |
| AI workspace | 2 | ✅ | ✅ | ❌ |
| Settings/IAM | 4+ | ✅ | ✅ | ❌ |
| Storage buckets | 5+ | ✅ (storage.objects) | — | ❌ |
| Intelligence (schema) | Separate | ✅ | — | ❌ |

**Legend:** ✅ = enforced · ⚠️ = gaps documented · ❌ = not applicable

---

## Workspace isolation helpers

| Function | Used in | Purpose |
|----------|---------|---------|
| `has_permission(text)` | All module RLS | Role-permission check |
| `is_admin()` | Privileged operations | super_admin/admin bypass |
| `is_internal_user()` | Internal-only writes | Excludes portal users |
| `can_access_client(uuid)` | clients, documents, invoices | Client workspace scope |
| `can_access_campaign_header(uuid)` | campaign_headers, lines, assignments | Campaign scope |
| `can_access_influencer(uuid)` | influencers, vendor_ios | Vendor scope |
| `get_user_role_slug()` | Conditional policies | Role-based branching |

---

## Tables with RLS policies (migration-derived)

### Groups & hierarchy
| Table | SELECT | INSERT | UPDATE | DELETE | Scoping |
|-------|:------:|:------:|:------:|:------:|---------|
| `groups` | ✅ | ✅ | ✅ | ⚠️ | group membership / admin |
| `brands` | ✅ | ✅ | ✅ | ⚠️ | via client access |
| `agencies` | ✅ | ✅ | ✅ | ⚠️ | admin |
| `campaign_headers` | ✅ | ✅ | ✅ | ⚠️ | `can_access_campaign_header` |
| `campaign_lines` | ✅ | ✅ | ✅ | ⚠️ | via header access |
| `clients` | ✅ | ✅ | ✅ | ⚠️ | `can_access_client` |

### Billing & finance
| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:------:|:------:|:------:|:------:|-------|
| `invoices` | ✅ | ✅ | ✅ | ⚠️ | FORCE RLS; finance hardening |
| `invoice_line_items` | ✅ | ✅ | ✅ | ⚠️ | FORCE RLS |
| `invoice_versions` | ✅ | ✅ | ⚠️ | ❌ | Version history |
| `payments` | ✅ | ✅ | ✅ | ⚠️ | Finance role |
| `financial_periods` | ✅ | ✅ | ✅ | ⚠️ | Period lock |
| `finance_override_logs` | ✅ | ✅ | ❌ | ❌ | Append-only |

### IO system
| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:------:|:------:|:------:|:------:|-------|
| `client_ios` | ✅ | ✅ | ✅ | ⚠️ | `client_ios.read/write` |
| `vendor_ios` | ✅ | ✅ | ✅ | ⚠️ | `vendor_ios.read/write` |
| `vendor_io_lines` | ✅ | ✅ | ✅ | ⚠️ | Via VIO parent |

### Discovery & creators
| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:------:|:------:|:------:|:------:|-------|
| `discovered_profiles` | ✅ | ✅ | ✅ | ⚠️ | discovery.read/write |
| `discovery_shortlists` | ✅ | ✅ | ✅ | ⚠️ | Owner + team visibility |
| `discovery_shortlist_items` | ✅ | ✅ | ✅ | ⚠️ | Via shortlist |
| `creator_import_files` | ✅ | ✅ | ❌ | ❌ | Immutable imports |
| `creator_dna` | ✅ | ✅ | ✅ | ⚠️ | Internal only |

### AI workspace
| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:------:|:------:|:------:|:------:|-------|
| `ai_conversations` | ✅ | ✅ | ✅ | ✅ | Owner-scoped |
| `ai_messages` | ✅ | ✅ | ⚠️ | ⚠️ | ai.read/write fix applied |

### Audit & settings
| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:------:|:------:|:------:|:------:|-------|
| `audit_logs` | ✅ | ✅ | ❌ | ❌ | Append-only |
| `access_logs` | ✅ | ✅ | ❌ | ❌ | Settings module |
| `user_invites` | ✅ | ✅ | ✅ | ⚠️ | settings.write |
| `profiles` | ✅ | ✅ | ✅ | ⚠️ | ESC-01 trigger on role_id |

### Reference / master data (md_*)
| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|:------:|:------:|:------:|:------:|
| `md_categories` | ✅ | ✅ | ✅ | ⚠️ |
| `md_countries` | ✅ | ✅ | ✅ | ⚠️ |
| `md_currencies` | ✅ | ✅ | ✅ | ⚠️ |
| `md_vat_rates` | ✅ | ✅ | ✅ | ⚠️ |
| `md_vr_rates` | ✅ | ✅ | ✅ | ⚠️ |
| (other md_*) | ✅ | ✅ | ✅ | ⚠️ |

---

## Storage RLS (`storage.objects`)

| Bucket | SELECT | INSERT | UPDATE | DELETE |
|--------|:------:|:------:|:------:|:------:|
| `client-documents` | ✅ scoped | ✅ scoped | ✅ scoped | ✅ scoped |
| `influencer-documents` | ✅ scoped | ✅ scoped | ✅ scoped | ✅ scoped |
| `creator-imports` | ✅ | ✅ | ❌ | ❌ |
| IO document buckets | ✅ via signed URLs | Service role | — | — |

Policies: `supabase/storage.sql`, `20260629020000_io_document_buckets_private.sql`

---

## Public / anonymous access

| Surface | Access | Mitigation |
|---------|--------|------------|
| `anon` role on business tables | ❌ Denied by default | RLS enabled + no policies for anon |
| IO external approval | Token RPC | Hashed token, single-use |
| `/api/build-info` | Public | Low sensitivity |
| Supabase realtime | Not enabled for sensitive tables | — |

---

## Known gaps (documented, not all fixed in Phase 0.1)

| ID | Gap | Severity | Status |
|----|-----|----------|--------|
| RLS-01 | Some `md_*` tables allow admin-only delete | P2 | Documented |
| RLS-02 | `business_function` not in RLS | P2 | Metadata only |
| RLS-03 | Legacy `campaigns` table vs `campaign_headers` dual model | P2 | Migration path exists |
| RLS-04 | Intelligence schema separate grants | P2 | Verified in migration |

---

## Verification

Run: `npx tsx scripts/validate-security-phase01.ts`  
Manual: `supabase/debug/invoice_line_items_rls_audit.sql`
