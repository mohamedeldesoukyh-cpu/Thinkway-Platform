# Application Security Audit

**Product:** Thinkway Platform  
**Date:** 24 Jul 2026  
**Type:** Static code review + `npm audit` (read-only; no application code modified)  
**Scope:** Input validation · XSS · Upload security · Rate limiting · Security headers · CSRF · SSRF · CSV injection · Prompt injection · Dependency vulnerabilities · Secret exposure  

**Related docs:** [`authentication-audit.md`](./authentication-audit.md), [`P0_FINANCE_FX_RLS_DEPLOYMENT.md`](./P0_FINANCE_FX_RLS_DEPLOYMENT.md), [`P1_AUTH_HARDENING_DEPLOYMENT.md`](./P1_AUTH_HARDENING_DEPLOYMENT.md), [`API_AUDIT.md`](./API_AUDIT.md), [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md), [`../infrastructure/SECRETS_CHECKLIST.md`](../infrastructure/SECRETS_CHECKLIST.md)

---

## 1. Executive Summary

Thinkway has solid authorization patterns in core domain Server Actions (campaigns, billing, finance posting) and recent auth hardening (invite hashing, `/api/ready` lockdown, `sanitizeNextPath`, MFA/AAL2). Application-layer defenses are uneven:

| Strength | Gap |
|----------|-----|
| Many finance/campaign actions use Zod | Almost all `app/api/**` routes lack Zod (1 of ~52 uses it) |
| Some storage size + filename sanitization | Empty MIME allowed; no magic-byte checks on entity uploads |
| Profile URL enrich uses strict host parse | Media proxies use substring host allowlists (SSRF) |
| Quote-escaping in CSV | No Excel formula neutralization (CWE-1236) |
| Secrets mostly env-driven / gitignored | No app rate limits; security headers not shipped in config |
| Studio Copilot puts user text in user role | Agent templates put `userMessage` inside **system** prompts |

**Highest combined severity chain:** unsanitized `terms_html` write → `dangerouslySetInnerHTML` on token-gated IO approval pages (stored XSS).

**Overall application security risk score (pre-P2):** **58 / 100** (higher = worse).

**Residual score after P2 Critical (24 Jul 2026):** **34 / 100**.

**Residual score after P3 Platform Hardening (24 Jul 2026):** **22 / 100**.

P3 closed: centralized rate limiting (429), security headers (CSP/HSTS/framing/COOP/CORP), CSV/Excel formula neutralization, Next → 16.2.11, Zod expansion (discovery/operations/finance posting), CSRF Origin checks + Supabase cookie Secure/SameSite hardening (HttpOnly remains false for browser client compatibility). Remaining: Redis rate limits, CSP nonces, `xlsx` replacement, full Zod coverage, HttpOnly session redesign.

---

## 2. Risk Score & Priority Matrix

| Severity | Count (approx.) | Themes |
|----------|-----------------|--------|
| **Critical** | 1 | Stored XSS via `terms_html` on IO approval |
| **High** | 8 | Missing API Zod · no rate limits · weak media-proxy SSRF · Next/xlsx advisories · prompt injection into system role · empty MIME uploads · CSP/HSTS absent · non-HttpOnly session cookies |
| **Medium** | 10+ | CSV injection · CSRF on GET exports · iframe `srcDoc` · Server Action schema gaps · service-role blast radius |
| **Low** | Several | Latent PDF fetch helper · env webhooks · health endpoint scraping |

### Priority roadmap

| Priority | Item | Area |
|----------|------|------|
| **P0** | Sanitize `terms_html` on write + render; stop raw HTML on approval pages | §3 XSS |
| **P0** | Upgrade `next` ≥ 16.2.11; isolate/replace `xlsx` parser | §11 Deps |
| **P1** | Zod on mutating APIs + privileged Server Actions | §2 Validation |
| **P1** | Rate limit auth, MFA, AI, PDF/export, media proxy, uploads | §5 Rate limiting |
| **P1** | Harden media-proxy host allowlists + private-IP deny | §8 SSRF |
| **P1** | Ship HSTS / framing / Referrer / Permissions-Policy; CSP report-only | §6 Headers |
| **P2** | CSV/Excel formula neutralization helper | §9 CSV |
| **P2** | Reject empty MIME + extension allowlist + magic bytes | §4 Uploads |
| **P2** | Move user/brief content out of system-role prompts | §10 Prompt injection |
| **P2** | `serverActions.allowedOrigins`; POST for side-effecting exports | §7 CSRF |

