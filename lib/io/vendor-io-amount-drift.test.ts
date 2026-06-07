/**
 * Run: npx tsx lib/io/vendor-io-amount-drift.test.ts
 */
import {
  lineCostDriftsFromVendorIoAmount,
  vendorIoAmountDriftsFromLineCost,
} from "@/lib/io/vendor-io-amount-drift";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testDetectsDrift() {
  assert(
    vendorIoAmountDriftsFromLineCost(2500, 2000),
    "2500 cost vs 2000 VIO should drift"
  );
  assert(
    !vendorIoAmountDriftsFromLineCost(2500, 2500),
    "matching amounts should not drift"
  );
}

function testLineHelper() {
  assert(
    lineCostDriftsFromVendorIoAmount({
      cost_before_vat: 2500,
      vendor_io_amount: 2000,
    }),
    "line helper should detect drift from cost"
  );
}

testDetectsDrift();
testLineHelper();
console.log("vendor-io-amount-drift: 2 passed");
