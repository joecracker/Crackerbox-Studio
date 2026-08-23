import { useCallback, useMemo } from "react";
import { usePersistentState } from "./usePersistentState";

interface QueueState {
  /** projectId -> ISO timestamp of the first unsent change */
  entries: Record<string, string>;
}

const KEY = "crackerbox.deploy.queue";
const EMPTY: QueueState = { entries: {} };

export interface DeployQueue {
  entries: Record<string, string>;
  dirtyIds: string[];
  count: number;
  isDirty: (projectId: string) => boolean;
  changedAt: (projectId: string) => string | null;
  markDirty: (projectId: string) => void;
  clearDirty: (projectId: string) => void;
}

/**
 * Tracks which projects have changes waiting to be pushed. Persisted so an
 * unsent batch survives reloads and gets picked up by the next deploy window.
 */
export function useDeployQueue(): DeployQueue {
  const [state, setState] = usePersistentState<QueueState>(KEY, EMPTY);

  const markDirty = useCallback(
    (projectId: string) =>
      setState((prev) =>
        prev.entries[projectId]
          ? prev
          : { entries: { ...prev.entries, [projectId]: new Date().toISOString() } }
      ),
    [setState]
  );

  const clearDirty = useCallback(
    (projectId: string) =>
      setState((prev) => {
        if (!(projectId in prev.entries)) return prev;
        const entries = { ...prev.entries };
        delete entries[projectId];
        return { entries };
      }),
    [setState]
  );

  const dirtyIds = useMemo(() => Object.keys(state.entries), [state.entries]);

  const isDirty = useCallback((projectId: string) => projectId in state.entries, [state.entries]);

  const changedAt = useCallback(
    (projectId: string) => state.entries[projectId] ?? null,
    [state.entries]
  );

  return {
    entries: state.entries,
    dirtyIds,
    count: dirtyIds.length,
    isDirty,
    changedAt,
    markDirty,
    clearDirty,
  };
}
