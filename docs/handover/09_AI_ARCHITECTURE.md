# 09 — AI Architecture

## Surfaces

- `/ai` conversation workspace
- `/api/ai/*`
- Tools: searchCreators, getCampaign, shortlists, briefs, reports (non-billing)

## Isolation (P4)

- Portal users cannot use AI tools
- Finance-shaped tool names blocked
- Billing report type denied
- Tools use user JWT (RLS), not service role

## Providers

OpenAI (primary); Anthropic / Gemini adapters monitored in Operations Center when keys present.

## Prompt safety

`features/ai/prompts/prompt-isolation.ts` — system/developer/user separation (P2).