---

## 3. Input Validation

### 3.1 Inventory

| Surface | Approx. count | Zod / schema usage |
|---------|---------------|--------------------|
| `app/api/**/route.ts` | **52** | **1** uses Zod (`vendors/platform-accounts/enrich`) |
| `"use server"` modules | **~90** | **~30** use Zod/`safeParse`; majority use ad-hoc `String(formData.get(...))` |

### 3.2 Positive findings

- **API:** `app/api/vendors/platform-accounts/enrich/route.ts` — `bodySchema.safeParse` with UUID fields.
- **Report formats:** `lib/reports/document/report-document-response.ts` — allowlisted `html|pdf|xlsx|pptx`.
- **Media proxies:** host policy helpers (quality issues noted in §8, but not unbounded).
- **Client documents API:** delegates to `uploadClientDocumentSchema` (`lib/domains/clients/document-schemas.ts`).
- **Strong Server Action modules:** `features/campaigns/schemas.ts` + actions; `features/billing/*`; `features/clients|groups|brands|vendors/actions.ts`; finance posting / FX / invoice lifecycle; `features/operations/actions.ts`; `features/discovery-import/actions.ts`; `features/auth/actions.ts` (`signInSchema`).

### 3.3 API routes missing schema validation

Almost all handlers use `as` casts, manual `searchParams.get`, or unvalidated path params.

#### Critical / High — JSON body mutation

| Path | Inputs | Recommended Zod |
|------|--------|-----------------|
| `app/api/ai/chat/route.ts` | `message`, `conversationId?`, `intent?`, `workspace?`, `studioFocus?` | `z.object({ message: z.string().trim().min(1).max(20000), conversationId: z.string().uuid().optional(), rerunUserMessageId: z.string().uuid().optional(), intent: z.enum([...]).optional(), workspace: workspaceSchema.optional(), studioFocus: z.object({ sectionId: z.string().max(128).optional(), elementIndex: z.number().int().nonnegative().optional(), elementKind: z.string().max(64).optional() }).optional() })` |
| `app/api/ai/conversations/route.ts` | `title?`, `workspace?` | `z.object({ title: z.string().trim().max(200).optional(), workspace: workspaceSchema.optional() })` |
| `app/api/ai/conversations/[id]/route.ts` | path `id`; `title?`, `isPinned?`, `archived?` | UUID param + body with at least one field required |
| `app/api/ai/conversations/[id]/messages/[messageId]/route.ts` | path IDs; `content?`, `truncateAfter?` | UUID params + `content: z.string().max(50000).optional()` |
| `app/api/ai/campaign-objects/[id]/lifecycle/route.ts` | `lifecycleStatus` | Enum of lifecycle statuses + UUID |
| `app/api/ai/campaign-objects/[id]/promote-scenario/route.ts` | `conversationId`, `scenario`, `reason?` | UUID + nested scenario schema + `reason.max(2000)` |
| `app/api/discovery/acquisition/session/route.ts` | `action?`, `searchSessionId?` | `z.enum(['heartbeat','cancel'])` + UUID |
| `app/api/discovery/compare/document/route.ts` | `unifiedIds?` | `z.array(z.string().uuid()).min(2).max(20)` |
| `app/api/campaigns/influencers/route.ts` (POST) | `{ id? }` | `z.object({ id: z.string().uuid() })` |

#### Medium — query / searchParams

| Path | Recommend |
|------|-----------|
| `app/api/discovery/search/route.ts` | Coerced page/pageSize caps, platform enums, string max lengths |
| `app/api/campaigns/influencers/route.ts` (GET) | Same |
| `app/api/operations/campaigns/route.ts` | Movement enum + optional UUIDs + page coerce |
| Export/document routes (`quotations`, `shortlists`, `invoices`, `*-ios`, `reports/*/document`, AI exports) | Format/template enums; UUID `conversationId` / `items` |
| `app/api/creators/avatar/route.ts`, `publication-preview/route.ts` | URL fields then existing allowlist |
| `app/api/discovery/jobs/route.ts` | `limit: z.coerce.number().int().min(1).max(25)` |
| `app/api/reports/daily/drilldown/route.ts` | Explicit filter schema (do not pass raw searchParams map) |
| `app/api/clients/[clientId]/documents/route.ts` | Path UUID + `file instanceof File` at route boundary |

