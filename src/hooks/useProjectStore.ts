import type { DemoFile } from "../data/demoFiles";

const DB_NAME = "crackerbox";
const DB_VERSION = 1;
const STORE = "project-files";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

export async function idbLoadProjectFiles(id: string): Promise<DemoFile[] | null> {
  try {
    const result = await run<DemoFile[] | undefined>("readonly", (store) => store.get(id));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function idbSaveProjectFiles(id: string, files: DemoFile[]): Promise<void> {
  try {
    await run<IDBValidKey>("readwrite", (store) => store.put(files, id));
  } catch {
    // storage unavailable — files stay in memory for this session
  }
}

export async function idbDeleteProjectFiles(id: string): Promise<void> {
  try {
    await run<undefined>("readwrite", (store) => store.delete(id));
  } catch {
    // ignore
  }
}
