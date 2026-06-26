# Discovery Creator Audit

**Audit date:** 2026-06-25  
**Database:** Production Supabase (`hsxrewjcbvmbkqdlzjhs`)  
**Method:** Live query via `scripts/audit-discovery-creators.ts` (service role)

---

## Executive summary

**Status: cleanup complete (2026-06-25)**

```
REAL CREATORS:        25
FAKE/DEMO CREATORS:    0  (was 67)
UNKNOWN:               1
─────────────────────────
TOTAL AUDITED:        26  (was 93)
```

| After cleanup | Count |
|---------------|------:|
| `influencers` (vendors) | 25 |
| `discovered_profiles` | 1 |
| **Unified creator total** | **26** |

**Migration applied:** `supabase/migrations/20260625180000_audit_remove_demo_creators.sql`  
Deleted **67** `discovered_profiles` rows. **Zero** `influencers` deleted.

---

## Cleanup verification (2026-06-25)

Migration applied via `npx supabase db push --include-all`.

| Metric | Before | Deleted | After |
|--------|-------:|--------:|------:|
| Total audited creators | 93 | 67 | **26** |
| `imported_real` (influencers) | 25 | 0 | **25** |
| `demo_data` (mock_seed profiles) | 67 | 67 | **0** |
| `unknown` (discovered_profiles) | 1 | 0 | **1** |

Post-cleanup re-audit (`scripts/audit-discovery-creators.ts`):

```
REAL CREATORS:        25
FAKE/DEMO CREATORS:    0
UNKNOWN:               1
─────────────────────────
TOTAL AUDITED:        26
```

- `discovered_profiles` count: **1** (`thinkway_test_creator` — preserved)
- `influencers` count: **25** (unchanged)
- `toDeleteCount`: **0**

**Note:** Initial migration SQL had invalid `GET DIAGNOSTICS` arithmetic; fixed before apply (use intermediate `v_rows_deleted` variable).

---

## Demo creator prevention (Phase 2)

Mock-seed fallback is gated by `isDemoDataEnabled()` (`lib/discovery/demo-data.ts`, mirrored in discovery-worker):

- **Enabled only when:** `NODE_ENV === 'test'` OR `ENABLE_DEMO_DATA === 'true'`
- **Disabled in:** `development` and `production` (default)
- **On crawl failure (no demo):** job marked `failed`, error logged — no fake profiles inserted
- **Defense in depth:** `seedMockProfiles()` throws if called when demo data disabled

Regression tests: `npm run test:discovery-demo-data`, `npm run test:discovery-mock-seed-policy`

---

## Schema mapping

Thinkway discovery spans two creator stores unified in `lib/creators/unified-browse.ts`:

| Report field | `influencers` (internal vendors) | `discovered_profiles` (public discovery) |
|--------------|----------------------------------|----------------------------------------|
| **id** | `influencers.id` | `discovered_profiles.id` |
| **username** | `influencer_platform_accounts.username` or `.handle` | `discovered_profiles.username` |
| **full_name** | `influencers.display_name` | `discovered_profiles.display_name` |
| **source** | `creator_sources.source_name` or `"internal"` | `discovered_profiles.metadata->>'source'` or `"public_discovery"` |
| **created_at** | `influencers.created_at` | `discovered_profiles.created_at` |
| **imported_from** | `creator_sources.source_file_id` → `creator_import_files.id` | — |
| **discovery_source** | — | `discovery_sources.method` (aggregated) |
| **follower_count** | `influencer_platform_accounts.follower_count` | latest `profile_metrics.followers` |

**Note:** `influencers` has no `source`, `imported_from`, or `discovery_source` columns. Provenance lives in `creator_sources` (imports) or is inferred as `internal`.

### Related tables

- `influencer_platform_accounts` — social handles per vendor (`ON DELETE CASCADE` from `influencers`)
- `creator_sources` — import provenance (`ON DELETE CASCADE` from `influencers`)
- `creator_import_files` — uploaded import files registry
- `discovery_sources` — how a discovered profile was found (`ON DELETE CASCADE` from `discovered_profiles`)
- `profile_metrics` — follower snapshots for discovered profiles (`ON DELETE CASCADE`)

