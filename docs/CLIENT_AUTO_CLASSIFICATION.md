# Client Auto-Classification

**Module:** Client management · Legal entity overview  
**Entry points:** New client dialog, client overview tab

## Overview

Thinkway auto-suggests intelligence category/subcategory for legal entities using a priority pipeline. Suggestions are **never persisted until the user saves** the overview or creates the client.

## Priority pipeline

| Priority | Source | Confidence | When used |
|----------|--------|------------|-----------|
| 1 | `approved` | 100 | Existing client with `approved_by_user` set; reload without name change |
| 2 | `rule` | 95–100 | `COMPANY_HINTS` (global + regional) name match |
| 3 | `historical` | 90–100 | Similar name among other clients with approved classification |
| 4 | `ai_search` | 70–95 | OpenAI + web snippets (industry/products/services) |
| 5 | `fallback` | &lt;70 | Keyword ranking from name + snippets |

AI and web search are **skipped** when rule or historical match succeeds.

## Web search

Configured via environment (first available wins):

- `SERPER_API_KEY` — recommended
- `BRAVE_SEARCH_API_KEY`
- `TAVILY_API_KEY`

Snippets are merged into the AI prompt and fallback corpus. Classification uses industry/product signals, not name-only guessing.

## AI classification

- Model: `gpt-4o-mini`
- Requires: `OPENAI_API_KEY`
- Output validated against `client-category-taxonomy.ts` slugs
- Numeric confidence 70–95 returned from model

## Approval workflow (UI)

1. User enters legal entity name → debounced classification runs.
2. **Suggestion banner** shows category, subcategory, confidence %, source label.
3. User may **Accept** (apply suggestion), **Override/Change** (manual dropdown), or edit fields directly.
4. Low confidence (&lt;70): amber warning “Manual review recommended”.
5. On **Save overview** / **Create client**: persists slugs plus audit fields.

## Database fields (`clients`)

| Column | Type | Description |
|--------|------|-------------|
| `client_category` | text | Category slug |
| `client_subcategory` | text | Subcategory slug |
| `classification_source` | text | `approved`, `rule`, `historical`, `ai_search`, `fallback` |
| `classification_confidence` | numeric | 0–100 at save time |
| `classification_reason` | text | Rule name, matched client, AI reasoning |
| `classified_at` | timestamptz | Last classification write |
| `approved_by_user` | uuid | User who saved/approved |
| `last_verified_at` | timestamptz | Last explicit save with category |

Migration: `20260627010000_client_classification_audit.sql`

**Note:** Taxonomy uses slugs, not FK ids. See `docs/CLIENT_TAXONOMY_REVIEW.md`.

## Performance

- **Stored approved (P1):** No pipeline on reload when `useStoredApproved` and name unchanged.
- **Session cache:** Hook caches results by name+country+website key; no duplicate AI calls per session.
- **Early exit:** Rules/historical prevent AI invocation.

## Key files

| File | Role |
|------|------|
| `lib/clients/client-category-taxonomy.ts` | Taxonomy slugs |
| `lib/clients/classify-client-category.ts` | Priority pipeline |
| `lib/clients/classify-client-category-historical.ts` | P3 DB lookup |
| `lib/clients/classify-client-category-ai.ts` | OpenAI integration |
| `lib/clients/company-hints-global.ts` | Global rule hints |
| `features/clients/classify-category-action.ts` | Server action |
| `components/forms/use-client-category-classification.ts` | Client hook |
| `components/forms/client-category-suggestion.tsx` | Suggestion UI |

## Environment setup

```bash
OPENAI_API_KEY=sk-...        # AI classification (optional but recommended)
SERPER_API_KEY=...           # Web search (optional but recommended)
```

Without keys, classification falls back to rules and keyword ranking only.

## Fallback behavior

When no rule/historical/AI match applies, keyword scoring ranks taxonomy subcategories. Confidence stays below 70; UI flags manual review.
