# Release 2.2 — Client IO Enterprise Completion — UAT Checklist

**Environment:** Development (`dev.thinkwaymedia.com`) first  
**Production:** only after Feature Freeze + explicit approval  
**Parent:** [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)

## Functional

| # | Case | Expect | Pass |
|---|---|---|---|
| C1 | Ensure CIO on campaign | Creates/loads tip; Convert still did not auto-create | ☐ |
| C2 | Assignment composer | Can select subset of Assignments by line ID | ☐ |
| C3 | Generate with selection | PDF/HTML includes only selected Assignments; rollups match | ☐ |
| C4 | Empty selection blocked | Cannot generate with zero Assignments | ☐ |
| C5 | Preview / layouts | detailed / package / package_main still work | ☐ |
| C6 | Send + recipients | Email + `io_notifications`; status advances | ☐ |
| C7 | Client approve (token/portal) | Approves **current tip**; stamps approved | ☐ |
| C8 | Create amendment | Prior tip immutable; new tip generated; history visible | ☐ |
| C9 | Amendment content | Reflects updated selection/milestones; root chain intact | ☐ |
| C10 | Billing milestones | Templates + custom schedule persist and appear on document | ☐ |
| C11 | Timeline | generate/send/approve/amend events on Enterprise Timeline | ☐ |
| C12 | Finance lock | Commercial lock still engages when CIO exists | ☐ |
| C13 | Cancel | Cancelled tip; Timeline/cancel audit | ☐ |

## Regression

| # | Case | Expect | Pass |
|---|---|---|---|
| R1 | Convert | Still does not create CIO | ☐ |
| R2 | Commercial SSOT | No unauthorized commercial writes from CIO | ☐ |
| R3 | Media Plan / Assignments | Unaffected | ☐ |
| R4 | VIO / Invoice | Unaffected (milestones not executed) | ☐ |
| R5 | Client IO register `/ios/client` | Lists tip documents correctly | ☐ |

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Product | | | |
| Finance / AM | | | |
| Engineering | | | |