---

## Detection criteria

### High-confidence demo (`demo_data`) — **DELETE**

All 67 flagged profiles match **both**:

1. `discovered_profiles.metadata->>'source' = 'mock_seed'`
2. Username pattern `tw_{category}_{country}_{nn}` from `services/discovery-worker/src/discovery/mock-seed.ts`

Inserted 2026-06-10 when discovery jobs used the **mock seed fallback** (`crawl_empty` / `crawl_failed`). Bios contain `collabs: {username}@creator.mail` (filtered by `passesProductionCreatorGate` in `lib/creators/production-filter.ts`).

### Real creators (`imported_real`) — **KEEP**

| Sub-type | Count | Criteria |
|----------|------:|----------|
| Import file | 20 | `creator_sources.source_file_id` set (file `b4f368fa-476e-47e3-b561-39a57d06fcb2`, imported 2026-06-25) |
| Internal vendor | 5 | Manual `influencers` with platform accounts, no import provenance |

No `influencers` match seed.sql demo names (Maya Styles, Alex Chen) — those inserts are **commented out** in `supabase/seed.sql`.

### Unknown — **KEEP (manual review)**

| id | username | full_name | notes |
|----|----------|-----------|-------|
| `7d1e9b83-6b91-4f51-8434-7a09115149cd` | `thinkway_test_creator` | Thinkway Test Creator | Created 2026-06-09; no `mock_seed` metadata; likely manual UI test — **not deleted** |

### Not present in database

- `seed_data` (commented seed.sql influencers never applied)
- `test_data` (no rows with `source='test'` or obvious test handles beyond the unknown above)

---

## Influencers (25 real — all kept)

