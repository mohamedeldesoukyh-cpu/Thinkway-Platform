# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Campaign publication plan collapsed by default; Campaign Performance Refresh metrics toasts complete on terminal status.

- Creators and go-live groups stay collapsed until the client expands a row (or uses the overdue CTA).
- Refresh metrics loading toasts finish when the first observed status is already completed / manual / failed (remount or fast worker race).
- Dual ship: Development (`develop`) then Production (`main`) after this change.
