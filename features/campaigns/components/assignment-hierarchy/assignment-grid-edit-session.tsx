"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  assignmentGridSaveErrorMessage,
  runAssignmentGridFlushes,
  type AssignmentGridFlushFn,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-flush-runner";

export type {
  AssignmentGridFlushFn,
  AssignmentGridFlushResult,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-flush-runner";

type AssignmentGridEditSessionValue = {
  hasSession: boolean;
  isEditing: boolean;
  saving: boolean;
  discardEpoch: number;
  startEditing: () => void;
  cancelEditing: () => void;
  saveAll: () => Promise<void>;
  registerFlush: (id: string, flush: AssignmentGridFlushFn) => () => void;
};

const AssignmentGridEditSessionContext = createContext<AssignmentGridEditSessionValue>({
  hasSession: false,
  isEditing: false,
  saving: false,
  discardEpoch: 0,
  startEditing: () => {},
  cancelEditing: () => {},
  saveAll: async () => {},
  registerFlush: () => () => {},
});

export function AssignmentGridEditSessionProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardEpoch, setDiscardEpoch] = useState(0);
  const flushesRef = useRef(new Map<string, AssignmentGridFlushFn>());

  useEffect(() => {
    if (enabled) return;
    setIsEditing(false);
    setSaving(false);
  }, [enabled]);

  const registerFlush = useCallback((id: string, flush: AssignmentGridFlushFn) => {
    flushesRef.current.set(id, flush);
    return () => {
      if (flushesRef.current.get(id) === flush) {
        flushesRef.current.delete(id);
      }
    };
  }, []);

  const startEditing = useCallback(() => {
    if (!enabled || saving || isEditing) return;
    setIsEditing(true);
  }, [enabled, isEditing, saving]);

  const cancelEditing = useCallback(() => {
    if (!enabled || !isEditing || saving) return;
    setIsEditing(false);
    setDiscardEpoch((epoch) => epoch + 1);
  }, [enabled, isEditing, saving]);

  const saveAll = useCallback(async () => {
    if (!enabled || !isEditing || saving) return;
    setSaving(true);
    try {
      const results = await runAssignmentGridFlushes(flushesRef.current.values());
      const errors = results.filter((result) => !result.ok);
      if (errors.length > 0) {
        toast.error(assignmentGridSaveErrorMessage(errors));
        return;
      }

      setIsEditing(false);
      toast.success("Assignments saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [enabled, isEditing, router, saving]);

  const value = useMemo<AssignmentGridEditSessionValue>(
    () => ({
      hasSession: enabled,
      isEditing: enabled && isEditing,
      saving,
      discardEpoch,
      startEditing,
      cancelEditing,
      saveAll,
      registerFlush,
    }),
    [
      cancelEditing,
      discardEpoch,
      enabled,
      isEditing,
      registerFlush,
      saveAll,
      saving,
      startEditing,
    ]
  );

  return (
    <AssignmentGridEditSessionContext.Provider value={value}>
      {children}
    </AssignmentGridEditSessionContext.Provider>
  );
}

export function useAssignmentGridEditSession(): AssignmentGridEditSessionValue {
  return useContext(AssignmentGridEditSessionContext);
}

/** Red Edit/Cancel · green Save — unlocks the grid, then persist or discard in one shot. */
export function AssignmentGridEditSessionToolbar() {
  const { hasSession, isEditing, saving, startEditing, cancelEditing, saveAll } =
    useAssignmentGridEditSession();

  if (!hasSession) return null;

  return (
    <>
      {isEditing ? (
        <button
          type="button"
          className="thinkway-campaign-btn thinkway-campaign-btn-edit"
          onClick={cancelEditing}
          disabled={saving}
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          className="thinkway-campaign-btn thinkway-campaign-btn-edit"
          onClick={startEditing}
          disabled={saving}
        >
          Edit
        </button>
      )}
      <button
        type="button"
        className="thinkway-campaign-btn thinkway-campaign-btn-save"
        onClick={() => {
          void saveAll();
        }}
        disabled={!isEditing || saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </>
  );
}
