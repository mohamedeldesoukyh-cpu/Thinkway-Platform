/**
 * Run: npx tsx lib/io/vendor-io-line-amount.test.ts
 */
import {
  resolveVendorIoLineAmount,
  sumVendorIoLineAmounts,
} from "@/lib/io/vendor-io-line-amount";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testUsesCostBeforeRevenue() {
  assert(
    resolveVendorIoLineAmount({
      cost_before_vat: 2500,
      revenue_before_vat: 6000,
    }) === 2500,
    "vendor IO amount should use creator cost"
  );
}

function testSumsLineCosts() {
  assert(
    sumVendorIoLineAmounts([
      { cost_before_vat: 1000, revenue_before_vat: 3000 },
      { cost_before_vat: 1500, revenue_before_vat: 3000 },
    ]) === 2500,
    "batch vendor IO amount should sum line costs"
  );
}

testUsesCostBeforeRevenue();
testSumsLineCosts();
console.log("vendor-io-line-amount: 2 passed");