| id | username | full_name | source | created_at | imported_from | follower_count |
|----|----------|-----------|--------|------------|---------------|---------------:|
| aba06e84-3c9a-462c-b20c-5989d4b841b9 | razanejammal | razanejammal | import | 2026-06-25T10:08:17Z | b4f368fa-…fcb2 | 1,100,000 |
| a3c2b711-29f8-441a-b980-67dfb5109d00 | zeinazee_1 | zeinazee_1 | import | 2026-06-25T10:08:18Z | b4f368fa-…fcb2 | 3,000,000 |
| 6c3ed5d0-c6af-4a3a-8d2e-d69346f370f7 | monaelshazly.official | monaelshazly.official | import | 2026-06-25T10:08:18Z | b4f368fa-…fcb2 | 5,000,000 |
| 0ab91e3c-a785-413a-a040-f16d80e18986 | shimaasaber | Shimaa Saber | internal | 2026-05-31T17:17:08Z | — | 1,919,601 |
| 5fdd130e-52d6-41fe-8efd-7b3646b3beca | jumana.mourad | jumana.mourad | import | 2026-06-25T10:08:19Z | b4f368fa-…fcb2 | 15,100,000 |
| 4e174db7-45e1-40d9-99a7-9bdcd72649de | yorokfreestyle | Yousef Ayman | internal | 2026-06-05T13:36:43Z | — | 316,000 |
| c5e5ff5e-29cb-4a2e-a2e1-b1b4f7a2efa5 | sera_yusuf | sera_yusuf | import | 2026-06-25T10:08:19Z | b4f368fa-…fcb2 | 1,600,000 |
| 04628c90-859c-4286-a5e3-f7c05d108746 | amiryoussef.official | Amir Youssef | internal | 2026-06-01T05:28:34Z | — | 2,000,000 |
| 6bafdbdd-c4f8-4756-93d8-a4502044b1c3 | arwakassem129 | arwakassem129 | import | 2026-06-25T10:08:20Z | b4f368fa-…fcb2 | 3,200,000 |
| 4709a1e3-f5e2-45cf-9a2d-4c279c180cc7 | maghraaby | Hussien Elmaghraby | internal | 2026-06-05T13:29:05Z | — | 999,999 |
| 9555e9bb-42af-4f06-af81-4a1dc3647494 | mashhoursalma | Salma Mashhou | internal | 2026-06-05T14:03:07Z | — | 264,369 |
| 1cbe5c10-0a4f-4eeb-a663-6642cba23ba0 | wafasyedofficial | wafasyedofficial | import | 2026-06-25T10:08:14Z | b4f368fa-…fcb2 | 1,200,000 |
| 7efbfaeb-6a47-42ea-ab2b-112038ac8743 | monicamedhat__ | monicamedhat__ | import | 2026-06-25T10:08:14Z | b4f368fa-…fcb2 | 1,100,000 |
| 3a1a17a5-8bfe-426f-a995-aec454ee661f | halasamirofficial | halasamirofficial | import | 2026-06-25T10:08:15Z | b4f368fa-…fcb2 | 4,500,000 |
| 7ddbd903-b1c3-4e5a-bdb3-3fc5c79724e3 | _tamany_officiall | _tamany_officiall | import | 2026-06-25T10:08:15Z | b4f368fa-…fcb2 | 1,200,000 |
| cccec4a0-7bac-4ce7-8f64-3248fd87388c | rooh_hassann | rooh_hassann | import | 2026-06-25T10:08:16Z | b4f368fa-…fcb2 | 2,000,000 |
| 61c68eff-2c53-4784-a2d1-fed2890c79e3 | ali.iannacone | ali.iannacone | import | 2026-06-25T10:08:16Z | b4f368fa-…fcb2 | 1,300,000 |
| 762be32b-273a-4095-9ab0-6b562ca236b7 | sola_omar15 | sola_omar15 | import | 2026-06-25T10:08:17Z | b4f368fa-…fcb2 | 1,600,000 |
| 9afe9888-49c3-43d4-997f-8b413d12c5a9 | ittsfarahh | ittsfarahh | import | 2026-06-25T10:08:20Z | b4f368fa-…fcb2 | 864,800 |
| ed267358-e19a-4a5e-b4ca-3c38dd411b7e | dr_daliaabdelghany | dr_daliaabdelghany | import | 2026-06-25T10:08:21Z | b4f368fa-…fcb2 | 2,100,000 |
| 07ae60a4-0b08-4257-818e-66ef9647329f | fatema_abdelkareem | fatema_abdelkareem | import | 2026-06-25T10:08:21Z | b4f368fa-…fcb2 | 1,100,000 |
| 9f889ebd-e30a-427a-bea0-83254d75bfdc | tasnim_zeitoun | tasnim_zeitoun | import | 2026-06-25T10:08:22Z | b4f368fa-…fcb2 | 1,200,000 |
| 5c183652-2908-4fd2-9c50-36a261271bfc | hindmedhattfaroukk | hindmedhattfaroukk | import | 2026-06-25T10:08:22Z | b4f368fa-…fcb2 | 1,200,000 |
| ff982456-dfd9-46e3-8c16-67dec20f305d | salmaelgabry17 | salmaelgabry17 | import | 2026-06-25T10:08:23Z | b4f368fa-…fcb2 | 1,100,000 |
| 2249d75a-cf38-4ea5-b4b4-38aab4c8b6b6 | iman_alabagouri | iman_alabagouri | import | 2026-06-25T10:08:23Z | b4f368fa-…fcb2 | 1,200,000 |

---

## Discovered profiles — unknown (1 kept)

| id | username | full_name | source | created_at | discovery_source | follower_count |
|----|----------|-----------|--------|------------|------------------|---------------:|
| 7d1e9b83-6b91-4f51-8434-7a09115149cd | thinkway_test_creator | Thinkway Test Creator | public_discovery | 2026-06-09T23:30:33Z | — | — |

---

## Discovered profiles — demo/mock_seed (67 to delete)