#### Lower — path-only IDs

Validate `id` / `clientId` / `version` as UUID (or known enum) on: AI versions routes, `operations/vendors/[id]/assignments`, `discovery/jobs/[id]`, `campaigns/[id]/publications-bundle`, etc.

Health/version/build-info and public ready stub need no body schemas.

### 3.4 Server Actions missing schema validation (priority)

| Path | Inputs | Recommended schema |
|------|--------|--------------------|
| `features/io/actions.ts` — `updateVendorIoAction` / client IO | FormData including **`terms_html`**, amounts, status | UUIDs + status enums + length caps; sanitize HTML separately |
| `features/settings/actions.ts` — `inviteUserAction` | email, role_id, portal fields | `z.string().email()`, UUID role, portal/access enums |
| `features/finance/adjustments/actions.ts` — credit notes | invoice_id, amounts, reason | UUID + `z.coerce.number().positive()` + date + reason max |
| `features/auth/mfa-actions.ts` | `factor_id`, `code`, `next` | `code: z.string().regex(/^\d{6}$/)`; path via `sanitizeNextPath` |
| `features/portals/actions.ts` | deliverable/PO uploads + `external_link` | UUID + `z.string().url()` https-only + file constraints |
| `features/quotations/actions.ts` | commercial mutations | Per-action money/UUID/status schemas |
| `features/discovery/shortlists/{actions,bulk-actions,commercial-actions}.ts` | IDs, status, commercial | UUID arrays + enums + money |
| `features/discovery/actions.ts`, add-by-URL, edit-platform-url, control-center | URLs / settings | Platform URL + settings object schemas |
| `features/planning/actions.ts` | budget/forecast | Numeric coerce + UUID + status |
| `features/client-access/actions.ts` | assignments | UUID + role enum |
| `features/campaign-studio/actions/*`, `ai-workspace/actions/*` | draft/approval ops | UUID + enum payloads |
| `features/campaign-intelligence-profile/actions/profile-actions.ts` | brief file + IDs | UUID fields + file size/type (partially manual today) |

**Guidance:** Adopt a single pattern — `schema.safeParse(Object.fromEntries(formData))` or typed JSON — and reject with stable field errors. Prefer shared schemas under `features/*/schemas.ts`.

---

## 4. XSS

### 4.1 `dangerouslySetInnerHTML` inventory

| File | Source | Sanitization | Risk |
|------|--------|--------------|------|
| `app/io-approval/client/page.tsx` | DB `context.terms_html` | **None** | **Critical** — stored XSS on token approval UI |
| `app/io-approval/vendor/page.tsx` | DB `context.terms_html` | **None** | **Critical** — same |
| `features/io/components/client-io-email-view-dialog.tsx` | `buildClientIoEmailHtml` | Dynamic fields escaped via `escapeHtml` in `lib/email/client-io-email.ts` | Low |
| `features/campaign-outputs/components/media-plan-preview-sections.tsx` | Static platform SVG helper | Platform key normalized | Low |
| `lib/theme/theme-head-script.tsx` | Constant theme IIFE | Static | None |

No `html-react-parser`, `marked`, `sanitize-html`, `DOMPurify`, or `rehype-raw` in app code.

### 4.2 Other HTML rendering paths

| Location | Mechanism | Risk |
|----------|-----------|------|
| `app/(dashboard)/ios/vendor/[id]/preview/page.tsx` | `iframe srcDoc` from vendor IO HTML | Medium–High if user HTML embedded |
| `app/(dashboard)/ios/client/[id]/preview/page.tsx` | `srcDoc` | Low–Medium (template escaping) |
| `app/(dashboard)/billing/invoices/[id]/preview/page.tsx` | `srcDoc` | Low–Medium |
| Campaign performance / quotation / shortlist preview pages | `iframe` / `srcDoc` | Low–Medium |
| `features/campaign-outputs/components/media-plan-document-preview.tsx` | `srcDoc` + sandbox **with** `allow-scripts` | Medium — isolated from parent but executable |
| `features/documents/document-preview-dialog.tsx` | iframe for PDF/image URLs | Low |

