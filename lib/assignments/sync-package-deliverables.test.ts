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

console.log("sync-package-deliverables: 2 passed");
