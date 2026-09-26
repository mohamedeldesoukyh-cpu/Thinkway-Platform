# Open: campaign route hydration text mismatch

Status: open; not attributed to a particular element. Do not suppress this warning.

Reproduced while signed into development, opening a fresh browser tab directly at:
`https://dev.thinkwaymedia.com/campaigns/campaign-quotation-tuna-dolphin-delta-campaign-v2-8265ff15?tab=deliverables`

Captured 2026-09-26T23:07:23.912Z, deployment `dpl_9t12xYFGjcny12t53QHfUFrnoTND`.
The page initially showed Loading, then the campaign workspace. No filter or sheet interaction was needed.
A separate fresh navigation to `/campaigns` had no captured console errors. The isolated panel SSR/hydration test also passed. These observations do not prove the exact offending component.

Exact console message (the hosted minified build does not include a named element or DOM diff):

```text
Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
    at rX (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:47244)
    at rG (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:48277)
    at https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:142625
    at sh (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:147786)
    at sd (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:139036)
    at https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:133861
    at se (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:133962)
    at s$ (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:160526)
    at MessagePort.O (https://dev.thinkwaymedia.com/_next/static/chunks/1qxz2klaztyt2.js?dpl=dpl_9t12xYFGjcny12t53QHfUFrnoTND:1:8684)
```

Follow-up: reproduce the authenticated route in an unminified development build to obtain React's component/DOM diff. Keep this issue open until the actual element is identified and corrected.
