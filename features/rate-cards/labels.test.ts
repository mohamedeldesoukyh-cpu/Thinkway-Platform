import assert from "node:assert/strict";
import test from "node:test";
import {errorLabel, labels} from "./labels";

test("import failures expose safe, actionable labels without database details",()=>{
 assert.equal(errorLabel(new Error("canceling statement due to statement timeout")),"importTimeout");
 assert.match(labels.importTimeout[0],/rolled back/);
 assert.equal(errorLabel(new Error("stale")),"stale");
 assert.equal(errorLabel(new Error("permission denied for table rate_card_lines")),"permission");
 assert.equal(errorLabel(new Error("duplicate key value violates unique constraint")),"duplicateError");
 assert.equal(errorLabel(new Error("private database implementation detail")),"error");
});
