import type { DemoFile } from "../data/demoFiles";

const DB_NAME = "crackerbox";
const DB_VERSION = 3;
const STORE = "project-files";
const SNAP_STORE = "project-snapshots";
const HANDLE_STORE = "folder-handles";

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  files: DemoFile[];
  createdAt: number;
  note?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
      if (!req.result.objectStoreNames.contains(SNAP_STORE)) {
        req.result.createObjectStore(SNAP_STORE);
      }
      if (!req.result.objectStoreNames.contains(HANDLE_STORE)) {
        req.result.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = action(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

export async function idbLoadProjectFiles(id: string): Promise<DemoFile[] | null> {
  try {
    const result = await run<DemoFile[] | undefined>(STORE, "readonly", (store) => store.get(id));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function idbSaveProjectFiles(id: string, files: DemoFile[]): Promise<void> {
  try {
    await run<IDBValidKey>(STORE, "readwrite", (store) => store.put(files, id));
  } catch {
    // storage unavailable — files stay in memory for this session
  }
}

export async function idbDeleteProjectFiles(id: string): Promise<void> {
  try {
    await run<undefined>(STORE, "readwrite", (store) => store.delete(id));
  } catch {
    // ignore
  }
}

export async function idbLoadSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
  try {
    const result = await run<ProjectSnapshot[] | undefined>(SNAP_STORE, "readonly", (store) =>
      store.get(projectId)
    );
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function idbSaveSnapshots(projectId: string, snaps: ProjectSnapshot[]): Promise<void> {
  try {
    await run<IDBValidKey>(SNAP_STORE, "readwrite", (store) => store.put(snaps, projectId));
  } catch {
    // storage unavailable — snapshots stay in memory for this session
  }
}

export async function idbDeleteSnapshots(projectId: string): Promise<void> {
  try {
    await run<undefined>(SNAP_STORE, "readwrite", (store) => store.delete(projectId));
  } catch {
    // ignore
  }
}

export async function idbSaveFolderHandle(
  projectId: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    await run<IDBValidKey>(HANDLE_STORE, "readwrite", (store) => store.put(handle, projectId));
  } catch {
    // handle persistence unavailable — in-memory only this session
  }
}

export async function idbLoadFolderHandle(
  projectId: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const result = await run<FileSystemDirectoryHandle | undefined>(HANDLE_STORE, "readonly", (store) =>
      store.get(projectId)
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export async function idbDeleteFolderHandle(projectId: string): Promise<void> {
  try {
    await run<undefined>(HANDLE_STORE, "readwrite", (store) => store.delete(projectId));
  } catch {
    // ignore
  }
}
