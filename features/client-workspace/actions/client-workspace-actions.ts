"use server";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
} from "../constants";
import {
  addClientComment,
  decideClientReview,
  requestClientChanges,
  setBulkCreatorSelection,
  setCreatorSelection,
} from "../review-mutations";

export async function selectCreatorAction(input: {
  token: string;
  creatorId: string;
  state: ClientCreatorSelectionState;
  creatorName?: string;
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
}) {
  return addClientComment(input);
}

export async function requestReviewChangesAction(input: {
  token: string;
  summary: string;
  areas: ClientChangeArea[];
}) {
  return requestClientChanges(input);
}

export async function decideReviewAction(input: {
  token: string;
  decision: "approved" | "rejected";
  actorLabel?: string;
}) {
  return decideClientReview(input);
}
