# Document Workspace Consolidation Audit

**Date:** June 2026  
**Branch:** `refactor/phase2-shared-domains-ui`  
**Scope:** Client, Vendor/Influencer, Group document libraries; inline attach; bank letter download

---

## Executive Summary

Document upload forms, operational tables, download/delete action cells, and filter accessors were duplicated across three entity workspace tabs with nearly identical column definitions and server-action wiring. Shared infrastructure at `features/documents/` centralizes the workspace UI; domain wrappers preserve existing APIs, storage buckets, permissions, and UX.

---

## 1. Surfaces Audited

| Surface | File(s) | Upload path | Download | Delete | Filters | Preview | Version history |
|---------|---------|-------------|----------|--------|---------|---------|-----------------|
| Client documents tab | `client-documents-tab.tsx` | API route (`/api/clients/...`) | Server action signed URL | Server action | Operational table suite | New tab (download URL) | None |
| Vendor documents tab | `vendor-documents-tab.tsx` | Server action | Server action | Server action | Operational table suite | New tab | None |
| Group documents tab | `group-documents-tab.tsx` | Server action | Server action | Server action | Operational table suite | New tab | None |
| Client inline attach | `client-inline-document-attach.tsx` | API route | Server action | Server action | N/A | Eye → new tab | None |
| Vendor bank letter | `vendor-bank-details-section.tsx` | Server action | Server action | N/A | N/A | N/A | None |
| Brand documents | — | **Not implemented** | — | — | — | — | — |
| Portal PO / deliverable upload | `portals/actions.ts` | Storage upload in action | N/A | N/A | N/A | N/A | None |
| IO document generation | `features/io/*` | Generated PDFs | Regenerate actions | N/A | N/A | N/A | Separate flow |

### APIs (unchanged)

- `POST /api/clients/[clientId]/documents` — client uploads (large files)
- `uploadClientDocumentAction`, `deleteClientDocumentAction`, `getClientDocumentDownloadUrlAction`
- `uploadInfluencerDocumentAction`, `deleteInfluencerDocumentAction`, `getInfluencerDocumentDownloadUrlAction`
- `uploadGroupDocumentAction`, `deleteGroupDocumentAction`, `getGroupDocumentDownloadUrlAction`
- Storage buckets: `client-documents`, `influencer-documents`, `group-documents`

### Permissions / server actions

No changes to RLS, action signatures, audit logging, or eligibility rules.

---

## 2. Shared Infrastructure Created

```
features/documents/
├── document-types.ts           # Config, row, action types
├── document-utils.ts           # Pure helpers (mapping, expiry, labels)
├── document-utils.test.ts      # Regression tests
├── document-hooks.ts           # Download, delete, preview, toast hooks
├── document-actions.tsx        # Row actions + download/view buttons
├── document-filters.tsx        # Re-exports filter accessor helpers
├── document-upload-panel.tsx   # Upload form shell (operational / vendor layout)
├── document-table.tsx          # Column builder + library table
├── document-preview-dialog.tsx # Optional in-app preview (future / inline view)
├── document-workspace.tsx      # Upload + table orchestrator
└── index.ts                    # Public barrel
```

Pattern follows `features/creators/picker/` and `components/shared/status/`: types → utils → hooks → presentational components → domain wrappers.

---

## 3. Before / After Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `client-documents-tab.tsx` | 197 lines | ~45 lines | **−77%** |
| `vendor-documents-tab.tsx` | 218 lines | ~55 lines | **−75%** |
| `group-documents-tab.tsx` | 206 lines | ~50 lines | **−76%** |
| Duplicated `DocumentActionsCell` | 3 copies (~55 LOC each) | 1 (`DocumentRowActions`) | **−67%** |
| Duplicated column builders | 3 copies (~40 LOC each) | 1 (`buildDocumentTableColumns`) | **−67%** |
| Duplicated upload wrappers | 3 copies | 1 (`mapEntityDocumentUploadFormData`) | **−67%** |
| Bank letter download button | 35 lines bespoke | `DocumentDownloadButton` | Consolidated |
| Shared documents module (new) | 0 | ~650 lines | Centralized |
| **Net duplicate UI LOC in feature tabs** | ~621 lines | ~150 lines | **~−76% duplicate reduction** |

---

## 4. Domain Wrappers

| Wrapper | Uses internally | Preserves |
|---------|-----------------|-----------|
| `ClientDocumentsTab` | `DocumentWorkspace` (operational layout) | API upload path, client document types, filters |
| `VendorDocumentsTab` | `DocumentWorkspace` (vendor layout + tab shell) | Server action upload, vendor tab UX |
| `GroupDocumentsTab` | `DocumentWorkspace` (operational layout) | Group document types, empty copy |

`DocumentUploadForm` remains the shared low-level form; `DocumentUploadPanel` wraps it with layout-specific sections.

---

## 5. Capabilities Matrix

| Capability | Shared support | Notes |
|------------|----------------|-------|
| Upload | ✅ | API (client) or server action (vendor/group) via config |
| Preview | ⚠️ Partial | `DocumentPreviewDialog` + hooks; workspaces still open signed URL in new tab (UX preserved) |
| Download | ✅ | `useDocumentDownload`, `DocumentDownloadButton` |
| Replace | ⚠️ Partial | Re-upload same type; inline attach has explicit replace — not in table rows |
| Archive | ❌ | Not in product; no server action |
| Delete | ✅ | `DocumentRowActions` + existing delete actions |
| Filters / search | ✅ | Operational table suite + existing filter accessors |
| Version history | ❌ | Single row per document; no versioning in schema |
| Expiration tracking | ✅ | Expiry column + `documentExpiryStatus` utils (badges not yet wired) |
| Status badges | ❌ | No document status field; expiry utils ready for future badges |
| Bulk actions | ❌ | Not in original UX |

---

## 6. Remaining Gaps (by design or future work)

1. **Brand documents** — no brand-level document tab in codebase; brands use `document_number` only.
2. **Portal uploads** — deliverable/PO uploads use different form context (`portals/actions.ts`); keep separate.
3. **IO / finance documents** — generated PDFs (client IO, vendor IO, invoices) are distinct workflows in `features/io/` and billing.
4. **Client inline attach** — compact chip UX stays local; uses same download/delete actions, not full workspace.
5. **In-app preview dialog** — infrastructure added; entity tabs unchanged (open in new tab).
6. **Archive / bulk / version history** — no backend support; documented for Phase 2+ if product adds schema.

---

## 7. Visual Parity

No layout or styling changes. Expected parity:

- Upload panel: rounded border form, type select, optional expiry date, file input, primary upload button.
- Document library: operational table with Type, File, Uploaded, Expiry, Actions (Download + Remove).
- Vendor tab: unchanged `VendorProfileTabShell` + `VendorFormSection` icon header.
- Group/client: unchanged `OperationalFormSection` headers.

---

## 8. Validation

- `npx tsc --noEmit -p tsconfig.json`
- `npm run build`
- `node features/documents/document-utils.test.ts`

---

## 9. Regression Tests

| File | Coverage |
|------|----------|
| `document-utils.test.ts` | Date formatting, upload form mapping, upload handler, expiry status, preview MIME detection, sort |

Existing `lib/clients/client-document-utils.test.ts` unchanged (serialization / API error helpers).