| id | username | full_name | source | created_at | discovery_source | followers |
|----|----------|-----------|--------|------------|------------------|----------:|
| b7a789d4-87b4-47c1-816a-848329afa63f | tw_beauty_ae_01 | Layla Beauty | mock_seed | 2026-06-10T00:04:51Z | hashtag | 12,500 |
| 6102efa9-5594-4e04-a278-88a9e178a631 | tw_beauty_sa_02 | Omar Beauty | mock_seed | 2026-06-10T00:04:52Z | hashtag | 48,000 |
| 0c1e1afa-4399-4dcf-ae7b-f27e12ace5e7 | tw_beauty_eg_03 | Sara Beauty | mock_seed | 2026-06-10T00:04:53Z | hashtag | 125,000 |
| f79667b3-4169-469a-b67a-dc8fe7eeb6de | tw_beauty_us_04 | Noor Beauty | mock_seed | 2026-06-10T00:04:53Z | hashtag | 310,000 |
| 2f2058bc-5198-403d-aeba-58e715aee761 | tw_beauty_gb_05 | Yasmin Beauty | mock_seed | 2026-06-10T00:04:54Z | hashtag | 890,000 |
| 058b3c2f-f2e8-4ab1-8504-d2693a86b30d | tw_beauty_ae_06 | Khalid Beauty | mock_seed | 2026-06-10T00:04:54Z | hashtag | 1,450,000 |
| e1489523-82a1-4e53-9a8a-71cbed0a5c8b | tw_beauty_sa_07 | Maya Beauty | mock_seed | 2026-06-10T00:04:55Z | hashtag | 12,500 |
| 79a190ac-bcd6-4ed7-82c3-f25f18f6f58d | tw_beauty_eg_08 | Adam Beauty | mock_seed | 2026-06-10T00:04:55Z | hashtag | 48,000 |
| a9f4c534-0c5d-4b80-b083-1e3d8d2dbaa4 | tw_fashion_us_09 | Hana Fashion | mock_seed | 2026-06-10T00:04:56Z | hashtag,trend | 125,000 |
| 8569f71b-52bb-444b-a201-876a0ad785a8 | tw_tech_gb_10 | Zain Tech | mock_seed | 2026-06-10T00:04:56Z | hashtag | 310,000 |
| 2e1a92da-2b81-4e08-866d-49da2e0187bd | tw_food_ae_11 | Aisha Food | mock_seed | 2026-06-10T00:04:57Z | hashtag,location | 890,000 |
| 16aaa505-f8fc-461e-a179-46eb50d74aae | tw_travel_sa_12 | Rami Travel | mock_seed | 2026-06-10T00:04:57Z | hashtag | 1,450,000 |
| 83d9d53c-b0c2-4196-b0cd-88763d72d0c9 | tw_gaming_eg_13 | Lina Gaming | mock_seed | 2026-06-10T00:04:58Z | hashtag,location,trend | 12,500 |
| 6156ec81-fe7a-4239-8fef-0b240fd63456 | tw_lifestyle_us_14 | Tariq Lifestyle | mock_seed | 2026-06-10T00:04:58Z | hashtag,location | 48,000 |
| 171d5e8f-e07b-4000-84a7-fe4d61b79508 | tw_fitness_gb_15 | Nadia Fitness | mock_seed | 2026-06-10T00:04:58Z | hashtag,location | 125,000 |
| 9ce88e1c-8ab3-4f9d-a3c4-e5cd152144d6 | tw_luxury_ae_16 | Layla Luxury | mock_seed | 2026-06-10T00:04:59Z | hashtag,location | 310,000 |
| d5153d5d-2e57-4468-ab93-14ff7bf5bdf0 | tw_parenting_sa_17 | Omar Parenting | mock_seed | 2026-06-10T00:04:59Z | hashtag,location,trend | 890,000 |
| 90f961c0-210d-431d-8048-7ba99e22bd08 | tw_beauty_eg_18 | Sara Beauty | mock_seed | 2026-06-10T00:05:00Z | hashtag,location | 1,450,000 |
| b0a2816d-4cd5-44d7-998e-7218b1176e23 | tw_fashion_us_19 | Noor Fashion | mock_seed | 2026-06-10T00:05:00Z | hashtag,location | 12,500 |
| 93e5cb2c-2075-4370-85cd-9413a83be875 | tw_tech_gb_20 | Yasmin Tech | mock_seed | 2026-06-10T00:05:01Z | hashtag,location | 48,000 |
| d839a0b5-a963-4c19-898c-537d26c605fd | tw_food_ae_21 | Khalid Food | mock_seed | 2026-06-10T00:05:01Z | hashtag,location,trend | 125,000 |
| a3851cd9-5bc3-4e9a-82d8-301bfe28a004 | tw_travel_sa_22 | Maya Travel | mock_seed | 2026-06-10T00:05:02Z | hashtag,location | 310,000 |
| 0c4b0b4d-1ccf-4c39-8a4b-429f5b128e39 | tw_gaming_eg_23 | Adam Gaming | mock_seed | 2026-06-10T00:05:02Z | hashtag,location | 890,000 |
| 4228209a-9c08-4007-a205-5a80068c742c | tw_lifestyle_us_24 | Hana Lifestyle | mock_seed | 2026-06-10T00:05:03Z | hashtag,location | 1,450,000 |
| 93e0e59d-f160-4da0-b6ea-b3f2b4062161 | tw_fitness_gb_25 | Zain Fitness | mock_seed | 2026-06-10T00:05:03Z | hashtag,location,trend | 12,500 |
| d2306d3d-f476-4427-aded-20ed1f04a74c | tw_luxury_ae_26 | Aisha Luxury | mock_seed | 2026-06-10T00:05:04Z | hashtag,location | 48,000 |
| 9773e913-2714-4d99-b700-e3c1793a3faa | tw_parenting_sa_27 | Rami Parenting | mock_seed | 2026-06-10T00:05:04Z | hashtag,location | 125,000 |
| 5a76afd2-cbde-4d16-8577-b585286e4bd5 | tw_beauty_eg_28 | Lina Beauty | mock_seed | 2026-06-10T00:05:05Z | hashtag,location | 310,000 |
| f1c34e43-49b1-410b-89bb-2a1751fcd623 | tw_fashion_us_29 | Tariq Fashion | mock_seed | 2026-06-10T00:05:05Z | hashtag,location,trend | 890,000 |
| 5958e06d-6c9a-427e-87c5-46c4ec8f1a7e | tw_tech_gb_30 | Nadia Tech | mock_seed | 2026-06-10T00:05:06Z | hashtag,location | 1,450,000 |
| 55c64a9f-6407-4739-9a4c-08cede5449fa | tw_food_ae_31 | Layla Food | mock_seed | 2026-06-10T00:05:06Z | hashtag,location | 12,500 |
| 098f4d8f-9ea2-443d-8638-7c6b5a6ea4d4 | tw_travel_sa_32 | Omar Travel | mock_seed | 2026-06-10T00:05:06Z | hashtag,location | 48,000 |
| e7d971cb-24c7-424d-bf73-647dc1eec7fe | tw_gaming_eg_33 | Sara Gaming | mock_seed | 2026-06-10T00:05:22Z | location | 125,000 |
| 3d8af266-be31-490d-bdc7-992c2dc09bce | tw_food_ae_01 | Layla Food | mock_seed | 2026-06-10T00:05:08Z | location,trend | 12,500 |
| 9f20bd66-d6a2-4bd1-9a7a-ef3805211b7b | tw_travel_ae_02 | Omar Travel | mock_seed | 2026-06-10T00:05:08Z | location | 48,000 |
| 026c9f37-09d7-4506-8fe5-5ab010b5eff1 | tw_gaming_ae_03 | Sara Gaming | mock_seed | 2026-06-10T00:05:08Z | location | 125,000 |
| 865a7177-bb9c-4af0-9a84-b81a6fd650da | tw_lifestyle_ae_04 | Noor Lifestyle | mock_seed | 2026-06-10T00:05:09Z | location | 310,000 |
| 999cda36-67ee-46e5-a4f1-e523f88ea7b6 | tw_fitness_ae_05 | Yasmin Fitness | mock_seed | 2026-06-10T00:05:09Z | location | 890,000 |
| e9e454c5-78a4-47ad-9859-f4b5edef2b88 | tw_luxury_ae_06 | Khalid Luxury | mock_seed | 2026-06-10T00:05:10Z | location | 1,450,000 |
| 9233bf1f-09db-4c03-bc98-5ece6ad417fb | tw_parenting_ae_07 | Maya Parenting | mock_seed | 2026-06-10T00:05:10Z | location | 12,500 |
| 89f4dac3-ea04-48cf-80dc-ee6e6ef46ce4 | tw_beauty_ae_08 | Adam Beauty | mock_seed | 2026-06-10T00:05:11Z | location | 48,000 |
| 3dcdcc85-7c7c-41c1-9898-5c038d1e5d93 | tw_fashion_ae_09 | Hana Fashion | mock_seed | 2026-06-10T00:05:11Z | location | 125,000 |
| 5eeb67c8-525e-4151-bd9c-ddf4b1b00b1c | tw_tech_ae_10 | Zain Tech | mock_seed | 2026-06-10T00:05:12Z | location | 310,000 |
| a2855db3-6075-4884-bef1-6434c844d33d | tw_travel_ae_12 | Rami Travel | mock_seed | 2026-06-10T00:05:13Z | location | 1,450,000 |
| d142ff61-de0d-4c58-b418-4e266e2d574f | tw_travel_sa_02 | Omar Travel | mock_seed | 2026-06-10T00:27:19Z | trend | 48,000 |
| 5b985e26-2ab8-48bc-b4b0-02a59121a978 | tw_gaming_eg_03 | Sara Gaming | mock_seed | 2026-06-10T00:27:19Z | trend | 125,000 |
| d7ef0e86-b278-421e-af71-12b629493e69 | tw_lifestyle_us_04 | Noor Lifestyle | mock_seed | 2026-06-10T00:27:20Z | trend | 310,000 |
| 95a02b68-8c36-4454-9881-cea98d2aede9 | tw_fitness_gb_05 | Yasmin Fitness | mock_seed | 2026-06-10T00:27:20Z | trend | 890,000 |
| 2fda202c-d223-400f-9040-845b2ad0af2c | tw_luxury_ae_06 | Khalid Luxury | mock_seed | 2026-06-10T00:27:21Z | trend | 1,450,000 |
| b83a1f33-1c75-4696-a570-d77121659baa | tw_parenting_sa_07 | Maya Parenting | mock_seed | 2026-06-10T00:27:21Z | trend | 12,500 |
| d0680be8-7bb0-4406-a818-6069d10b1ed7 | tw_beauty_eg_08 | Adam Beauty | mock_seed | 2026-06-10T00:27:22Z | trend | 48,000 |
| 4bd6e5c0-e451-4d8f-8b35-3962b4d68bc1 | tw_food_ae_11 | Aisha Food | mock_seed | 2026-06-10T00:27:23Z | trend | 890,000 |
| 4fd73405-4b09-4c88-836f-4528f3ea244a | tw_tech_gb_10 | Zain Tech | mock_seed | 2026-06-10T00:27:23Z | trend | 310,000 |
| f222dfaf-9a46-4709-912a-f5e320dec681 | tw_lifestyle_us_14 | Tariq Lifestyle | mock_seed | 2026-06-10T00:27:24Z | trend | 48,000 |
| 0ac79f26-385d-4fa2-bb0c-93de3952fa57 | tw_fitness_gb_15 | Nadia Fitness | mock_seed | 2026-06-10T00:27:25Z | trend | 125,000 |
| 2d49e7fd-bccc-45b1-af79-f303c7278dba | tw_luxury_ae_16 | Layla Luxury | mock_seed | 2026-06-10T00:27:25Z | trend | 310,000 |
| 8c220fa9-4062-413e-be80-284da09f4203 | tw_beauty_eg_18 | Sara Beauty | mock_seed | 2026-06-10T00:27:26Z | trend | 1,450,000 |
| 9120e1e8-be56-4f31-8a75-53112fa8d503 | tw_fashion_us_19 | Noor Fashion | mock_seed | 2026-06-10T00:27:27Z | trend | 12,500 |
| d0dec535-8012-40ee-98d4-6a89b4da31e8 | tw_tech_gb_20 | Yasmin Tech | mock_seed | 2026-06-10T00:27:27Z | trend | 48,000 |
| 7b239e99-8042-4854-857b-39a54b6fad3c | tw_travel_sa_22 | Maya Travel | mock_seed | 2026-06-10T00:27:28Z | trend | 310,000 |
| bbbdfbc3-db42-4c9e-9497-b4dc244ec0d6 | tw_gaming_eg_23 | Adam Gaming | mock_seed | 2026-06-10T00:27:29Z | trend | 890,000 |
| 90dba1cc-1f37-45ab-9856-5e6fcfb3555e | tw_lifestyle_us_24 | Hana Lifestyle | mock_seed | 2026-06-10T00:27:29Z | trend | 1,450,000 |
| bb228448-5926-4ed7-baaa-a05b5181ee0a | tw_luxury_ae_26 | Aisha Luxury | mock_seed | 2026-06-10T00:27:30Z | trend | 48,000 |
| f1310459-f973-4095-952c-50180f5710aa | tw_parenting_sa_27 | Rami Parenting | mock_seed | 2026-06-10T00:27:30Z | trend | 125,000 |
| c90e345d-1380-4a90-9e65-ff0dad8edb20 | tw_beauty_eg_28 | Lina Beauty | mock_seed | 2026-06-10T00:27:31Z | trend | 310,000 |
| b855888d-e763-4fed-868e-3c0298718f74 | tw_tech_gb_30 | Nadia Tech | mock_seed | 2026-06-10T00:27:32Z | trend | 1,450,000 |
| 7ef4ffb6-5a03-47f3-a175-99b70a1e375a | tw_travel_sa_12 | Rami Travel | mock_seed | 2026-06-10T00:27:23Z | trend | 1,450,000 |

