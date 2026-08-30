import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isVersionReleasedToClient,
  mergeReleasedToClientMetadata,
  versionReleaseMetadata,
} from "@/lib/services/deliverables/client-release";
import {
  CREATOR_ON_BEHALF_SUBMITTED_LABEL,
  CREATOR_ON_BEHALF_UPDATED_LABEL,
  DOCUMENTATION_VERSION_CONFLICT_MESSAGE,
  ON_BEHALF_SOURCE,
  creatorFacingOnBehalfLabel,
  isDocumentationVersionConflict,
  onBehalfAttributionFromMetadata,
  onBehalfEventPayload,
  onBehalfKindForVersionNumber,
  onBehalfMetadata,
} from "@/lib/services/deliverables/on-behalf";

describe("On-behalf attribution helpers", () => {
  it("labels version 1 as submitted and later versions as updated", () => {
    assert.equal(onBehalfKindForVersionNumber(1), "submit");
    assert.equal(onBehalfKindForVersionNumber(2), "update");
    assert.equal(
      creatorFacingOnBehalfLabel("submit"),
      CREATOR_ON_BEHALF_SUBMITTED_LABEL
    );
    assert.equal(
      creatorFacingOnBehalfLabel("update"),
      CREATOR_ON_BEHALF_UPDATED_LABEL
    );
    assert.equal(creatorFacingOnBehalfLabel(null), null);
  });

  it("stores Internal actor, creator, and kind without exposing Internal names", () => {
    const metadata = onBehalfMetadata({
      influencerId: "inf-1",
      actorUserId: "staff-9",
      kind: "update",
    });
    assert.equal(metadata.source, ON_BEHALF_SOURCE);
    assert.equal(metadata.on_behalf_of_influencer_id, "inf-1");
    assert.equal(metadata.on_behalf_actor_user_id, "staff-9");
    assert.equal(metadata.on_behalf_kind, "update");
    assert.equal(
      creatorFacingOnBehalfLabel("update")?.includes("staff-9"),
      false
    );
    assert.equal(CREATOR_ON_BEHALF_UPDATED_LABEL.includes("@"), false);

    const parsed = onBehalfAttributionFromMetadata(metadata);
    assert.deepEqual(parsed, {
      influencerId: "inf-1",
      actorUserId: "staff-9",
      kind: "update",
    });
    assert.equal(onBehalfAttributionFromMetadata({ source: "other" }), null);
  });

  it("records the same attribution on documentation events", () => {
    const payload = onBehalfEventPayload({
      influencerId: "inf-1",
      actorUserId: "staff-9",
      kind: "submit",
    });
    assert.equal(payload.source, ON_BEHALF_SOURCE);
    assert.equal(payload.on_behalf_of_influencer_id, "inf-1");
    assert.equal(payload.on_behalf_actor_user_id, "staff-9");
    assert.equal(payload.on_behalf_kind, "submit");
  });

  it("keeps on-behalf versions unreleased until Internal releases them", () => {
    const metadata = {
      ...versionReleaseMetadata(false),
      ...onBehalfMetadata({
        influencerId: "inf-1",
        actorUserId: "staff-9",
        kind: "submit",
      }),
    };
    assert.equal(isVersionReleasedToClient(metadata), false);
    assert.equal(
      isVersionReleasedToClient(
        mergeReleasedToClientMetadata(metadata, "2026-08-30T00:00:00.000Z")
      ),
      true
    );
  });

  it("treats unique version collisions as a refresh conflict", () => {
    assert.equal(isDocumentationVersionConflict({ code: "23505" }), true);
    assert.equal(
      isDocumentationVersionConflict({
        message: "duplicate key value violates unique constraint",
      }),
      true
    );
    assert.equal(
      isDocumentationVersionConflict({ code: "42501", message: "denied" }),
      false
    );
    assert.equal(
      DOCUMENTATION_VERSION_CONFLICT_MESSAGE.includes("Refresh"),
      true
    );
  });
});
