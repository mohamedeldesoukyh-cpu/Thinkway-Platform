# Vendor IO quantity audit — 11 November 2026

Campaign: TW-2026-0012, Limitless Naturals UAE Oct Nov Influencers Campaign.

Read-only production inspection compared all 12 assignment rows with their linked
source quotation items, structured assignment deliverables, and Vendor IO links.
Four assignments (five deliverable rows) have incorrect quantities. The other
eight assignments match the source quotation quantities.

| Assignment | Creator | Vendor IO | Current | Required |
|---|---|---|---|---|
| C | themiladsalami | VIO-2026-0086 | 1 UGC | 3 UGC |
| F | ph____alaa | VIO-2026-0083 | 1 reel + 1 story | 4 reels + 4 stories |
| J | tn_tn_796 | VIO-2026-0092 | 1 UGC | 2 UGC |
| L | maryamhizemm | VIO-2026-0087 | 1 UGC | 2 UGC |

## Cause and prevention

`quotationDeliverablesToPlatforms` expands quotation `type_lines` quantities into
repeated types, then used a Set to deduplicate them. That discarded contracted
quantities before package assignment rows were created. Full Description retained
the source text, while the Vendor IO correctly read the incorrect structured data.

The fix preserves repeated types. The existing package converter groups them into
quantities and distributes the existing package fee over those units.
Regression cases cover 3 UGC, 4 reels + 4 stories, and 2 UGC, including unchanged
package cost and revenue totals. Existing platform-routing tests still pass.

## Existing-record correction proposal (not applied)

Correct the five structured deliverable quantities and corresponding assignment
platform metadata. Preserve deliverable IDs, links, all row totals, tax amounts,
usage rights, agency fees, assignment totals, and IO amounts. Recalculate only the
unit cost by dividing each existing row total by the corrected quantity:

| Deliverable ID | Type | Quantity | Total cost AED (unchanged) | Unit cost AED |
|---|---|---:|---:|---:|
| 544584db-9f21-47f0-b628-4d08478b9a1a | UGC | 3 | 2250.00 | 750.00 |
| 6100f065-6076-4946-b583-f46809b30558 | Reel | 4 | 7345.00 | 1836.25 |
| 73a9fcfd-4101-48a4-b643-8e9f9009216f | Story | 4 | 7345.00 | 1836.25 |
| 0d1e7ee2-5818-433f-8ee4-9a0f5e7443f0 | UGC | 2 | 1469.00 | 734.50 |
| 63e825cd-f8da-4bde-a301-3312cacc47ca | UGC | 2 | 1400.00 | 700.00 |

All four IOs were `generated` at inspection time; the five deliverables had no
`locked_at`. Recheck status and financial snapshots before any repair. Reconcile
post schedules to the corrected unit counts without deleting existing schedules
or evidence. Verify IO preview and downloads after regenerating any stored files.

Production data and deployment remain unchanged. The campaign does not exist in
development: development TW-2026-0012 is a different campaign (Liwa Festival), so
document numbers must never be used alone to target a cross-environment repair.

## UGC-only default terms

User requested Milad's saved VIO-2026-0086 wording as the UGC default, and explicitly
selected the existing standard terms for mixed UGC + posted-deliverable IOs.

The saved thirteen clauses are copied verbatim into `vendor-io-ugc-default-terms.ts`.
Both `ugc` and `ugc_video` types qualify. Every covered deliverable must be UGC;
empty, unknown, mixed and non-UGC scopes retain the current standard defaults.
IO-specific, vendor-specific and saved agreement overrides retain precedence.
The existing country selector continues to control the compliance clause.

Scope is read across all linked assignment lines for the editor, restore-default
actions and document rendering. New agreement composition also selects by scope.
Tests verify the actual document loader and HTML output, default selection, custom
override precedence and new agreement composition. No existing custom terms were
overwritten. Development has no inherited UGC IO fixture for authenticated browser
verification; fixture-based document tests cover those cases instead.

## Development verification

- Preview deployment: `dpl_E79aPt4aiyDoVKT6vjYCgp2jaJbj`
- URL: https://thinkway-platform-qbhqo7to8-mohamedeldesoukyh-cpus-projects.vercel.app
- Hosted build and TypeScript checks passed.
- `/api/build-info` confirms `environment=preview`, development Supabase project
  `hsxrewjcbvmbkqdlzjhs`, and `supabaseAligned=true`.
- Quantity conversion, package allocation, schedule inheritance, existing terms
  regressions, UGC defaults, document rendering and agreement composition tests pass.
- Targeted lint passes; the pre-existing `vendor-io-form.tsx` synchronous state
  update effect still triggers `react-hooks/set-state-in-effect` when that file is
  included. No unrelated form-state refactor was made.
- Production deployment and the four existing-record corrections are not applied.