### 4.3 Rich-text / HTML input

- Vendor IO form: raw HTML textarea `terms_html` (`features/io/components/vendor-io-form.tsx`).
- Persisted without sanitization (`features/io/actions.ts`).
- Rendered on **external token-gated** approval pages → classic stored XSS (staff writer → recipient victim).

Markdown helpers under campaign-outputs produce Markdown strings for chat/export, not React HTML injection (lower XSS risk).

### 4.4 Recommendations

1. Sanitize `terms_html` on write and render (DOMPurify / `sanitize-html` allowlist).
2. Prefer structured terms / plain text on approval UIs; avoid raw HTML for untrusted viewers.
3. Tighten `srcDoc` sandbox (`allow-scripts` only if required); escape all user fields before HTML assembly.

---

## 5. Upload Security

### 5.1 Entry points

| Path | Target |
|------|--------|
| `lib/supabase/storage.ts` — `uploadEntityDocument` | Entity document buckets |
| `lib/supabase/storage.ts` — `uploadCreatorImportFile` | `creator-imports` |
| `app/api/clients/[clientId]/documents/route.ts` | Client documents |
| `features/{clients,groups,vendors,portals}/actions.ts` | Entity / portal uploads |
| `features/discovery-import/actions.ts` | Creator imports |
| `features/campaign-intelligence-profile/actions/profile-actions.ts` | Campaign briefs |
| `lib/discovery-import/import-avatar-storage.ts` | Avatars (server buffers) |
| `lib/performance/screenshot-capture/storage.ts` | Publication media |
| `features/campaigns/actions/performance-actions.ts` — metrics import | In-memory XLSX/CSV parse (not Storage) |

### 5.2 Control matrix

| Control | Entity docs | Creator import | Brief upload |
|---------|-------------|----------------|--------------|
| Size limit | **50 MB** | **50 MB** | **25 MB** |
| MIME allowlist | Partial — **empty MIME skips check** (`if (params.file.type && !ALLOWED...)`) | Partial — empty MIME allowed; includes `application/octet-stream` | Extension **or** MIME |
| Extension allowlist | **No** | **Yes** (`.pdf/.xlsx/.csv/.zip`) | Yes (via `isSupportedBriefFile`) |
| Filename sanitization | Yes (`[a-zA-Z0-9._-]`) | Yes | Partial (`[^\w.-]+` → `_`) |
| Magic-byte sniffing | **No** | **No** | **No** |
| Path UUID prefix | Yes | Yes | Yes |

Also: `next.config.ts` sets `serverActions.bodySizeLimit` / proxy body to **50mb** (size only, not content validation). Portal `external_link` lacks URL schema validation.

### 5.3 Recommendations

1. Require non-empty MIME **and** matching extension allowlist for entity uploads.
2. Add magic-byte verification for PDF/images before storage.
3. Cap metrics-import file size before parse; prefer ExcelJS-only or sandboxed parse (see §11 `xlsx`).
4. Validate portal `external_link` as `https` URL only.
5. Keep dual MIME+ext checks on briefs; Zod-validate related IDs.

---

## 6. Rate Limiting

### 6.1 Verdict

**No application-level rate limiting is implemented.**  
`express-rate-limit` appears only as a transitive lockfile dependency and is unused by Thinkway app code. `getClientIp` (`lib/auth/api-auth.ts`) is used for audit metadata, not throttling. `vercel.json` sets `maxDuration`/memory only.

### 6.2 Surfaces without rate limiting

**All ~52 `app/api/**` routes** and **all Server Actions**, including:

| Category | Examples | Why critical |
|----------|----------|--------------|
| Auth | `signInAction`, MFA verify, `/auth/callback` | Stuffing / TOTP brute force |
| Public token | IO approval Server Actions on `/io-approval/*` | Spam approve/reject |
| AI | `/api/ai/chat`, conversations, campaign-objects | Cost / DoS |
| PDF / export | invoices, IOs, quotations, shortlists, reports, AI export | CPU/memory |
| Media proxy | `/api/creators/avatar`, `publication-preview` | Outbound fetch amplification |
| Enrichment / discovery | enrich, search, jobs, add-by-URL | Apify/OG cost |
| Uploads | client documents API, discovery-import | Storage/parse abuse |
| Cron | publication-metrics, campaign-performance-monitor | Secret-only; no throttle if leaked |
| Invites | `inviteUserAction` | Provisioning spam |

