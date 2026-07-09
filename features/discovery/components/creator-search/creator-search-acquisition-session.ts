"use client";

import {
  acquisitionSessionHeartbeatAction,
  cancelAcquisitionSessionAction,
} from "@/features/campaigns/creator-discovery-actions";

const SESSION_API_PATH = "/api/discovery/acquisition/session";

export function createSearchSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function sendAcquisitionSessionHeartbeat(
  searchSessionId: string
): Promise<number> {
  try {
    const result = await acquisitionSessionHeartbeatAction(searchSessionId);
    return result.heartbeatIntervalMs;
  } catch {
    return 15_000;
  }
}

export function cancelAcquisitionSessionBeacon(searchSessionId: string): void {
  if (!searchSessionId.trim() || typeof navigator === "undefined") return;
  const payload = JSON.stringify({
    action: "cancel",
    searchSessionId: searchSessionId.trim(),
  });
  const blob = new Blob([payload], { type: "application/json" });
  navigator.sendBeacon(SESSION_API_PATH, blob);
}

export async function cancelAcquisitionSessionClient(
  searchSessionId: string
): Promise<void> {
  if (!searchSessionId.trim()) return;
  try {
    await cancelAcquisitionSessionAction(searchSessionId.trim());
  } catch {
    cancelAcquisitionSessionBeacon(searchSessionId);
  }
}

export type AcquisitionSessionController = {
  getSessionId: () => string;
  rotateSession: () => Promise<string>;
  startHeartbeat: () => void;
  stopHeartbeat: () => void;
  cancelSession: () => Promise<void>;
  dispose: () => void;
};

export function createAcquisitionSessionController(
  initialSessionId?: string
): AcquisitionSessionController {
  let sessionId = initialSessionId?.trim() || createSearchSessionId();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatIntervalMs = 15_000;

  const touch = () => {
    void sendAcquisitionSessionHeartbeat(sessionId).then((interval) => {
      heartbeatIntervalMs = interval;
    });
  };

  return {
    getSessionId: () => sessionId,
    rotateSession: async () => {
      await cancelAcquisitionSessionClient(sessionId);
      sessionId = createSearchSessionId();
      touch();
      return sessionId;
    },
    startHeartbeat: () => {
      if (heartbeatTimer) return;
      touch();
      heartbeatTimer = setInterval(touch, heartbeatIntervalMs);
    },
    stopHeartbeat: () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
    cancelSession: () => cancelAcquisitionSessionClient(sessionId),
    dispose: () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      cancelAcquisitionSessionBeacon(sessionId);
    },
  };
}
