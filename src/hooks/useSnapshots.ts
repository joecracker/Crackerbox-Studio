import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoFile } from "../data/demoFiles";
import {
  idbDeleteSnapshots,
  idbLoadSnapshots,
  idbSaveSnapshots,
} from "./useProjectStore";
import type { ProjectSnapshot } from "./useProjectStore";

const MAX_SNAPSHOTS = 20;
const AUTO_DEBOUNCE_MS = 4000;

export { AUTO_DEBOUNCE_MS };

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function filesKey(files: DemoFile[]): string {
  return JSON.stringify(files);
}

export function useSnapshots(projectId: string) {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const lastKeyRef = useRef<string>("");

  const refresh = useCallback(async () => {
    const list = await idbLoadSnapshots(projectId);
    lastKeyRef.current = list[0] ? filesKey(list[0].files) : "";
    setSnapshots(list);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    setLoaded(false);
    setSnapshots([]);
    lastKeyRef.current = "";
    void refresh();
  }, [refresh]);

  const capture = useCallback(
    async (files: DemoFile[], note?: string): Promise<void> => {
      const key = filesKey(files);
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      setCapturing(true);
      try {
        const list = await idbLoadSnapshots(projectId);
        const next: ProjectSnapshot[] = [
          { id: createId(), projectId, files, createdAt: Date.now(), note },
          ...list,
        ].slice(0, MAX_SNAPSHOTS);
        await idbSaveSnapshots(projectId, next);
        setSnapshots(next);
      } finally {
        setCapturing(false);
      }
    },
    [projectId]
  );

  const remove = useCallback(
    async (id: string) => {
      const next = snapshots.filter((s) => s.id !== id);
      await idbSaveSnapshots(projectId, next);
      lastKeyRef.current = next[0] ? filesKey(next[0].files) : "";
      setSnapshots(next);
    },
    [projectId, snapshots]
  );

  const clear = useCallback(async () => {
    await idbDeleteSnapshots(projectId);
    lastKeyRef.current = "";
    setSnapshots([]);
  }, [projectId]);

  const autoCapture = useCallback(
    (files: DemoFile[]) => {
      const key = filesKey(files);
      if (key === lastKeyRef.current) return;
      void capture(files, "auto");
    },
    [capture]
  );

  return { snapshots, loaded, capturing, capture, remove, clear, autoCapture };
}

export type SnapshotController = ReturnType<typeof useSnapshots>;