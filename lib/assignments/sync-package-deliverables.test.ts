/**
 * Run: npx tsx lib/assignments/sync-package-deliverables.test.ts
 */
import {
  applyPackageTotalsToDeliverableRows,
  packageChildCostSum,
  packageChildQuantitySum,
  packageChildRevenueSum,
  packagePlatformsToCommercialRows,
  redistributePackageChildren,
  splitPackageTotalsAcrossDeliverables,
} from "@/lib/assignments/sync-package-deliverables";
import { rowTotalRevenue } from "@/lib/assignments/commercial-calculations";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const PACKAGE = {
  revenueBeforeVat: 11_200,
  costBeforeVat: 10_000,
  usageRightsAmount: 3_200,
  usageRightsCost: 1_600,
  agencyFeePercent: 10,
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

{
  const shares = splitPackageTotalsAcrossDeliverables(
    [
      { id: "reel", quantity: 26 },
      { id: "post", quantity: 6 },
    ],
    PACKAGE
  );
  assert(packageChildQuantitySum(shares) === 32, "A: parent qty is sum of children");
  assert(
    packageChildRevenueSum(shares) === PACKAGE.revenueBeforeVat,
    `A: child rev must match package, got ${packageChildRevenueSum(shares)}`
  );
  assert(
    packageChildCostSum(shares) === PACKAGE.costBeforeVat,
    `A: child cost must match package, got ${packageChildCostSum(shares)}`
  );
  assert(shares[0]!.quantity === 26 && shares[1]!.quantity === 6, "A: type qty preserved");
  assert(shares[0]!.revenueBeforeVat === 9_100, `A: 26/32 of 11200 = 9100, got ${shares[0]!.revenueBeforeVat}`);
  assert(shares[1]!.revenueBeforeVat === 2_100, `A: 6/32 of 11200 = 2100, got ${shares[1]!.revenueBeforeVat}`);
  assert(shares[0]!.costBeforeVat === 8_125, `A: 26/32 of 10000 = 8125, got ${shares[0]!.costBeforeVat}`);
  assert(shares[1]!.costBeforeVat === 1_875, `A: 6/32 of 10000 = 1875, got ${shares[1]!.costBeforeVat}`);
}

{
  const afterAdd = redistributePackageChildren(
    [
      { id: "reel", quantity: 26 },
      { id: "post", quantity: 6 },
      { id: "story", quantity: 3 },
    ],
    PACKAGE
  );
  assert(
    packageChildRevenueSum(afterAdd) === PACKAGE.revenueBeforeVat,
    "B: adding a child does not change package revenue"
  );
  assert(
    packageChildCostSum(afterAdd) === PACKAGE.costBeforeVat,
    "B: adding a child does not change package cost"
  );
  assert(packageChildQuantitySum(afterAdd) === 35, "B: qty becomes 35");
  assert(afterAdd.length === 3, "B: three children");
  const reel = afterAdd.find((row) => row.id === "reel")!;
  const previousReel = 9_100;
  assert(reel.revenueBeforeVat !== previousReel, "B: existing reel share is reallocated");
}

{
  const afterQty = redistributePackageChildren(
    [
      { id: "reel", quantity: 30 },
      { id: "post", quantity: 6 },
    ],
    PACKAGE
  );
  assert(packageChildQuantitySum(afterQty) === 36, "C: qty 30+6=36");
  assert(
    packageChildRevenueSum(afterQty) === PACKAGE.revenueBeforeVat,
    "C: qty change does not change package revenue"
  );
  assert(
    packageChildCostSum(afterQty) === PACKAGE.costBeforeVat,
    "C: qty change does not change package cost"
  );
  assert(afterQty[0]!.revenueBeforeVat === 9_333.33, `C: 30/36 of 11200, got ${afterQty[0]!.revenueBeforeVat}`);
}

{
  const afterDelete = redistributePackageChildren([{ id: "reel", quantity: 26 }], PACKAGE);
  assert(afterDelete.length === 1, "D: one child remains");
  assert(afterDelete[0]!.revenueBeforeVat === PACKAGE.revenueBeforeVat, "D: remaining child takes full revenue");
  assert(afterDelete[0]!.costBeforeVat === PACKAGE.costBeforeVat, "D: remaining child takes full cost");
}

{
  const afterRev = redistributePackageChildren(
    [
      { id: "reel", quantity: 26 },
      { id: "post", quantity: 6 },
    ],
    { ...PACKAGE, revenueBeforeVat: 20_000 }
  );
  assert(packageChildRevenueSum(afterRev) === 20_000, "E: children follow new package revenue");
  assert(packageChildCostSum(afterRev) === PACKAGE.costBeforeVat, "E: cost unchanged when only revenue changes");
}

{
  const afterCost = redistributePackageChildren(
    [
      { id: "reel", quantity: 26 },
      { id: "post", quantity: 6 },
    ],
    { ...PACKAGE, costBeforeVat: 8_000 }
  );
  assert(packageChildCostSum(afterCost) === 8_000, "F: children follow new package cost");
  assert(
    packageChildRevenueSum(afterCost) === PACKAGE.revenueBeforeVat,
    "F: revenue unchanged when only cost changes"
  );
}

{
  const odd = splitPackageTotalsAcrossDeliverables(
    [
      { id: "a", quantity: 1 },
      { id: "b", quantity: 1 },
      { id: "c", quantity: 1 },
    ],
    { revenueBeforeVat: 100.01, costBeforeVat: 10 }
  );
  assert(packageChildRevenueSum(odd) === 100.01, "G: child revenue sum equals package after rounding");
  assert(packageChildCostSum(odd) === 10, "G: child cost sum equals package after rounding");
  const allocated = roundMoney(odd[0]!.revenueBeforeVat + odd[1]!.revenueBeforeVat);
  assert(
    odd[2]!.revenueBeforeVat === roundMoney(100.01 - allocated),
    "G: residual sits on the last child"
  );
}

{
  const applied = applyPackageTotalsToDeliverableRows(
    [
      { id: "reel", quantity: 26, extra: true },
      { id: "post", quantity: 6, extra: true },
    ],
    PACKAGE
  );
  assert(
    applied.reduce((sum, row) => sum + row.revenue_before_vat, 0) === PACKAGE.revenueBeforeVat,
    "apply helper keeps package revenue"
  );
  assert(applied[0]!.extra === true, "apply helper preserves row identity");
}

{
  const rows = packagePlatformsToCommercialRows(
    [
      {
        platform: "instagram",
        handle: "x",
        account_id: "a",
        profile_url: null,
        follower_count: null,
        engagement_rate: null,
        audience_country: null,
        deliverables: Array.from({ length: 26 }, () => "reel"),
      },
      {
        platform: "instagram",
        handle: "x",
        account_id: "a",
        profile_url: null,
        follower_count: null,
        engagement_rate: null,
        audience_country: null,
        deliverables: Array.from({ length: 6 }, () => "post"),
      },
    ],
    { totalRevenueBeforeVat: 11_200, totalCostBeforeVat: 10_000, dueDate: null }
  );
  const persistedRev = roundMoney(rows.reduce((sum, row) => sum + rowTotalRevenue(row), 0));
  assert(persistedRev === 11_200, `create path qty × unit recovers package rev, got ${persistedRev}`);
}

console.log("sync-package-deliverables: 9 passed");
