# Deliverable version management

The revised requirement supersedes the former upload-then-release gate: successful new panel uploads are client-visible immediately, including drafts. No existing production uploads were released or edited during implementation.

## Behavior

- Choose Draft, Ready for review, Internally approved or Final before uploading, including in the deliverable sheet.
- Each upload appends a numbered version to the same asset. Earlier files and review decisions remain intact.
- The Content & uploads view defaults to All. Each card has Videos & versions, with lazy-loaded previews and per-version controls; the sheet also shows all versions.
- Rename and production status changes do not overwrite client decisions. Internal approval is explicitly labeled separately.
- Hide excludes a version from client projections and new signed-file requests. Show restores visibility.
- Remove is soft removal, retaining the file and feedback. Restore returns the version as hidden; Show is a separate choice.
- Client history includes previous file names, statuses, feedback and links to open earlier visible versions.
- Removing the current version lets internal lists use a remaining version; hiding/removing the latest client version lets the latest remaining visible version be reviewed.
- There is no bulk release action. Existing internal-only versions can be made visible individually using Show to client.

## Safeguards

Version edits require the existing campaign write/admin authorization, including its MFA check. The service verifies that the version's asset belongs to the submitted campaign, deliverable and slot before writing. Metadata updates use optimistic matching; invalid names, statuses and visibility values are rejected. Version edits retain attribution and emit documentation events. Storage objects are never deleted by these controls.

Hiding/removing stops new signed-file requests. Previously issued storage URLs may remain valid for their existing 15-minute lifetime, and cannot undo a client's prior download.

## Verification

- Targeted version, upload, decision and panel-model test run: 28 passed.
- Client-workspace, content-decision and version-control run: 220 passed.
- TypeScript no-emit check passed.
- Optimized production build passed (exit 0).
- Local browser check reached sign-in; authenticated version controls were not browser-verified. The temporary server was then stopped.
- No real client upload, release, hide, remove or approval was exercised.
- Browser interaction and hosted deployment verification remain required before claiming this change is live.

No schema migration or automatic backfill of existing upload visibility is included.
