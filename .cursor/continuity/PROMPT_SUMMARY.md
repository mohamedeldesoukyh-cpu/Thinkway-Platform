# Prompt Summary — Current Sprint

**Branch:** `feature/discovery-search-add-missing-creator` (from `develop`)  
**Focus:** Discovery Search reliability + batch Add missing creator

## In progress (this session, local)

- Creator Search first-load timeouts no longer crash as a Production digest error
- SSR taxonomy wait is budgeted; browse errors are returned (not thrown)
- ECI overlay is fail-open with a time budget so the creator list can still render
- Always-visible **Add missing creator** — paste multiple profile URLs, extract usernames, skip duplicates already in Discovery

## Shipped prior (Dev + Production)

- Confirm campaign advances to Strategy; confirmed Intake shows Continue to Strategy
- Progress meter while the brief is being read / Studio is still working
- CIP is created at workflow start from chat text; Intake polls and syncs the panel
- Stale “INPUT REQUIRED: budget” hides once budget is on Campaign Facts
- Do not invent audience, platforms, country, or budget
- `Campaign:` fills the campaign name; “Arab Bank new credit” is not the client
- Duration helper shows `1 month / 4 weeks`
- Later steps stay Blocked until Confirm
- Wave 3 Package readiness · Intake CIP → facts · Studio UX IA

Dev: https://dev.thinkwaymedia.com  
Prod: https://app.thinkwaymedia.com  

Client Workspace is **not** started.
