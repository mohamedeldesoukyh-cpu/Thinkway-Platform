/**
 * Run: npx tsx lib/billing/package-commercial-sync.test.ts
 */
import { shouldDistributeLineCommercialToDeliverables } from "@/lib/billing/repair-invoice-create-pipeline";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testPackageLineAlwaysDistributes() {
  assert(
    shouldDistributeLineCommercialToDeliverables(
      { pricing_mode: "package", revenue_before_vat: 150000, revenue: 150000 },
      0
    ),
    "package lines should always distribute line commercial downstream"
  );
}

function testPerDeliverableSkipsWhenChildrenHaveRevenue() {
  assert(
    !shouldDistributeLineCommercialToDeliverables(
      { pricing_mode: "per_deliverable", revenue_before_vat: 100000, revenue: 100000 },
      95000
    ),
    "per_deliverable lines should not overwrite children when revenue already matches"
  );
}

function testPerDeliverableDistributesWhenChildrenZeroed() {
  assert(
    shouldDistributeLineCommercialToDeliverables(
      { pricing_mode: "per_deliverable", revenue_before_vat: 100000, revenue: 100000 },
      0
    ),
    "per_deliverable lines should distribute when child revenue was zeroed"
  );
}

const tests = [
  testPackageLineAlwaysDistributes,
  testPerDeliverableSkipsWhenChildrenHaveRevenue,
  testPerDeliverableDistributesWhenChildrenZeroed,
];

for (const run of tests) {
  run();
}

console.log(`package-commercial-sync.test.ts: ${tests.length} passed`);
