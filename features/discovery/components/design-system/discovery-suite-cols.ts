/**
 * Spec §3 — nine track lists, byte-identical to discovery.html / design spec.
 * Checkbox: 30px on list pages, 34px on Discovery tool pages (avatar rows).
 */

export const DISCOVERY_COLS = {
  shortlists:
    "30px 116px minmax(180px,1.4fr) 130px 96px 92px 100px 150px 70px 110px 74px",
  shortlist:
    "30px minmax(200px,1.4fr) 68px 140px 296px 166px 126px 96px",
  quotations:
    "30px 116px minmax(190px,1.4fr) 120px minmax(150px,1fr) 92px 92px 150px 66px 116px 74px",
  quotation:
    "30px 74px minmax(190px,1.2fr) 66px minmax(230px,1.4fr) 74px 150px 128px 84px 92px",
  search: "34px minmax(210px,1.5fr) 150px 296px 166px 128px",
  intel: "34px minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px",
  import:
    "34px minmax(190px,1.4fr) 130px 116px 84px 96px 92px 92px 88px 138px 92px",
  cwModal:
    "30px minmax(180px,1.2fr) 150px 118px 118px 92px 84px 74px 92px",
  qCalcPanel:
    "minmax(150px,1.2fr) 104px 112px 112px 100px 74px 108px 92px",
} as const;

export type DiscoveryColsKey = keyof typeof DISCOVERY_COLS;

/** Horizontal scroll floors from the HTML grid() minW args. */
export const DISCOVERY_GRID_MIN_W: Partial<Record<DiscoveryColsKey, number>> = {
  shortlists: 1250,
  shortlist: 1360,
  quotations: 1300,
  quotation: 1180,
  search: 1100,
  intel: 980,
  import: 1200,
};
