# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** ~80 MB Instagram story failed with “must be 100 MB or smaller” even though the file is under the product cap.

- Cause: standard signed PUT is capped at **50 MB** by Supabase Storage (`UPLOAD_FILE_SIZE_LIMIT_STANDARD`), independent of the 100 MB bucket limit.
- Fix: files over **45 MB** upload via resumable **TUS** (`/storage/v1/upload/resumable/sign` + `x-signature`). Smaller files still use signed PUT.
- Same story: hard-refresh, stay on Instagram story #1, choose the MOV again (reuses the Incomplete row). Wait for the percent meter to finish.

**Ship:** Development then Production. No schema or data writes.