### 6.3 Recommended limits

Per **user id** if authenticated, else **IP** (Redis/Upstash preferred on Vercel):

| Surface | Limit |
|---------|-------|
| Login | 5 / min / IP+email; backoff after 20 / hour |
| MFA verify | 5 / min / user; 20 / hour |
| Invite create | 10 / hour / admin |
| Auth callback | 30 / min / IP |
| IO approval token actions | 10 / min / IP; 30 / hour / token |
| PDF / Chromium exports | 5 / min / user; 20 / hour |
| Other document exports | 15 / min / user |
| AI chat | 10 / min / user; ~100 / day (tune by plan) |
| Media proxies | 60 / min / user; bound concurrent outbound |
| Enrichment / add-by-URL | 10 / min / user; 60 / hour |
| Creator import uploads | 10 / hour / user; max concurrent 2 |
| Client document uploads | 20 / hour / user |
| Cron | Secret auth + single-flight / fail-closed if secret missing in prod |
| Public health/ready/version | 120 / min / IP (edge) |
| Default authenticated API | 120 / min / user |

---

## 7. Security Headers

### 7.1 Config surfaces

| File | Security headers? |
|------|-------------------|
| `next.config.ts` | **None** (analyzer, externals, body size) |
| `vercel.json` | **None** (functions + crons) |
| `proxy.ts` / `lib/supabase/middleware.ts` | Session cookies only |
| App `headers()` export | **Not found** |

Recommended values exist in `docs/DEPLOYMENT_GUIDE.md` §6 but are **not applied** in repo config. Production may inherit weak Vercel defaults only.

### 7.2 Header audit

| Header | In repo? | Recommended value | Gap |
|--------|----------|-------------------|-----|
| **Content-Security-Policy** | Absent | Phased Report-Only → enforce (Next + Supabase + CDN) | **High** |
| **Strict-Transport-Security** | Absent | `max-age=63072000; includeSubDomains; preload` | **High** |
| **Referrer-Policy** | Absent | `strict-origin-when-cross-origin` | Medium |
| **X-Frame-Options** | Absent | `DENY` | Medium |
| **CSP `frame-ancestors`** | Absent | `'none'` | Medium |
| **Permissions-Policy** | Absent | `camera=(), microphone=(), geolocation=()` | Low–Medium |
| **X-Content-Type-Options** | Absent | `nosniff` | Medium |

### 7.3 Recommendation

Add via `vercel.json` and/or `next.config.ts` `headers()`. Start CSP in Report-Only until Next/Supabase/inline theme script allowlists are stable. Framing + HSTS can ship immediately.

---

## 8. CSRF

### 8.1 Current model

| Control | Status |
|---------|--------|
| Session cookies (`@supabase/ssr`) | `sameSite: "lax"`; **`httpOnly: false`** (library default) |
| Custom CSRF tokens | **None** |
| `experimental.serverActions.allowedOrigins` | **Not set** |
| App-level Origin/Referer checks on API | **None** |
| Authorization inside actions | Present (authz ≠ CSRF) |

Protection relies on browser SameSite=Lax + Next.js Server Action protocol, not defense-in-depth tokens.

### 8.2 Risks

| Risk | Severity | Detail |
|------|----------|--------|
| XSS → session theft | High (if XSS) | Non-HttpOnly cookies + missing CSP amplify XSS |
| Authenticated GET session riding | Medium | Many exports are **GET** with cookies; Lax sends cookies on top-level cross-site navigations |
| Cross-site POST to Server Actions | Lower | Mostly mitigated by Lax + Next action binding |
| Public IO approval token POSTs | Medium | Token entropy + rate limit matter more than CSRF |
| Login stuffing | Medium | Unthrottled `signInAction` |

### 8.3 Recommendations

