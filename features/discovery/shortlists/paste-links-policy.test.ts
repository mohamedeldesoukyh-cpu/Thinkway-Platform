import assert from "node:assert/strict";

import { MAX_SHORTLIST_PASTE_CREATORS } from "@/lib/discovery/add-creator-constants";
import {
  describeShortlistPasteAddOutcome,
  describeShortlistPastePreview,
  looksLikePastedProfileList,
  shortlistPastePreview,
} from "./paste-links-policy";

const preview = shortlistPastePreview(3, 1);
assert.equal(preview.addableCount, 3);
assert.equal(preview.overflowCount, 0);
assert.equal(
  describeShortlistPastePreview(preview),
  "3 profiles detected · 1 unrecognized link"
);

const overflow = shortlistPastePreview(MAX_SHORTLIST_PASTE_CREATORS + 4, 0);
assert.equal(overflow.addableCount, MAX_SHORTLIST_PASTE_CREATORS);
assert.equal(overflow.overflowCount, 4);
assert.ok(describeShortlistPastePreview(overflow).includes("first 50 will be added"));

assert.equal(
  describeShortlistPasteAddOutcome({
    added: 12,
    alreadyOnList: 3,
    created: 2,
    existing: 13,
    failed: 1,
    invalid: 0,
  }),
  "12 added · 3 already on list · 2 new in Discovery · 1 failed"
);

assert.equal(
  looksLikePastedProfileList("https://instagram.com/a\nhttps://tiktok.com/@b"),
  true
);
assert.equal(looksLikePastedProfileList("@one @two"), true);
assert.equal(looksLikePastedProfileList("https://instagram.com/jane"), false);
assert.equal(looksLikePastedProfileList("fatma travel"), false);
assert.equal(looksLikePastedProfileList("reem"), false);

console.log("features/discovery/shortlists/paste-links-policy.test.ts — all tests passed");
