# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Campaign Performance snapshots + agreed vs added-value publications

## In progress

- Publication / report snapshots: live-post proxy 404 had no retry; reports used blocked Instagram CDN URLs
- Fix: retry media-proxy in Publication workspace; embed report snapshots as data URIs via post URL when no stored screenshot
- Added value split is live on Production (`67ded82`)

## Shipped prior

- Classify only contracted platforms as agreed (`0123f1bb` / `67ded82e`)
- Split Publications vs Added value (`49171f90`) · cards default-open (`b46ff891`) · report import fix (`4cf20a6d`)
