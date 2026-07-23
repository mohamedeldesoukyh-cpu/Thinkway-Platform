import assert from "node:assert/strict";

import {
  isAvatarEnrichmentScope,
  isDurableCreatorAvatarUrl,
  resolveApifyAvatarPersistOptions,
  resolveNextPrimaryAvatar,
} from "@/lib/creator-enrichment/enrichment-avatar-policy";

assert.equal(isAvatarEnrichmentScope("all"), true);
assert.equal(isAvatarEnrichmentScope("avatar"), true);
assert.equal(isAvatarEnrichmentScope("metrics"), false);
assert.equal(isAvatarEnrichmentScope(undefined), true, "default scope is all");

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "metrics",
    force: true,
    bypassMetricsManualOverride: true,
    forceAvatarReplace: false,
  }),
  { forceSync: false, forceAvatarReplace: false },
  "shortlist Refresh Metrics: persist allowed, policy not bypassed"
);

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "avatar",
    force: true,
    bypassMetricsManualOverride: false,
    forceAvatarReplace: true,
  }),
  { forceSync: true, forceAvatarReplace: true },
  "Refresh Avatar: force policy bypass and replace"
);

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "all",
    force: true,
    bypassMetricsManualOverride: true,
    forceAvatarReplace: true,
  }),
  { forceSync: true, forceAvatarReplace: true },
  "Refresh All: full avatar sync"
);

const DURABLE =
  "https://abc.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/instagram/creator.jpg";
const DURABLE_IMPORT =
  "https://abc.supabase.co/storage/v1/object/public/creator-avatars/imports/file/instagram/creator.jpg";
const CDN = "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg";
const expiredOe = Math.floor(Date.now() / 1000 - 3600).toString(16);
const EXPIRED_CDN = `https://scontent.cdninstagram.com/v/t51.2885-19/expired.jpg?oe=${expiredOe}`;

assert.equal(isDurableCreatorAvatarUrl(DURABLE), true);
assert.equal(isDurableCreatorAvatarUrl(CDN), false);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: DURABLE,
    existingSource: "uploaded",
    incomingUrl: null,
    incomingSource: null,
  }),
  { url: DURABLE, source: "uploaded" },
  "never clear existing avatar when enrichment returns no avatar"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: DURABLE,
    existingSource: "uploaded",
    incomingUrl: null,
    incomingSource: "placeholder",
  }),
  { url: DURABLE, source: "uploaded" },
  "placeholder resolution must not wipe a captured avatar"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: DURABLE,
    existingSource: "uploaded",
    incomingUrl: CDN,
    incomingSource: "instagram",
  }),
  { url: DURABLE, source: "uploaded" },
  "prefer durable storage over expiring CDN"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: EXPIRED_CDN,
    existingSource: "instagram",
    incomingUrl: DURABLE,
    incomingSource: "uploaded",
  }),
  { url: DURABLE, source: "uploaded" },
  "replace expired CDN with durable enrichment upload"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: DURABLE_IMPORT,
    existingSource: "uploaded",
    incomingUrl: DURABLE,
    incomingSource: "uploaded",
  }),
  { url: DURABLE, source: "uploaded" },
  "prefer enrichment upload over PDF import crop"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: "https://cdn.example/manual.jpg",
    existingSource: "manual",
    incomingUrl: DURABLE,
    incomingSource: "uploaded",
  }),
  { url: "https://cdn.example/manual.jpg", source: "manual" },
  "manual avatars are never replaced by enrichment"
);

assert.deepEqual(
  resolveNextPrimaryAvatar({
    existingUrl: EXPIRED_CDN,
    existingSource: "instagram",
    incomingUrl: null,
    incomingSource: null,
  }),
  { url: EXPIRED_CDN, source: "instagram" },
  "keep last captured avatar even when it is an expired CDN URL"
);

console.log("enrichment-avatar-policy tests passed");
