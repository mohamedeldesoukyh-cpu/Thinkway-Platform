# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Studio chat-brief Intake — progress, CIP wiring, Confirm → Strategy

## In progress (local on develop, not deployed)

Chat-pasted briefs jumped to Intake with no loading, invented audience/platforms, left Campaign Intelligence Pending, kept asking for budget after it was filled, and Confirm did not advance to Strategy.

Fixes in this session:

- Confirm campaign advances to Strategy; confirmed Intake shows Continue to Strategy
- Progress meter while the brief is being read / Studio is still working
- CIP is created at workflow start from chat text; Intake polls and syncs the panel
- Stale “INPUT REQUIRED: budget” hides once budget is on Campaign Facts
- Do not invent audience, platforms, country, or budget; `Campaign:` fills the campaign name; “Arab Bank new credit” no longer becomes the client
- Duration helper shows `1 month / 4 weeks`
- Later steps stay Blocked until Confirm, even when required facts are already typed

Client Workspace is **not** started. Facebook inspect scripts remain untracked and should stay out of commits.

## Shipped prior

- Wave 3 Package readiness
- Intake CIP → facts merge + Confirm
- Left rail: Intake In progress; later steps Blocked until Confirm
- Studio UX: Intake → Strategy → Creators → Content → Commercial → Package
