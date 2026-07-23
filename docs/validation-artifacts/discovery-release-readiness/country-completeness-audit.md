# Country completeness audit — Discovery browse page 1

Measured: 2026-07-21T02:15:26.546Z

## Verdict

All 37 creators without flags were created by the offline Apify dataset export pipeline. That path marked enrichment_status=enriched while leaving country_code, country_codes, platform.audience_country, IPL audienceCountry, and DNA audience.country empty. Most raw snapshots are post-only (empty profileRows), so Instagram country was never present to normalize. Browse projection and CountryFlagsStack are working — there is simply no country data to show. The 13 creators with flags mostly came from Discovery Import Center / live Apify (enrichment_source=apify) or rare offline rows whose display-name/bio matched MENA-centric COUNTRY_OPTIONS aliases.

**Primary cause: import pipeline** (offline Apify dataset export). Not browse projection, UI, migration, or ViewModel.

## Summary

| Metric | Count |
|---|---:|
| Creators audited | 50 |
| Browse has countryFlagCodes | 13 |
| Browse empty | 37 |
| Recoverable but browse empty | 0 |
| No recoverable signal (current collectors) | 37 |
| Empty = offline Apify export | 37 |
| Empty with empty profileRows (post-only) | 26 |

### Empty-browse cause breakdown

- **import_pipeline**: 37

### Complete rows — country source

- **influencer.country_code**: 13

## Recommendation (smallest change)

Re-run Instagram profile-details enrichment for the 37 offline Apify dataset imports (existing backfillInstagramProfileRowsForImport / live enrichment path), then persist country via persistCountryFromApifyProfile → influencers.country_code/country_codes + platform.audience_country. No UI/browse/ViewModel changes.

Prevention: In apify-import-pipeline ensureCommercialCreatorFromApifyData: do not set enrichment_status='enriched' for Instagram post-only imports when audience_country is null and follower_count<=0; leave pending until shouldBackfillInstagramProfileDetails succeeds.

Why not country-backfill alone: country-backfill cannot invent ISO codes: 0/37 empty rows have recoverable country in DNA/IPL/platform/bio_inference under current geography index (COUNTRY_OPTIONS is MENA-heavy and omits PT etc.).

## Matrix