1. Prefer HttpOnly cookie strategy compatible with `@supabase/ssr` (or server-only session).
2. Set `serverActions.allowedOrigins` to production hosts.
3. Convert side-effecting/expensive exports from GET → POST (or require custom anti-CSRF header).
4. Ship CSP; rate-limit auth + IO-approval (§6).

---

## 9. SSRF

### 9.1 Findings

| ID | Location | User control | Allowlist | Severity |
|----|----------|--------------|-----------|----------|
| **SSRF-01** | `app/api/creators/avatar/route.ts`, `publication-preview/route.ts` → `lib/creators/*-proxy.ts` | Query `src` / `profileUrl` / `postUrl` | `host.includes(fragment)` — lookalike hosts possible; redirects followed; OG image path weaker on preview | **High** |
| **SSRF-02** | Enrich / add-creator-by-URL | Profile URL | Strong parse + canonicalize (`lib/social/parse-profile-url.ts`) | Low–Medium (cost/DoS) |
| **SSRF-03** | `lib/email/client-io-email.ts` — `buildClientIoPdfAttachment(pdfUrl)` | Latent `fetch(pdfUrl)` | None | Low (no current callers) |
| **SSRF-04** | Campaign performance alert webhooks | Env URL | None | Low (ops-controlled) |
| **SSRF-05** | Audit/screenshot probes on stored URLs | DB fields | Weak/none | Medium if fields attacker-influenced |
| **SSRF-06** | Auth callback / Gmail OAuth | Path / fixed Google endpoints | N/A | Low |

### 9.2 SSRF-01 detail

- Substring matching accepts hosts like `notinstagram.com` or `evil-cdninstagram.attacker.tld` when fragment is `instagram.com` / `cdninstagram`.
- `fetchImageBuffer` uses `redirect: "follow"`.
- Publication preview OpenGraph image fetch is less strictly re-checked than avatar path.
- Background `after()` refresh amplifies cost.

**Mitigations:** exact hostname / suffix allowlists; block link-local/metadata/private ranges; `redirect: "manual"`; allowlist **final** URL before fetch; rate-limit (§6).

---

## 10. CSV Injection

### 10.1 Verdict

**Vulnerable (Medium).** Exporters escape quotes for CSV delimiters but do **not** neutralize Excel formula triggers (`=`, `+`, `-`, `@`, tab, CR). No shared `sanitizeCsvCell` / formula-guard utility found.

Quote-wrapping alone does **not** stop formula execution when users open CSV in Excel.

### 10.2 At-risk exporters

| Path | User-controlled fields |
|------|------------------------|
| `features/discovery/shortlists/export/shortlist-csv.ts` | creator, handle, notes, interests |
| `app/api/shortlists/[id]/export/route.ts` | via shortlist CSV builder |
| `lib/creators/campaign-shortlist.ts` (`shortlistToCsv`) | display_name, notes, niche |
| `features/campaigns/creator-discovery-actions.ts` | shortlist export action |
| `features/finance/vat/export.ts`, `features/finance/aging/export.ts` | client_name, invoice fields |
| `lib/reports/document/spending-by-category-document.ts` | category / entity labels |
| `features/quotations/components/quotation-workspace.tsx` | creator_name, handle, description |
| Campaign performance / publications tabs (client CSV) | influencer_name, URL, notes |
| `features/discovery/components/creator-search/creator-search-utils.ts` | display_name, categories, URLs |
| `lib/creators/creator-display-utils.ts` | same pattern |

### 10.3 Excel (xlsx)

`lib/reports/document/excel-report-builder.ts` assigns plain string cell values (ExcelJS). Risk lower than CSV, but leading `=` can still be formula-like in some clients. Prefer the same neutralization for text cells.

### 10.4 Remediation

Central helper: if value matches `/^[=+\-@\t\r]/`, prefix with `'` (or equivalent). Apply to all CSV exporters and optionally Excel text cells.

---

## 11. Prompt Injection

### 11.1 LLM surfaces

OpenAI-centric: `features/ai/**`, `features/ai-workflows/**`, Campaign Studio Copilot, CIP brief extraction (`extract-profile-llm.ts`), client category AI, campaign-fit rerank, discovery-worker enrichment, `features/ai-workspace` streaming provider.

### 11.2 Trust-boundary issues

