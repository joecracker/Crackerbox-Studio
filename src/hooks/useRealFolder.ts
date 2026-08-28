import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoFile } from "../data/demoFiles";
import {
  pickFolderHandle,
  readHandleToTree,
  supportsFolderPicker,
  writeTreeToHandle,
} from "../utils/realFolder";
import {
  idbDeleteFolderHandle,
  idbLoadFolderHandle,
  idbSaveFolderHandle,
} from "./useProjectStore";

interface UseRealFolderOptions {
  activeProjectId: string;
  activeFiles: DemoFile[];
  updateActiveFiles: (updater: (files: DemoFile[]) => DemoFile[]) => void;
  markDirty: (projectId: string) => void;
}

export interface RealFolderControls {
  supported: boolean;
  handle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  link: () => Promise<boolean>;
  save: () => Promise<boolean>;
  unlink: () => void;
}

export function useRealFolder({
  activeProjectId,
  activeFiles,
  updateActiveFiles,
  markDirty,
}: UseRealFolderOptions): RealFolderControls {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await idbLoadFolderHandle(activeProjectId);
      if (cancelled || !stored) return;
      let allowed = false;
      try {
        const status = await (stored as unknown as {
          queryPermission?: (options?: { mode?: string }) => Promise<PermissionState>;
        }).queryPermission?.({ mode: "readwrite" });
        allowed = status === "granted";
      } catch {
        allowed = false;
      }
      if (allowed) {
        setHandle(stored);
        setFolderName(stored.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const link = useCallback(async (): Promise<boolean> => {
    if (!supportsFolderPicker()) {
      setError("Real-folder access isn't supported in this browser.");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const picked = await pickFolderHandle();
      if (!picked) return false;
      const tree = await readHandleToTree(picked);
      updateActiveFiles(() => tree);
      markDirty(activeProjectId);
      setHandle(picked);
      setFolderName(picked.name);
      void idbSaveFolderHandle(activeProjectId, picked);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open folder.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, updateActiveFiles, markDirty]);

  const save = useCallback(async (): Promise<boolean> => {
    const h = handleRef.current;
    if (!h) {
      setError("No linked folder — open a folder first.");
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await writeTreeToHandle(h, activeFiles);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save to folder.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [activeFiles]);

  const unlink = useCallback(() => {
    setHandle(null);
    setFolderName(null);
    setError(null);
    void idbDeleteFolderHandle(activeProjectId);
  }, [activeProjectId]);

  return {
    supported: supportsFolderPicker(),
    handle,
    folderName,
    loading,
    saving,
    error,
    link,
    save,
    unlink,
  };
}
