# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** iPhone story `.MOV` files (~80 MB) were still rejected after the QuickTime MIME fix.

- Storage sniffs the container. Stories named `.MOV` are often MP4 (`ftypisom` / `mp42`), so declaring QuickTime returns 400.
- Upload now sniffs `ftyp` and retries `video/mp4` ↔ `video/quicktime` on a MIME 400.
- Size is unchanged: 100 MB. 80,844 KB is under the cap.

**Ship:** Development then Production. No schema or data writes.
