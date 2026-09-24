# Vendor CRM membership and identity search

## Live database repair

Applied the three `2026092415*` migrations in Development and Production.
Production repair created 13 missing CRM profiles for creators with campaign
assignments or Vendor IOs. No existing lifecycle status was changed. There are
zero remaining assignment/IO membership gaps. Creator
`26b9dcd5-e11a-42f2-822c-6509d6b95c15` (`@themiladsalami`) now has CRM membership.

The initial broad audit counted 72 missing profiles, but 59 were quotation-only:
57 draft and 2 accepted, with no assignment or IO. They remain outside CRM in
accordance with the operational activation boundary.

Application activation was best-effort and could leave a committed assignment
without CRM membership. Assignment and IO database triggers now create membership
and audit records in the same transaction. They cover writes through application,
RPC, and import paths. Existing source events are deduplicated. These operational
invariants apply independently of the application CRM-writer feature flag.

## App change awaiting release

`features/vendors/queries.ts` uses `search_vendor_identities` for both Vendors and
From Discovery, with `vendor_identity_search_total_count` for matching pagination.
Search includes display/legal names, social display names, usernames, slugs/short
name fragments, profile URLs, email, and vendor number. It normalizes case, common
separators, leading @, social URL prefixes, query parameters, and trailing slashes.
There is no new separately editable nickname field.

The RPC retains internal-reader, linked-self, and campaign-scoped access checks.
Explicit scope checks avoid the existing database's per-row RLS search timeout.
The legacy `vendor_list_total_count` remains unchanged for compatibility with the
currently deployed app. New app search has not yet been deployed.

## Verification

- Full Next.js production build passed; TypeScript passed.
- 21 CRM unit/regression tests passed.
- `scripts/test-vendor-crm-search.sql` passed against Development with rolled-back
  fixtures: names/handles/URLs/social names, partial names, literal input, duplicate
  social accounts, CRM/inventory filtering, count/platform agreement, assignment
  and IO activation, audit deduplication, status preservation, denied-user scope.
- Development PostgREST smoke test passed with nested CRM/platform relations,
  inner platform relation, filters, ordering, and pagination. Service-role call
  has no user identity and correctly returns no rows; authenticated matches were
  tested through SQL with request claims.
- Production authenticated lookup found themiladsalami by URL, username, and
  compact name within an eight-second statement timeout.
- Targeted lint reported existing `set-state-in-effect` in the import dialog and
  existing `no-explicit-any` in vendor queries. This change did not introduce them.

## Release and rollback

Release only the vendor-search changes through the documented release workflow;
the shared working tree contains unrelated changes. Production app deployment
requires the explicit approval described in `docs/RELEASE_WORKFLOW.md`.
Risk is limited to the search query path and automatic operational membership.
Rolling back the app leaves the legacy query/count intact and retains repaired
memberships. If necessary, disable the two new activation triggers independently;
do not delete repaired profiles or commercial records as a rollback.
