import assert from "node:assert/strict";
import test from "node:test";
import { builtinReportIdForPath, canSeeBuiltinReport, builtinReportSchema } from "./builtin-report-settings";
test("built-in restrictions cover pages, exports and nested statement routes", () => {
  assert.equal(builtinReportIdForPath("/reports/statements/client/123"),"statements");
  assert.equal(builtinReportIdForPath("/api/reports/pnl/document"),"pnl");
  assert.equal(builtinReportIdForPath("/reports/settings"),null);
  assert.equal(builtinReportIdForPath("/reports/custom"),null);
  assert.equal(builtinReportIdForPath("/reports/pnl-fake"),null);
});
test("visibility allows selected users and administrators but denies other users", () => {
  const rule={visibility:"users" as const,shared_with:["allowed"]};
  assert.equal(canSeeBuiltinReport(rule,"allowed",false),true);
  assert.equal(canSeeBuiltinReport(rule,"other",false),false);
  assert.equal(canSeeBuiltinReport(rule,"other",true),true);
  assert.equal(canSeeBuiltinReport({...rule,visibility:"all"},"other",false),true);
});
test("restricted built-in settings require recipients and cannot introduce other routes", () => {
  const input={id:"pnl",name:"P&L",description:"",currency:"EGP",visibility:"users",shared_with:[]};
  assert.equal(builtinReportSchema.safeParse(input).success,false);
  assert.equal(builtinReportSchema.safeParse({...input,visibility:"all"}).success,true);
  assert.equal(builtinReportSchema.safeParse({...input,id:"settings",visibility:"all"}).success,false);
});
