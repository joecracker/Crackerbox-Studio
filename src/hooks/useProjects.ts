import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { demoFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";
import type { ImportResult } from "../utils/importer";
import {
  idbDeleteProjectFiles,
  idbLoadProjectFiles,
  idbSaveProjectFiles,
} from "./useProjectStore";

export interface Project {
  id: string;
  name: string;
  origin: "seed" | "import";
  /** true = opened from outside the home network (needs a host like Cloudflare); false = served locally by Home Assistant (GitHub backup only). */
  hosted: boolean;
  /** Short, pinned context the AI sees in every chat in this project (like a Claude project brief). */
  context: string;
  files: DemoFile[];
}

interface ProjectMeta {
  id: string;
  name: string;
  origin: "seed" | "import";
  hosted: boolean;
  context: string;
}

interface ProjectsState {
  projects: ProjectMeta[];
  activeProjectId: string;
}

interface LegacyProject extends ProjectMeta {
  files: DemoFile[];
}

const PROJECTS_KEY = "crackerbox.projects";

const INITIAL_META: ProjectsState = {
  projects: [{ id: "demo", name: "Demo Project", origin: "seed", hosted: true, context: "" }],
  activeProjectId: "demo",
};

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Parses the pre-IndexedDB localStorage blob (inline `files`) into metadata + files. */
function readLegacy(raw: string | null): { meta: ProjectsState; files: Record<string, DemoFile[]> } | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as { projects?: LegacyProject[]; activeProjectId?: string };
    if (!Array.isArray(state.projects) || state.projects.length === 0) return null;
    const projects: ProjectMeta[] = [];
    const files: Record<string, DemoFile[]> = {};
    for (const p of state.projects) {
      if (!p || typeof p.id !== "string") continue;
      projects.push({
        id: p.id,
        name: p.name ?? "Untitled",
        origin: p.origin === "import" ? "import" : "seed",
        hosted: p.hosted !== false,
        context: typeof p.context === "string" ? p.context : "",
      });
      if (Array.isArray(p.files)) files[p.id] = p.files;
    }
    if (projects.length === 0) return null;
    return {
      meta: {
        projects,
        activeProjectId:
          typeof state.activeProjectId === "string" && projects.some((p) => p.id === state.activeProjectId)
            ? state.activeProjectId
            : projects[0].id,
      },
      files,
    };
  } catch {
    return null;
  }
}

const SAVE_DEBOUNCE_MS = 250;