| Pattern | Location | Risk |
|---------|----------|------|
| `User request: {{userMessage}}` inside agent **system** templates | `features/ai/prompts/templates.ts` | **High** — instruction override |
| Raw `String(value)` interpolation | `features/ai/shared/prompt-interpolator.ts` | No delimiters / length caps / escape |
| Rendered template as `role: "system"` | `features/ai/agents/base-agent.ts` | Amplifies template issue |
| Workflows interpolate `${ctx.userMessage}` into prompts | `features/ai-workflows/definitions/*` | High |
| Brief/bio/web snippets in user payloads | CIP, rerank, classify | Medium (indirect injection) |
| Studio Copilot: fixed system; user + digest in user role | `studio-copilot.ts` | Better; tools still abusable if model coerced |

### 11.3 Partial mitigations

Stub mode without `OPENAI_API_KEY`; Zod on some JSON outputs; brief length caps; tool-auth helpers (`features/ai/tools/tool-auth.ts`); grounding rules in section authoring.

### 11.4 Recommendations

1. Never put `userMessage` / brief text in the system role; use labeled untrusted data blocks in the user role.
2. Re-check all tool args against server-side permissions (never trust the model).
3. Treat uploaded briefs / scraped bios as untrusted documents; refuse instruction-following on document content.
4. Prefer structured tools + allowlisted mutations only.

---

## 12. Dependency Vulnerabilities

### 12.1 `npm audit` (24 Jul 2026)

**Root app:** 9 findings — **4 high**, **5 moderate**, **0 critical**

| Package | Severity | Notes | Action |
|---------|----------|-------|--------|
| **next** `16.2.6` | High | Middleware/proxy bypass, Server Action DoS, related GHSAs (`>=16.0.0 <16.2.11`) | Upgrade to **≥ 16.2.11** |
| **xlsx** `0.18.5` | High | Prototype pollution + ReDoS; community package has no clean fix path | Replace with ExcelJS parse, SheetJS Pro, or sandbox |
| **postcss** (via next) | High / moderate | XSS stringify + sourceMappingURL file read | Follows Next upgrade |
| **sharp** (nested via next) | High | libvips CVEs for `<0.35.0` | Top-level `sharp@0.35.3` OK; nested copy until Next upgrade |
| **uuid** (via exceljs) | Moderate | Buffer bounds | Bump exceljs/uuid when available |
| **@hono/node-server** (via shadcn / MCP SDK) | Moderate | Windows path traversal in static serve | Dev/CLI surface |

**Discovery worker:** 2 findings — 1 high (`form-data` CRLF), 1 low (`esbuild` dev server).

### 12.2 Re-run

```bash
npm audit
npm audit --json
cd services/discovery-worker && npm audit --json
```

CI recommendation: fail on high/critical; track `xlsx` as explicit accepted risk until replaced.

---

## 13. Secret Exposure

### 13.1 Positive findings

- No live API keys / service-role JWTs hardcoded in application source.
- `.gitignore` ignores `.env*` with `!.env.example`.
- `.env.example` documents secrets with empty placeholders (`OPENAI_API_KEY`, `CRON_SECRET`, `READY_API_SECRET`, `INVITE_TOKEN_SECRET`, etc.).
- No `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE`, `NEXT_PUBLIC_OPENAI_*`, or `NEXT_PUBLIC_CRON_*`.
- Scripts generally avoid logging secret values (`maskSecret` used in places).

### 13.2 Expected public env

`NEXT_PUBLIC_SUPABASE_URL`, anon/publishable key, `NEXT_PUBLIC_APP_URL`, feature flags — appropriate for client.

### 13.3 Residual risks