*Note: Some usernames appear twice with different IDs (duplicate mock-seed runs on 2026-06-10 ~00:05 and ~00:27). All 67 rows are distinct UUIDs.*

---

## Seed / fixture sources reviewed

| Source | Creators inserted? |
|--------|-------------------|
| `supabase/seed.sql` | No — influencer block is commented out |
| SQL migrations | No `INSERT INTO influencers` found |
| `lifecycle_final_validation_seed.sql` | References existing influencer only |
| `services/discovery-worker/src/discovery/mock-seed.ts` | Yes — all 67 demo profiles |
| `lib/discovery-import/parsers/*.test.ts` | Parser fixtures only (not DB) |

---

## Safety rules applied

| Rule | Status |
|------|--------|
| Only high-confidence demo/seed/test | ✅ All deletes require `metadata.source = 'mock_seed'` |
| Explicit ID list in report + migration | ✅ 67 UUIDs documented |
| Never delete `creator_import_files` linked creators | ✅ No influencer deletes; imports untouched |
| Never delete `creator_sources` provenance | ✅ |
| When uncertain → UNKNOWN, not delete | ✅ `thinkway_test_creator` preserved |
| Do not delete promoted profiles | ✅ Migration requires `influencer_id IS NULL` |

---

## Re-run audit

```bash
# Windows: may need system CA for Node TLS
$env:NODE_OPTIONS="--use-system-ca"
npx tsx scripts/audit-discovery-creators.ts
```

Output: `.tmp/discovery-creator-audit.json`

---

## Apply cleanup (manual)

**Completed 2026-06-25** via `npx supabase db push --include-all`. For other environments:

```bash
# Via Supabase CLI (linked project)
npx supabase db push   # or apply migration SQL in dashboard SQL editor
```

Pre-flight check:

```sql
SELECT count(*) FROM discovered_profiles
WHERE influencer_id IS NULL AND metadata->>'source' = 'mock_seed';
-- Expected: 67
```

Post-flight:

```sql
SELECT count(*) FROM discovered_profiles;  -- Expected: 1
SELECT count(*) FROM influencers;         -- Expected: 25
```

---

## Recommendations

1. ~~**Disable mock seed in production**~~ — **Done (2026-06-25):** gated by `isDemoDataEnabled()`; dev/prod require `ENABLE_DEMO_DATA=true` for mock profiles.
2. **Review `thinkway_test_creator`** — delete manually if confirmed test artifact.
3. **Re-run discovery jobs** after cleanup so real crawls populate `discovered_profiles` without mock fallback noise.
