"use server";

import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
  ClientReviewDecisionStage,
} from "../constants";
import { freezeCreatorBriefIfNeeded, briefFromSnapshotCreator } from "../creator-brief";
import { resolveClientReviewByToken } from "../load-client-workspace";
import {
  addClientComment,
  confirmClientCreators,
  decideClientReview,
  removeUnpricedSelectedCreators,
  requestClientChanges,
  sendClientQuotationEmail,
  setBulkCreatorSelection,
  setCreatorSelection,
  acknowledgeClientUpdate,
} from "../review-mutations";
import type { ClientCreatorBrief } from "../types";

export async function selectCreatorAction(input: {
  token: string;
  creatorId: string;
  state: ClientCreatorSelectionState;
  creatorName?: string;
  reason?: string;
}) {
  return setCreatorSelection(input);
}

export async function bulkSelectCreatorsAction(input: {
  token: string;
  state: ClientCreatorSelectionState;
  creatorIds?: string[];
}) {
  return setBulkCreatorSelection(input);
}

export async function addReviewCommentAction(input: {
  token: string;
  targetType: ClientCommentTargetType;
  targetId?: string | null;
  message: string;
  stage?: ClientReviewDecisionStage;
}) {
  return addClientComment(input);
}

export async function requestReviewChangesAction(input: {
  token: string;
  summary: string;
  areas: ClientChangeArea[];
  stage?: ClientReviewDecisionStage;
}) {
  return requestClientChanges(input);
}

export async function confirmCreatorsAction(input: { token: string }) {
  return confirmClientCreators(input);
}

export async function removeUnpricedSelectedAction(input: { token: string }) {
  return removeUnpricedSelectedCreators(input);
}

export async function decideReviewAction(input: {
  token: string;
  decision: "approved" | "rejected";
  actorLabel?: string;
  reason?: string;
  stage?: ClientReviewDecisionStage;
}) {
  return decideClientReview(input);
}

export async function acknowledgeReviewUpdateAction(input: { token: string }): Promise<{ ok: boolean }> {
  return acknowledgeClientUpdate(input);
}

export async function sendClientQuotationAction(input: {
  token: string;
  email: string;
}): Promise<{ ok: boolean; message: string }> {
  return sendClientQuotationEmail(input);
}

export async function loadCreatorBriefAction(input: {
  token: string;
  creatorId: string;
}): Promise<{ ok: true; brief: ClientCreatorBrief } | { ok: false; message: string }> {
  const service = tryCreateServiceRoleClient().client;
  if (!service) return { ok: false, message: "Creator detail is temporarily unavailable." };
  const resolved = await resolveClientReviewByToken(service, input.token);
  if (!resolved.ok) return { ok: false, message: "This review link is invalid or has expired." };
  const snapshotCreator = resolved.review.sourceSnapshot?.creators.find(
    (creator) => creator.creatorId === input.creatorId
  );
  if (!snapshotCreator) return { ok: false, message: "Creator not found in this review." };
  try {
    const brief = await freezeCreatorBriefIfNeeded(resolved.review, input.creatorId);
    if (brief) return { ok: true, brief };
    return { ok: true, brief: briefFromSnapshotCreator(snapshotCreator) };
  } catch {
    return { ok: true, brief: briefFromSnapshotCreator(snapshotCreator) };
  }
}
