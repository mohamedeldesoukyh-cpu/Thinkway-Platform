# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Story MOV reached “Incomplete / upload did not finish” after the PUT.

- `begin` creates the file row before bytes land. `complete` used to abort if Storage’s signed-URL lookup raced.
- Finish now waits, then records the version after a successful PUT. MIME retries get a **new** signed URL (single-use tokens).
- Same 80 MB story: hard-refresh, stay on Instagram story #1, choose the MOV again (reuses the Incomplete row).

**Ship:** Development then Production. No schema or data writes.
