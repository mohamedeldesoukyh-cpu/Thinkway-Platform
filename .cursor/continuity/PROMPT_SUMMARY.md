# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Studio entry experience — **Development only (no Production)**

Studio is the primary campaign planning workspace. Chat is an optional assistant. One CIP → Campaign Facts SSOT.

1. Intake brief upload no longer drops `brand_selection` — it opens the existing brand-link dialog and passes `conversationId`.
2. `/studio` landing: **New Campaign** (upload / write / paste) + **Campaign History** from `campaign_objects`.
3. Chat: **Open in Studio** for operational briefs; paperclip routes to Studio upload. Studio chrome uses New Campaign / Campaign History, not AI chat history.

No database changes. Do not deploy Production until QA is accepted.

- Dev: https://dev.thinkwaymedia.com  
- Prod: https://app.thinkwaymedia.com  
