# Bootstrap Validation Report

**Generated:** 2026-07-25T05:44:22.522Z
**Database:** (url redacted)
**Result:** PASSED
**Steps applied:** 180

## Execution order

1. Platform stubs (if auth/storage missing)
2. `supabase/schema.sql`
3. `supabase/seed.sql`
4. `supabase/policies.sql`
5. `supabase/storage.sql`
6. All `supabase/migrations/*.sql` (lexicographic)

## Step log

| Status | Step | File |
|--------|------|------|
| skipped | stubs | `supabase/bootstrap/supabase_platform_stubs.sql` |
| ok | schema | `supabase/schema.sql` |
| ok | seed | `supabase/seed.sql` |
| ok | policies | `supabase/policies.sql` |
| ok | storage | `supabase/storage.sql` |
| ok | migration | `supabase/migrations/20260531120000_enterprise_master_data.sql` |
| ok | migration | `supabase/migrations/20260531140000_enterprise_hierarchy.sql` |
| ok | migration | `supabase/migrations/20260531150000_group_workspace.sql` |
| ok | migration | `supabase/migrations/20260531160000_billing_finance_engine.sql` |
| ok | migration | `supabase/migrations/20260531170000_hierarchy_validation.sql` |
| ok | migration | `supabase/migrations/20260531180000_operations_finance_governance.sql` |
| ok | migration | `supabase/migrations/20260531190000_campaign_line_assignment_status.sql` |
| ok | migration | `supabase/migrations/20260531200000_vendor_operational_governance.sql` |
| ok | migration | `supabase/migrations/20260531210000_vat_tax_engine.sql` |
| ok | migration | `supabase/migrations/20260531220000_creator_profile_enrichment.sql` |
| ok | migration | `supabase/migrations/20260531230000_platform_metrics_tracking.sql` |
| ok | migration | `supabase/migrations/20260531240000_po_fx_governance_engine.sql` |
| ok | migration | `supabase/migrations/20260531250000_normalize_audit_action_writes.sql` |
| ok | migration | `supabase/migrations/20260531260000_campaign_influencers_line_unique.sql` |
| ok | migration | `supabase/migrations/20260531270000_assignment_commercial_engine.sql` |
| ok | migration | `supabase/migrations/20260531280000_deliverable_level_billing.sql` |
| ok | migration | `supabase/migrations/20260531290000_campaign_lines_sort_order.sql` |
| ok | migration | `supabase/migrations/20260531300000_assignment_deliverables_vat_exempt.sql` |
| ok | migration | `supabase/migrations/20260531310000_post_schedule_operational.sql` |
| ok | migration | `supabase/migrations/20260531400000_campaign_publications.sql` |
| ok | migration | `supabase/migrations/20260531500000_post_level_billing.sql` |
| ok | migration | `supabase/migrations/20260531610000_billing_invoice_line_items_rls.sql` |
| ok | migration | `supabase/migrations/20260531620000_billing_invoice_rls_hardening.sql` |
| ok | migration | `supabase/migrations/20260531630000_sync_post_invoice_backfill.sql` |
| ok | migration | `supabase/migrations/20260531700000_financial_planning_engine.sql` |
| ok | migration | `supabase/migrations/20260531800000_collections_treasury_engine.sql` |
| ok | migration | `supabase/migrations/20260603001000_thinkway_io_system.sql` |
| ok | migration | `supabase/migrations/20260603020000_settings_user_management.sql` |
| ok | migration | `supabase/migrations/20260603030000_creator_client_portals.sql` |
| ok | migration | `supabase/migrations/20260604010000_client_access_and_portal_refinements.sql` |
| ok | migration | `supabase/migrations/20260604020000_client_users_select_rls.sql` |
| ok | migration | `supabase/migrations/20260605010000_vendor_io_invoice_lifecycle.sql` |
| ok | migration | `supabase/migrations/20260605020000_assignment_multi_currency_cost.sql` |
| ok | migration | `supabase/migrations/20260606010000_phase2_vio_revision_operational_status.sql` |
| ok | migration | `supabase/migrations/20260607010000_backfill_operational_status.sql` |
| ok | migration | `supabase/migrations/20260608010000_campaign_line_status_invariants.sql` |
| ok | migration | `supabase/migrations/20260608020000_operational_entity_integrity.sql` |
| ok | migration | `supabase/migrations/20260609000000_disable_operational_bootstrap.sql` |
| ok | migration | `supabase/migrations/20260609010000_campaign_document_sequence_reseed.sql` |
| ok | migration | `supabase/migrations/20260609020000_fix_reseed_prefix_ambiguity.sql` |
| ok | migration | `supabase/migrations/20260610010000_finance_control_architecture.sql` |
| ok | migration | `supabase/migrations/20260611010000_invoice_sequence_integrity.sql` |
| ok | migration | `supabase/migrations/20260611015000_discovery_engine.sql` |
| ok | migration | `supabase/migrations/20260612010000_invoice_sequence_repair.sql` |
| ok | migration | `supabase/migrations/20260612015000_creator_discovery_integration.sql` |
| ok | migration | `supabase/migrations/20260612020000_invoice_sequence_full_repair.sql` |
| ok | migration | `supabase/migrations/20260612030000_invoice_sequence_void_slot_repair.sql` |
| ok | migration | `supabase/migrations/20260613010000_invoice_line_uniqueness_and_repair.sql` |
| ok | migration | `supabase/migrations/20260614010000_vendor_io_document_generation.sql` |
| ok | migration | `supabase/migrations/20260615010000_vendor_bank_letter_document.sql` |
| ok | migration | `supabase/migrations/20260616010000_vendor_io_special_payment_terms.sql` |
| ok | migration | `supabase/migrations/20260617010000_assignment_ur_af_billing.sql` |
| ok | migration | `supabase/migrations/20260617020000_assignment_ur_cost.sql` |
| ok | migration | `supabase/migrations/20260618010000_client_io_document_generation.sql` |
| ok | migration | `supabase/migrations/20260618120000_campaign_publications_influencer_fk.sql` |
| ok | migration | `supabase/migrations/20260619010000_client_io_terms.sql` |
| ok | migration | `supabase/migrations/20260620010000_client_io_email_send.sql` |
| ok | migration | `supabase/migrations/20260620020000_client_io_cancelled_status.sql` |
| ok | migration | `supabase/migrations/20260621010000_profile_business_function.sql` |
| ok | migration | `supabase/migrations/20260622010000_po_consumption_billable_base.sql` |
| ok | migration | `supabase/migrations/20260622130000_campaign_performance_center.sql` |
| ok | migration | `supabase/migrations/20260623010000_intelligence_warehouse.sql` |
| ok | migration | `supabase/migrations/20260623020000_intelligence_schema_grants_fix.sql` |
| ok | migration | `supabase/migrations/20260623120000_campaign_publications_full_schema_reconcile.sql` |
| ok | migration | `supabase/migrations/20260623130000_campaign_publications_grants.sql` |
| ok | migration | `supabase/migrations/20260623180000_engagement_rate_method.sql` |
| ok | migration | `supabase/migrations/20260624010000_intelligence_workspace_stats.sql` |
| ok | migration | `supabase/migrations/20260624020000_intelligence_margin_median_rpc.sql` |
| ok | migration | `supabase/migrations/20260624030000_intelligence_top_influencers_rpc.sql` |
| ok | migration | `supabase/migrations/20260624040000_intelligence_margin_alerts_rpc.sql` |
| ok | migration | `supabase/migrations/20260624120000_campaign_metrics_collection.sql` |
| ok | migration | `supabase/migrations/20260624130000_production_metrics_collection.sql` |
| ok | migration | `supabase/migrations/20260624140000_er_recalculation_audit.sql` |
| ok | migration | `supabase/migrations/20260625010000_client_name_ar.sql` |
| ok | migration | `supabase/migrations/20260625020000_client_category_taxonomy.sql` |
| ok | migration | `supabase/migrations/20260625030000_client_vr_rate.sql` |
| ok | migration | `supabase/migrations/20260625120000_campaign_publication_screenshots.sql` |
| ok | migration | `supabase/migrations/20260625140000_discovery_import_center.sql` |
| ok | migration | `supabase/migrations/20260625150000_discovery_import_processing.sql` |
| ok | migration | `supabase/migrations/20260625160000_fix_discovery_import_permissions.sql` |
| ok | migration | `supabase/migrations/20260625170000_discovery_import_diagnostics.sql` |
| ok | migration | `supabase/migrations/20260625180000_audit_remove_demo_creators.sql` |
| ok | migration | `supabase/migrations/20260625190000_protect_creator_import_files.sql` |
| ok | migration | `supabase/migrations/20260626010000_client_credit_limit_controls.sql` |
| ok | migration | `supabase/migrations/20260626020000_client_vr_rate_fkey.sql` |
| ok | migration | `supabase/migrations/20260627010000_client_classification_audit.sql` |
| ok | migration | `supabase/migrations/20260628010000_client_classification_review.sql` |
| ok | migration | `supabase/migrations/20260628020000_client_classification_cache.sql` |
| ok | migration | `supabase/migrations/20260629010000_profile_role_escalation_guard.sql` |
| ok | migration | `supabase/migrations/20260629020000_io_document_buckets_private.sql` |
| ok | migration | `supabase/migrations/20260630010000_creator_avatar_sync.sql` |
| ok | migration | `supabase/migrations/20260630100000_creator_import_avatars_storage.sql` |
| ok | migration | `supabase/migrations/20260630120000_creator_import_chunk_json_mime.sql` |
| ok | migration | `supabase/migrations/20260630130000_reach_forecasting.sql` |
| ok | migration | `supabase/migrations/20260630140000_publication_content_fields.sql` |
| ok | migration | `supabase/migrations/20260630150000_impressions_forecasting.sql` |
| ok | migration | `supabase/migrations/20260630160000_creator_import_paused_status.sql` |
| ok | migration | `supabase/migrations/20260630170000_discovery_search_modernization.sql` |
| ok | migration | `supabase/migrations/20260701010000_backfill_platform_account_profile_url.sql` |
| ok | migration | `supabase/migrations/20260702010000_discovery_shortlists_v2.sql` |
| ok | migration | `supabase/migrations/20260702020000_discovery_shortlists_v2_review.sql` |
| ok | migration | `supabase/migrations/20260702100000_ai_workspace_conversations.sql` |
| ok | migration | `supabase/migrations/20260702110000_fix_ai_workspace_rls.sql` |
| ok | migration | `supabase/migrations/20260702120000_fix_ai_messages_insert_rls.sql` |
| ok | migration | `supabase/migrations/20260703010000_quotations_commercial.sql` |
| ok | migration | `supabase/migrations/20260703150000_intelligence_persistence_layer.sql` |
| ok | migration | `supabase/migrations/20260704010000_commercial_markup_mode.sql` |
| ok | migration | `supabase/migrations/20260704020000_creator_enrichment.sql` |
| ok | migration | `supabase/migrations/20260704120000_creator_dna.sql` |
| ok | migration | `supabase/migrations/20260705010000_shortlist_item_status.sql` |
| ok | migration | `supabase/migrations/20260705020000_quotations_enterprise.sql` |
| ok | migration | `supabase/migrations/20260705030000_quotation_agency_fee.sql` |
| ok | migration | `supabase/migrations/20260705100000_discovery_coverage_decisions.sql` |
| ok | migration | `supabase/migrations/20260705120000_creator_dna_phase2_extensions.sql` |
| ok | migration | `supabase/migrations/20260705140000_discovery_control_settings.sql` |
| ok | migration | `supabase/migrations/20260705200000_creator_dna_apify_persistence.sql` |
| ok | migration | `supabase/migrations/20260705210000_creator_dna_ipl_grants.sql` |
| ok | migration | `supabase/migrations/20260706010000_quotation_commercial_lifecycle.sql` |
| ok | migration | `supabase/migrations/20260706020000_client_onboarding_ownership.sql` |
| ok | migration | `supabase/migrations/20260706030000_client_onboarding_hardening.sql` |
| ok | migration | `supabase/migrations/20260706040000_client_onboarding_activated_at.sql` |
| ok | migration | `supabase/migrations/20260706050000_campaign_headers_optional_group.sql` |
| ok | migration | `supabase/migrations/20260706120000_creator_dna_intelligence_metadata.sql` |
| ok | migration | `supabase/migrations/20260707010000_discovery_global_fts.sql` |
| ok | migration | `supabase/migrations/20260708010000_discovery_creator_centric.sql` |
| ok | migration | `supabase/migrations/20260709010000_discovery_database_stats.sql` |
| ok | migration | `supabase/migrations/20260709020000_discovery_search_performance.sql` |
| ok | migration | `supabase/migrations/20260709100000_fix_security_advisor_errors.sql` |
| ok | migration | `supabase/migrations/20260710010000_discovery_stats_category_overlap.sql` |
| ok | migration | `supabase/migrations/20260710020000_discovery_category_browse_case_insensitive.sql` |
| ok | migration | `supabase/migrations/20260710030000_discovery_search_single_rpc.sql` |
| ok | migration | `supabase/migrations/20260710040000_discovery_search_taxonomy.sql` |
| ok | migration | `supabase/migrations/20260710050000_discovery_search_analytics.sql` |
| ok | migration | `supabase/migrations/20260710060000_discovery_search_bio_hashtag.sql` |
| ok | migration | `supabase/migrations/20260711010000_audit_logs_security_foundation.sql` |
| ok | migration | `supabase/migrations/20260712010000_campaign_object_persistence.sql` |
| ok | migration | `supabase/migrations/20260712020000_fix_campaign_object_version_race.sql` |
| ok | migration | `supabase/migrations/20260712160000_influencer_tier_classification.sql` |
| ok | migration | `supabase/migrations/20260712170000_campaign_plan_provenance.sql` |
| ok | migration | `supabase/migrations/20260712180000_quotation_tentative_schedule.sql` |
| ok | migration | `supabase/migrations/20260713100000_campaign_intelligence_profiles.sql` |
| ok | migration | `supabase/migrations/20260713110000_campaign_intelligence_structured_brief.sql` |
| ok | migration | `supabase/migrations/20260713120000_quotation_line_options.sql` |
| ok | migration | `supabase/migrations/20260713120100_creator_intelligence_projection.sql` |
| ok | migration | `supabase/migrations/20260713130000_quotation_item_avatars.sql` |
| ok | migration | `supabase/migrations/20260714100000_creator_intelligence_grants.sql` |
| ok | migration | `supabase/migrations/20260714100100_campaign_intelligence_object.sql` |
| ok | migration | `supabase/migrations/20260714110000_fix_campaign_intelligence_profiles_rls.sql` |
| ok | migration | `supabase/migrations/20260714120000_fix_campaign_intelligence_profiles_insert_rls.sql` |
| ok | migration | `supabase/migrations/20260714130000_quotation_option_number_nullable.sql` |
| ok | migration | `supabase/migrations/20260714140000_fix_campaign_intelligence_profiles_insert_rls_apply.sql` |
| ok | migration | `supabase/migrations/20260714150000_fix_campaign_intelligence_creator_insert_rls.sql` |
| ok | migration | `supabase/migrations/20260714160000_fix_campaign_intelligence_profiles_select_rls.sql` |
| ok | migration | `supabase/migrations/20260714170000_campaign_intelligence_service_role_grants.sql` |
| ok | migration | `supabase/migrations/20260714180000_creator_dna_write_rls.sql` |
| ok | migration | `supabase/migrations/20260714190000_discovery_creator_owner_delete.sql` |
| ok | migration | `supabase/migrations/20260714195000_discovery_operator_delete.sql` |
| ok | migration | `supabase/migrations/20260714200000_fix_function_search_path_warnings.sql` |
| ok | migration | `supabase/migrations/20260715090000_reapply_ai_conversation_rls_read_alignment.sql` |
| ok | migration | `supabase/migrations/20260715100000_ai_conversations_quotation_workspace.sql` |
| ok | migration | `supabase/migrations/20260718070000_discovery_browse_recency.sql` |
| ok | migration | `supabase/migrations/20260719100000_influencer_country_codes.sql` |
| ok | migration | `supabase/migrations/20260719110000_browse_country_codes_filter.sql` |
| ok | migration | `supabase/migrations/20260719120000_shortlist_collapse_content.sql` |
| ok | migration | `supabase/migrations/20260719130000_shortlist_standalone_creator_duplicates.sql` |
| ok | migration | `supabase/migrations/20260720120000_forecast_data_foundation.sql` |
| ok | migration | `supabase/migrations/20260721120000_browse_influencer_ids_by_recency.sql` |
| ok | migration | `supabase/migrations/20260721140000_enrichment_awaiting_profile_details.sql` |
| ok | migration | `supabase/migrations/20260722100000_entity_url_slugs.sql` |
| ok | migration | `supabase/migrations/20260723120000_canonicalize_social_platforms.sql` |
| ok | migration | `supabase/migrations/20260723120100_shortlist_display_currency.sql` |
| ok | migration | `supabase/migrations/20260723130000_creator_import_files_updated_at.sql` |
| ok | migration | `supabase/migrations/20260724150000_finance_fx_rls_least_privilege.sql` |
| ok | migration | `supabase/migrations/20260724160000_finance_po_notifications_rls_hardening.sql` |
| ok | migration | `supabase/migrations/20260724170000_invalidate_plaintext_invites.sql` |
| ok | migration | `supabase/migrations/20260724180000_p4_campaign_publication_media_select.sql` |

## Failure

_None — full replay succeeded._
