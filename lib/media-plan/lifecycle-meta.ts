import type { MediaPlanStatus, MediaPlanVersionKind } from "./types";

/**
 * Persisted on `CampaignObject.meta.mediaPlanLifecycle`.
 * Working tip schedule remains `meta.mediaPlanSchedule` (Studio generators read it).
 * Approved baselines are frozen in `approvedScheduleSnapshots`.
 */
export type MediaPlanLifecycleHistoryEntry = {
  version: number;
  kind: MediaPlanVersionKind;
  status: MediaPlanStatus;
  at: string;
  label?: string | null;
  actorUserId?: string | null;
};

export type MediaPlanLifecycleMeta = {
  status: MediaPlanStatus;
  currentApprovedBaselineVersion: number | null;
  workingDraftVersion: number | null;
  /** Frozen schedule snapshots keyed by version number (string). Never mutate in place. */
  approvedScheduleSnapshots: Record<string, unknown>;
  lockedAt?: string | null;
  lockedBy?: string | null;
  history: MediaPlanLifecycleHistoryEntry[];
};

export function createDefaultMediaPlanLifecycle(at: string): MediaPlanLifecycleMeta {
  return {
    status: "draft",
    currentApprovedBaselineVersion: null,
    workingDraftVersion: 1,
    approvedScheduleSnapshots: {},
    lockedAt: null,
    lockedBy: null,
    history: [
      {
        version: 1,
        kind: "draft",
        status: "draft",
        at,
        label: "Initial draft",
      },
    ],
  };
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