export function useProjects() {
  const [meta, setMeta] = usePersistentState<ProjectsState>(PROJECTS_KEY, INITIAL_META);
  const legacyRef = useRef<Record<string, DemoFile[]> | null>(null);

  const [filesMap, setFilesMap] = useState<Record<string, DemoFile[]>>(() => {
    try {
      const legacy = readLegacy(localStorage.getItem(PROJECTS_KEY));
      if (legacy) {
        legacyRef.current = legacy.files;
        const seed: Record<string, DemoFile[]> = {};
        for (const p of legacy.meta.projects) seed[p.id] = legacy.files[p.id] ?? [];
        return seed;
      }
    } catch {
      // ignore
    }
    return { demo: demoFiles };
  });

  const [hydrated, setHydrated] = useState(false);
  const pendingSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);
  const filesMapRef = useRef(filesMap);
  useEffect(() => {
    filesMapRef.current = filesMap;
  }, [filesMap]);

  // Load authoritative files from IndexedDB once on mount; migrate any legacy
  // localStorage blobs into it the first time through.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metas = metaRef.current.projects;
      const loaded: Record<string, DemoFile[]> = {};
      for (const m of metas) {
        let files = await idbLoadProjectFiles(m.id);
        if (!files) {
          files = legacyRef.current?.[m.id] ?? (m.id === "demo" ? demoFiles : []);
          if (files.length > 0) await idbSaveProjectFiles(m.id, files);
        }
        if (cancelled) return;
        loaded[m.id] = files;
      }
      setMeta({
        projects: metas.map((m) => ({
          id: m.id,
          name: m.name,
          origin: m.origin,
          hosted: m.hosted !== false,
          context: typeof m.context === "string" ? m.context : "",
        })),
        activeProjectId: metaRef.current.activeProjectId,
      });
      setFilesMap(loaded);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projects = useMemo<Project[]>(
    () =>
      meta.projects.map((m) => ({
        ...m,
        hosted: m.hosted !== false,
        context: typeof m.context === "string" ? m.context : "",
        files: filesMap[m.id] ?? (m.id === "demo" ? demoFiles : []),
      })),
    [meta.projects, filesMap]
  );

  const activeProject: Project =
    projects.find((p) => p.id === meta.activeProjectId) ??
    projects[0] ?? { id: "none", name: "Untitled", origin: "seed", hosted: true, context: "", files: [] };
  const activeProjectId = activeProject.id;

  const schedulePersist = useCallback((id: string, files: DemoFile[]) => {
    const existing = pendingSaves.current.get(id);
    if (existing) clearTimeout(existing);
    pendingSaves.current.set(
      id,
      setTimeout(() => {
        pendingSaves.current.delete(id);
        void idbSaveProjectFiles(id, files);
      }, SAVE_DEBOUNCE_MS)
    );
  }, []);

  const createProject = useCallback(
    (name: string, hosted = true): string => {
      const id = createId();
      setMeta((prev) => ({
        projects: [...prev.projects, { id, name: name.trim() || "Untitled", origin: "seed", hosted, context: "" }],
        activeProjectId: id,
      }));
      setFilesMap((prev) => ({ ...prev, [id]: [] }));
      return id;
    },
    [setMeta]
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      setMeta((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
      }));
    },
    [setMeta]
  );

  const deleteProject = useCallback((id: string) => {
    const existing = pendingSaves.current.get(id);
    if (existing) {
      clearTimeout(existing);
      pendingSaves.current.delete(id);
    }
    void idbDeleteProjectFiles(id);
    const freshId = createId();
    setMeta((prev) => {
      const remaining = prev.projects.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        return {
          projects: remaining,
          activeProjectId: prev.activeProjectId === id ? remaining[0].id : prev.activeProjectId,
        };
      }
      return { projects: [{ id: freshId, name: "Untitled", origin: "seed", hosted: true, context: "" }], activeProjectId: freshId };
    });
    setFilesMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const switchProject = useCallback(
    (id: string) => {
      setMeta((prev) =>
        prev.projects.some((p) => p.id === id) ? { ...prev, activeProjectId: id } : prev
      );
    },
    [setMeta]
  );

  const updateActiveFiles = useCallback(
    (updater: (files: DemoFile[]) => DemoFile[]) => {
      const id = metaRef.current.activeProjectId;
      const current = filesMapRef.current[id] ?? [];
      const nextFiles = updater(current);
      setFilesMap((prev) => ({ ...prev, [id]: nextFiles }));
      schedulePersist(id, nextFiles);
    },
    [schedulePersist]
  );

  const importProject = useCallback(
    (name: string, result: ImportResult, hosted = true): string => {
      const id = createId();
      setMeta((prev) => ({
        projects: [...prev.projects, { id, name: name.trim() || "Imported Project", origin: "import", hosted, context: "" }],
        activeProjectId: id,
      }));
      setFilesMap((prev) => ({ ...prev, [id]: result.files }));
      void idbSaveProjectFiles(id, result.files);
      return id;
    },
    [setMeta]
  );

  const createFromFiles = useCallback(
    (name: string, files: DemoFile[], hosted = true): string => {
      const id = createId();
      setMeta((prev) => ({
        projects: [...prev.projects, { id, name: name.trim() || "Project", origin: "import", hosted, context: "" }],
        activeProjectId: id,
      }));
      setFilesMap((prev) => ({ ...prev, [id]: files }));
      void idbSaveProjectFiles(id, files);
      return id;
    },
    [setMeta]
  );

  const setProjectHosted = useCallback(
    (id: string, hosted: boolean) => {
      setMeta((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, hosted } : p)),
      }));
    },
    [setMeta]
  );

  const setProjectContext = useCallback(
    (id: string, context: string) => {
      setMeta((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, context } : p)),
      }));
    },
    [setMeta]
  );

  /**
   * Wholesale-replaces every project (metadata + files) — used by the Google
   * Drive / JSON backup restore flow. Preserves the original project ids so
   * repeated restores don't pile up duplicates.
   */
  const restoreAll = useCallback(
    async (data: { projects: Project[]; activeProjectId?: string }) => {
      if (!Array.isArray(data.projects) || data.projects.length === 0) return;
      const nextFilesMap: Record<string, DemoFile[]> = {};
      for (const p of data.projects) {
        const files = Array.isArray(p.files) ? p.files : [];
        nextFilesMap[p.id] = files;
        await idbSaveProjectFiles(p.id, files);
      }
      const nextMeta: ProjectsState = {
        projects: data.projects.map(({ id, name, origin, hosted, context }) => ({
          id,
          name,
          origin,
          hosted: hosted !== false,
          context: typeof context === "string" ? context : "",
        })),
        activeProjectId:
          data.activeProjectId && data.projects.some((p) => p.id === data.activeProjectId)
            ? data.activeProjectId
            : data.projects[0].id,
      };
      setMeta(nextMeta);
      setFilesMap(nextFilesMap);
    },
    [setMeta]
  );

  return {
    projects,
    activeProjectId,
    activeProject,
    hydrated,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
    updateActiveFiles,
    importProject,
    createFromFiles,
    setProjectHosted,
    setProjectContext,
    restoreAll,
  };
}