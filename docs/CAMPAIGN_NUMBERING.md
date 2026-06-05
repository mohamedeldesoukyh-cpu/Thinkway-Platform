# Campaign document numbering

## Storage vs display

| Layer | Example |
|-------|---------|
| **DB (canonical)** | `TW-2026-0002` |
| **UI (display)** | `TW-2026-2` via `formatDocumentNumberForDisplay` |

Line suffixes: `TW-2026-0002-A` → display `TW-2026-2-A`.

## Sequence source (not MAX at insert)

Campaign headers get numbers from:

1. Trigger `assign_campaign_headers_document_number` (BEFORE INSERT)
2. Function `next_document_number('TW-' || YYYY, 4)`
3. Table `document_sequences` — row per year prefix, e.g. `TW-2026.last_value`

Each new header increments `last_value`. **Deleting a header does not decrement the counter** — gaps persist unless explicitly reseeded.

There is no app-level cached serial; no yearly counter table beyond `document_sequences`.

## Controlled reset: reseed after bootstrap purge

During rebuild only (TW-2026-2 / TW-2026-3 invalid artifacts):

```sql
SELECT * FROM public.reseed_thinkway_campaign_sequence(2026, true);  -- dry-run
SELECT * FROM public.reseed_thinkway_campaign_sequence(2026, false); -- apply
```

Or use `supabase/scripts/delete_bootstrap_campaigns_and_reseed.sql` (`v_execute := 1`).

Sets `document_sequences.last_value` = MAX surviving `TW-2026-NNNN` serial. Next create → MAX+1.

Example: only `TW-2026-0001` remains → `last_value = 1` → next campaign `TW-2026-0002` (display `TW-2026-2`).

## Production rule (post go-live)

**Do not reseed** for normal deletes. Gaps from deleted campaigns are permanent for audit integrity.
