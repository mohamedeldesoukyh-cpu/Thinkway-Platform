<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deployment workflow

- Deploy and verify every update on dev before deploying it to live.
- Deploy to live only when the user explicitly requests it, after dev verification. Never skip dev.

## Production data protection

- Never create synthetic, QA, demo, or test records or accounts in production.
- Never allocate or reserve production business document numbers or serials for tests.
- Run tests that create, edit, sign, or delete test data only in development, using isolated fixtures and cleanup.
- Production release verification must be read-only. Do not use production signing, approval, or document-creation flows as smoke tests.
- User-authorized repairs of existing production data are maintenance, not tests: scope them to verified records, back up affected data, preserve real records and numbering, and verify the result read-only.