| Item | Risk |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` used in Next server (`lib/supabase/admin.ts`, cron, ready detail, discovery-import cleanup, enrichment) | High blast radius if server compromised; keep out of client bundles/logs |
| Invite raw token in `/login?invite=…` URL | Browser history / Referer leakage |
| MFA TOTP secret returned to enroll UI | Expected for QR; must not be logged |
| Docs drift: older `SECURITY_AUDIT.md` understated service-role in app runtime | Prefer code + `SECRETS_CHECKLIST.md` |

---

## 14. Cross-Cutting Themes

1. **AuthZ ≠ input hygiene** — Many routes are permission-gated but accept untyped bodies; authenticated abuse remains.
2. **Stored HTML is the sharpest XSS edge** — IO terms HTML + approval rendering.
3. **Egress controls uneven** — Profile enrich is careful; media proxies are not.
4. **Cost/DoS controls missing** — AI, PDF, proxies, imports unlimited at app layer.
5. **Export safety incomplete** — CSV quote-escape without formula guards.
6. **AI trust boundaries collapse** — User text in system prompts + tool-calling agents.
7. **Dependency debt concentrated** — Next patch level + SheetJS community `xlsx`.

---

## 15. Recommended Zod Schema Catalog (starter)

Centralize under feature `schemas.ts` files; reuse across API + actions.

```ts
// Shared primitives
export const uuidSchema = z.string().uuid();
export const pageSchema = z.coerce.number().int().min(1).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);
export const httpsUrlSchema = z.string().url().refine((u) => u.startsWith("https://"));

// Auth / MFA
export const mfaVerifySchema = z.object({
  factor_id: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
  next: z.string().optional(),
});

// Invites
export const inviteUserSchema = z.object({
  full_name: z.string().trim().max(200).optional(),
  email: z.string().email(),
  role_id: uuidSchema,
  portal_type: z.enum(["internal", "client", "creator" /* align to product */]),
  access_role: z.enum(["view", "approve"]).optional(),
  client_id: uuidSchema.optional(),
  country_code: z.string().length(2).optional(),
  business_function: z.enum(["ops", "sales"]).nullable().optional(),
  department: z.string().max(200).optional(),
});

// AI chat
export const aiChatBodySchema = z.object({
  message: z.string().trim().min(1).max(20_000),
  conversationId: uuidSchema.optional(),
  rerunUserMessageId: uuidSchema.optional(),
  intent: z.string().max(64).optional(),
  workspace: z.record(z.unknown()).optional(), // replace with concrete workspaceSchema
  studioFocus: z
    .object({
      sectionId: z.string().max(128).optional(),
      elementIndex: z.number().int().nonnegative().optional(),
      elementKind: z.string().max(64).optional(),
    })
    .optional(),
});

// Vendor IO (HTML sanitized separately)
export const updateVendorIoSchema = z.object({
  id: uuidSchema,
  campaign_header_id: uuidSchema,
  terms_text: z.string().max(50_000).optional(),
  terms_html: z.string().max(100_000).optional(),
  usage_rights: z.string().max(2_000).optional(),
  exclusivity: z.string().max(2_000).optional(),
  attachment_url: z.union([httpsUrlSchema, z.literal("")]).nullable().optional(),
  status: z.string().min(1), // replace with VendorIoStatus enum
  amount: z.coerce.number().nonnegative().optional(),
});

// Document export query
export const documentExportQuerySchema = z.object({
  format: z.enum(["html", "pdf", "xlsx", "pptx", "csv"]),
  download: z.enum(["0", "1"]).optional(),
  template: z.string().max(64).optional(),
});
```

---

## 16. Verification Checklist (post-remediation)

- [ ] IO approval pages render sanitized HTML only; XSS payload in `terms_html` does not execute
- [ ] Mutating AI/discovery APIs reject invalid UUIDs / oversized messages with 400
- [ ] Entity upload with empty MIME or `.exe` renamed is rejected
- [ ] Anonymous `/api/ready` remains `{ "status": "ok" }` only
- [ ] Media proxy rejects lookalike hosts and private IPs
- [ ] CSV cell `=cmd|' /C calc'!A0` exports as `'=cmd|...` (or equivalent)
- [ ] Security headers present on production responses
- [ ] Login / MFA / AI / PDF endpoints return 429 under burst
- [ ] `npm audit` high count is zero or explicitly waived (`xlsx`)
- [ ] Agent prompts: user content never in `role: "system"`

---

## 17. Out of Scope / Related Work

- AuthN/AuthZ deep dive: see [`authentication-audit.md`](./authentication-audit.md) (P0 finance RLS, P1 invite/MFA/ready/callback).
- RLS matrix / permission matrix: [`RLS_MATRIX.md`](./RLS_MATRIX.md), [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md).
- This audit did **not** modify code, run dynamic penetration tests, or exploit live environments.

---

*End of application security audit.*
