/**
 * Run: npx tsx lib/assignments/sync-package-deliverables.test.ts
 */
import { splitPackageTotalsAcrossDeliverables } from "@/lib/assignments/sync-package-deliverables";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

{
  const shares = splitPackageTotalsAcrossDeliverables(
    [
      { id: "reel", quantity: 1 },
      { id: "story", quantity: 1 },
    ],
    { revenueBeforeVat: 11_200, costBeforeVat: 10_000 }
  );
  assert(shares[0]!.unitRevenue === 5_600, `expected 5600 rev/ad, got ${shares[0]!.unitRevenue}`);
  assert(shares[1]!.unitRevenue === 5_600, `expected 5600 rev/ad on story, got ${shares[1]!.unitRevenue}`);
  assert(
    shares.reduce((sum, row) => sum + row.revenueBeforeVat, 0) === 11_200,
    "child revenue must match package total"
  );
  assert(
    shares.reduce((sum, row) => sum + row.costBeforeVat, 0) === 10_000,
    "child cost must match package total"
  );
}

{
  const shares = splitPackageTotalsAcrossDeliverables(
    [
      { id: "reel", quantity: 2 },
      { id: "story", quantity: 1 },
    ],
    { revenueBeforeVat: 11_200, costBeforeVat: 10_000 }
  );
  const childRev = shares.reduce((sum, row) => sum + row.revenueBeforeVat, 0);
  const childCost = shares.reduce((sum, row) => sum + row.costBeforeVat, 0);
  assert(childRev === 11_200, `qty-weighted revenue should stay 11200, got ${childRev}`);
  assert(childCost === 10_000, `qty-weighted cost should stay 10000, got ${childCost}`);
  assert(shares[0]!.quantity === 2, "reel keeps qty 2");
  assert(shares[0]!.unitRevenue === 3_733.34, `expected reel rev/ad 3733.34, got ${shares[0]!.unitRevenue}`);
}

{
  const shares = splitPackageTotalsAcrossDeliverables(
    [
      { id: "story", quantity: 26 },
      { id: "reel", quantity: 6 },
    ],
    {
      revenueBeforeVat: 32_000,
      costBeforeVat: 16_000,
      usageRightsAmount: 3_200,
      usageRightsCost: 1_600,
      agencyFeePercent: 10,
    }
  );
  const story = shares[0]!;
  const reel = shares[1]!;
  assert(story.revenueBeforeVat === 26_000, `stories rev should be 26000, got ${story.revenueBeforeVat}`);
  assert(reel.revenueBeforeVat === 6_000, `reels rev should be 6000, got ${reel.revenueBeforeVat}`);
  assert(story.costBeforeVat === 13_000, `stories cost should be 13000, got ${story.costBeforeVat}`);
  assert(reel.costBeforeVat === 3_000, `reels cost should be 3000, got ${reel.costBeforeVat}`);
  assert(story.usageRightsAmount === 2_600, `stories UR should be 2600, got ${story.usageRightsAmount}`);
  assert(reel.usageRightsAmount === 600, `reels UR should be 600, got ${reel.usageRightsAmount}`);
  assert(story.usageRightsCost === 1_300, `stories UR cost should be 1300, got ${story.usageRightsCost}`);
  assert(reel.usageRightsCost === 300, `reels UR cost should be 300, got ${reel.usageRightsCost}`);
  assert(story.agencyFeePercent === 10 && reel.agencyFeePercent === 10, "AF% stays on every child");
  assert(story.unitRevenue === 1_000 && reel.unitRevenue === 1_000, "Rev/Ad is equal per unit");
  assert(
    shares.reduce((sum, row) => sum + row.revenueBeforeVat, 0) === 32_000,
    "child revenue must match package total"
  );
  assert(
    shares.reduce((sum, row) => sum + row.usageRightsAmount, 0) === 3_200,
    "child UR must match package total"
  );
}

console.log("sync-package-deliverables: 3 passed");