| Creator ID | Name | Country source | Current | Expected | Missing reason | Cause |
|---|---|---|---|---|---|---|
| `dab5e61e-e82b-4fa4-a587-a2ee580d6cd8` | ahmed_elbadawy | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `a76dbc9b-b654-404f-a402-18a0e7ea158e` | Instagram | influencer.country_code | EG,AE | EG,AE | none — browse has countryFlagCodes | complete |
| `422fa13c-53f6-4138-b599-973ea9fc7232` | itsfarahhosny | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `6b16b11d-5a5b-4e7d-acc4-b057efaec211` | ouda.5 | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `b1d178d3-f882-4ec7-b45d-888e85ab921e` | Karim Kabbany / كريم قباني | influencer.country_code | EG,FR | EG,FR | none — browse has countryFlagCodes | complete |
| `6043fa2d-e5ad-49c7-8d81-6af77f8ae2d3` | ayaibrahimx | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `52215772-78d1-4c17-9f13-4d3f47a0837e` | Yasser Ahmed - ياسر أحمد | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `b2369b60-063d-43ec-ab3a-76e01e592381` | amryosseff | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `79b74fa9-852b-429d-b9da-57c14ad7c37c` | adanys.table | influencer.country_code | EG | EG | none — browse has countryFlagCodes | complete |
| `9606033e-be8a-4601-9091-83e63e3f9ea4` | cairofoodiecouple | influencer.country_code | EG,IT | EG,IT | none — browse has countryFlagCodes | complete |
| `58c7ab5f-24aa-4cfc-b91f-fab8be5e5e8a` | raquelhadassaviagens_ | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `bf99b7ec-deb8-4bca-94a9-5b87758b51e7` | alhussinefatima | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `45b1f771-dfc7-4888-9aaa-cae35960dbec` | milleniumantiguidades | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `7a6d5b61-f351-4039-820f-7062ef4f6b33` | entrecuentaycuenta | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `8125abd9-a10c-4985-938a-33022595332d` | banda_fn13 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `2f8f0fd4-e41f-4f38-982b-b549d7d776da` | 206tours | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `f41bb9da-3fab-4b65-bc61-f41770873948` | gpcristobuenamuerteydefension | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `9579d968-a5b1-4305-8da5-d9f905a946f7` | alcorta.y.luna | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `1de35813-9c74-4905-9862-e1b2bcfbfa1b` | araujo_hobby | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `e14a2470-4c70-463b-a4be-f24fcdb8ed98` | lrgarcons | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `9c083179-5ddb-423a-91e3-24e9f27e85f1` | daniela_doamaral | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `dbf558f6-271c-49cf-b662-7d892690a2b6` | fatima_hairbraiding_1 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `98690eb9-d04d-4aa0-b7fc-51e349574b60` | mariacristina.maza.1 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `3c5107f3-7a20-4c2c-bf69-85d169cba57d` | fati_mameme | influencer.country_code | PK | PK | none — browse has countryFlagCodes | complete |
| `061ec44c-905e-4a28-b6e4-fb676e793894` | fatima.rajpoot019 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `5ff53585-b620-46f7-8ce8-b6914bcd854f` | irfan.tahir.7906 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `65925d83-9866-4fa0-aea6-dbfa4ac02163` | fatimanouman_ | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `1b66dd91-1709-4cad-824d-b0750ef8727c` | consolata_artigos_religiosos | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `7bc10729-d447-4bca-91d7-7223a3448a0a` | yellowcabtttours.pt | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `192a978d-9175-4dfd-8876-089984a50d24` | lux_fatimae | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `76c25841-6ae6-4e59-9052-031509a31579` | abeehafatima225 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `9aedd674-5cd3-468e-bdb3-191e29537e64` | rokeya.collective | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `7e75b0f2-2262-4a9f-8283-b093a1e5de85` | aviansummit | influencer.country_code | ES | ES | none — browse has countryFlagCodes | complete |
| `9a6f0164-6a2b-4eac-aac7-ba2e026ca57d` | handmadebymackenzie_ | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `19faa856-ccb6-4019-8a2f-1a207dabf869` | ohfranchini | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `d01908cf-557f-4d9b-a45c-1cf3d5c695ee` | fa_facollection | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `d524ec08-3e3d-48f1-b4e6-baa3217f7ef9` | luxmeasacra | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `4f8e9bd3-b917-4f47-b11b-fe7d00b13198` | rysaa_28 | none | — | — | offline Apify dataset export marked enriched without country; raw snapshot has empty profileRows (post-only); follower_count=0; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `31b02cd1-1095-4d80-8d87-5b6dcd72019c` | Andi Music and Art | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `a41bac20-2327-43f5-9724-4d69b844b97b` | Canada Needs Our Lady | influencer.country_code | CA | CA | none — browse has countryFlagCodes | complete |
| `f1d9187c-5398-40e0-a447-78e6ea847ae6` | Flavio Mesquita | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `5c453b84-9a09-4846-93d5-e0c17bf33517` | Fatima Yaakoub | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `6367e901-162d-45df-80f7-10047acba63b` | Paola Cassol / Arte em Papel | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `0025841f-c2fd-48b5-80a4-f532e2d339dd` | Alberto Trafalgar | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `a6085a4d-6d3e-4d6b-b60c-9edc4ceb5bf5` | MQ_SPORTS™ | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `79c36980-7306-49d3-83da-5f24067c7a0f` | Maria Alejandra Montenegro Silva | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `8b14564c-c4bd-4061-8fa9-95c22e8bde39` | Escola de Futsal do Fátima | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `e4eabb9b-69db-48b1-94df-f022134a77a6` | Celebrities Styles | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `7c4eddad-d906-4c66-947f-d2d1acde1c19` | Bryan Ramirez | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
| `5ce7439a-c9bd-468d-a238-31faee897bfe` | Azeite Fátima | none | — | — | offline Apify dataset export marked enriched without country; platform.audience_country=null; IPL audienceCountry=null; DNA audience.country empty | import_pipeline |
