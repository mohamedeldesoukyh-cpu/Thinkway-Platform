/**
 * A resolved creator avatar must not churn across hydration waves.
 *
 * `CreatorAvatarImage` renders `/api/creators/avatar?src=…&profileUrl=…`, and
 * `useMediaProxyImageRecovery` resets its retry counter AND its `exhausted`
 * latch on `[baseSrc]`. Studio hydration runs three waves and `mergeVendorWaves`
 * let the later wave win on `avatarUrl`/`profileUrl`, while
 * `backfillMissingAvatars` re-fetched any vendor missing EITHER field.
 *
 * So a creator whose avatar was already correct in wave 1 but whose profileUrl
 * arrived in wave 3 got a different src string — the retry sequence restarted
 * from zero and the <img key> remounted. That is the visible flash/reload loop,
 * and because `exhausted` was cleared before it could latch, the stable
 * fallback never appeared either.
 *
 * The churn is proven here against the real URL builder, not asserted.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";

import { preserveResolvedAvatar } from "../services/creator-avatar-stability";

/** A Discovery-stored Instagram CDN avatar and its profile URL. */
const AVATAR =
  "https://scontent-cdg4-2.cdninstagram.com/v/t51.2885-19/12345_n.jpg?_nc_ht=scontent.cdninstagram.com&oh=abc&oe=6790";
const PROFILE = "https://www.instagram.com/farahroushdy/";

/** What the avatar component actually feeds the recovery hook. */
function baseSrc(vendor: { avatarUrl?: string; profileUrl?: string }): string | null {
  return creatorAvatarBrowserDisplayUrl(vendor.avatarUrl, vendor.profileUrl);
}

test("the churn is real: adding profileUrl alone changes the rendered src", () => {
  const before = baseSrc({ avatarUrl: AVATAR });
  const after = baseSrc({ avatarUrl: AVATAR, profileUrl: PROFILE });

  assert.ok(before && after);
  assert.notEqual(
    before,
    after,
    "guard: if these matched there would be no reset and nothing to fix"
  );
  // Same inputs are stable, so the reset is caused by the input change alone.
  assert.equal(baseSrc({ avatarUrl: AVATAR, profileUrl: PROFILE }), after);
});

test("a wave that only adds profileUrl no longer changes the rendered src", () => {
  const wave1 = { avatarUrl: AVATAR, profileUrl: undefined };
  const wave3 = { avatarUrl: AVATAR, profileUrl: PROFILE };

  const merged = preserveResolvedAvatar(wave1, wave3);

  assert.equal(merged.avatarUrl, AVATAR);
  assert.equal(merged.profileUrl, undefined, "the settled pair is kept together");
  assert.equal(
    baseSrc(merged),
    baseSrc(wave1),
    "the src the browser loads is unchanged, so the retry state is never reset"
  );
});

test("a different avatar from a later wave still cannot replace a resolved one", () => {
  const merged = preserveResolvedAvatar(
    { avatarUrl: AVATAR, profileUrl: PROFILE },
    { avatarUrl: "https://cdn.example.com/other.jpg", profileUrl: "https://x.test/other" }
  );

  assert.equal(merged.avatarUrl, AVATAR);
  assert.equal(merged.profileUrl, PROFILE);
});

test("a creator with no avatar yet takes the later wave — src and profileUrl together", () => {
  const merged = preserveResolvedAvatar(
    { avatarUrl: undefined, profileUrl: undefined },
    { avatarUrl: AVATAR, profileUrl: PROFILE }
  );

  assert.equal(merged.avatarUrl, AVATAR);
  assert.equal(
    merged.profileUrl,
    PROFILE,
    "taking src without its profileUrl would only churn again on the next wave"
  );
  assert.equal(baseSrc(merged), baseSrc({ avatarUrl: AVATAR, profileUrl: PROFILE }));
});

test("a wave with nothing to add leaves an unresolved creator unresolved", () => {
  const merged = preserveResolvedAvatar(
    { avatarUrl: undefined, profileUrl: PROFILE },
    { avatarUrl: undefined, profileUrl: undefined }
  );

  assert.equal(merged.avatarUrl, undefined, "no avatar is invented");
  assert.equal(merged.profileUrl, PROFILE, "and the profile it did have is kept");
});

test("the merged pair is stable when applied repeatedly — no oscillation", () => {
  // Waves 2 and 3 both run; applying the rule again must be a no-op.
  const once = preserveResolvedAvatar(
    { avatarUrl: AVATAR, profileUrl: undefined },
    { avatarUrl: AVATAR, profileUrl: PROFILE }
  );
  const twice = preserveResolvedAvatar(once, {
    avatarUrl: AVATAR,
    profileUrl: PROFILE,
  });

  assert.deepEqual(twice, once);
  assert.equal(baseSrc(twice), baseSrc(once));
});
