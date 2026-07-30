# Release 2.1 — UAT Checklist

**Environment:** Development (`dev.thinkwaymedia.com`) first  
**Production:** only after explicit approval

## Functional

| # | Case | Expect | Pass |
|---|---|---|---|
| U1 | Single Media Plan campaign | Default plan loads; selector hidden when only one plan | ☐ |
| U2 | Multiple Media Plans | Selector lists plans; `?planId=` switches; default marked | ☐ |
| U3 | Assignment hydration | Empty slate seeds creators with Assignment IDs | ☐ |
| U4 | Planned vs Actual | Completing one Assignment post does not mark another Assignment with same creator/type | ☐ |
| U5 | Remaining view | Completed Assignment grains leave Remaining | ☐ |
| U6 | Live grain move | Drag of live / locked grain is rejected with clear message | ☐ |
| U7 | Draft move | Non-live draft grain still movable | ☐ |
| U8 | Approve / lock | Existing approval + immutable baseline unchanged | ☐ |
| U9 | Versioning | Revise / regenerate / history unchanged | ☐ |
| U10 | Timeline | Media Plan approve/lock events appear under Enterprise Timeline | ☐ |
| U11 | Portal Media Plan | Client approve / request changes still works on default plan | ☐ |
| U12 | Studio generate | Generate/regenerate still works; cards carry Assignment refs when linked | ☐ |

## Regression

| # | Case | Expect | Pass |
|---|---|---|---|
| R1 | Convert to Campaign | Unchanged behaviour (flag-gated as before) | ☐ |
| R2 | Commercial SSOT | No commercial write path changes | ☐ |
| R3 | Deliverables documentation | Upload / completeness unchanged | ☐ |
| R4 | Campaign navigation | Media Plan entry from campaign workspace | ☐ |
| R5 | Exports | PDF/HTML/Excel Media Plan still generate | ☐ |

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Product | | | |
| Operations | | | |
| Engineering | | | |
