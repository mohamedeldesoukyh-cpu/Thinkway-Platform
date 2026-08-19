# Prompt Summary — Current Sprint

**Branch:** `main` (Production release) · also on `develop`  
**Focus:** Studio entry experience — **Production**

Studio is the primary campaign planning workspace. Chat is an optional assistant. One CIP → Campaign Facts SSOT.

1. Intake brief upload no longer drops `brand_selection` — it opens the existing brand-link dialog and passes `conversationId`.
2. `/studio` landing: **New Campaign** (upload / write / paste) + **Campaign History** from `campaign_objects`.
3. Chat: **Open in Studio** for operational briefs; paperclip routes to Studio upload. Studio chrome uses New Campaign / Campaign History, not AI chat history.
4. New-client briefs: **Continue without a Thinkway brand** persists CIP with `brand_id` null. Does not create CRM clients/brands. Attach a CRM brand later.

No database changes. No Production Supabase schema change.

- Dev: https://dev.thinkwaymedia.com  
- Prod: https://app.thinkwaymedia.com  
