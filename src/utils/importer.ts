import { unzipSync } from "fflate";
import type { DemoFile } from "../data/demoFiles";
import { formatBytes } from "./workspace";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_TOTAL_BYTES,
  IMPORT_SKIPPED_CAP,
  isLikelyBinaryBytes,
  shouldIgnoreName,
} from "./ignoreRules";

interface FlatFile {
  path: string;
  content: string;
}

export interface ImportResult {
  ok: boolean;
  files: DemoFile[];
  fileCount: number;
  totalBytes: number;
  skipped: string[];
  exceeded: boolean;
  error: string | null;
  /** Suggested project name, when derivable from the source (folder/zip name). */
  name?: string;
}

interface ImportContext {
  flat: FlatFile[];
  skipped: string[];
  totalBytes: number;
  exceeded: boolean;
}

function createContext(): ImportContext {
  return { flat: [], skipped: [], totalBytes: 0, exceeded: false };
}

function addSkipped(ctx: ImportContext, label: string): void {
  if (ctx.skipped.length < IMPORT_SKIPPED_CAP) ctx.skipped.push(label);
}

function processBytes(ctx: ImportContext, path: string, bytes: Uint8Array): void {
  if (ctx.exceeded) {
    addSkipped(ctx, path);
    return;
  }
  if (bytes.byteLength > IMPORT_MAX_FILE_BYTES) {
    addSkipped(ctx, `${path} (${formatBytes(bytes.byteLength)})`);
    return;
  }
  if (isLikelyBinaryBytes(bytes)) {
    addSkipped(ctx, path);
    return;
  }
  if (ctx.totalBytes + bytes.byteLength > IMPORT_MAX_TOTAL_BYTES) {
    ctx.exceeded = true;
    addSkipped(ctx, path);
    return;
  }
  ctx.totalBytes += bytes.byteLength;
  ctx.flat.push({ path, content: new TextDecoder().decode(bytes) });
}

function addPath(nodes: DemoFile[], segments: string[], content: string, basePath: string): void {
  const [head, ...rest] = segments;
  if (!head) return;
  const full = basePath ? `${basePath}/${head}` : head;
  if (rest.length === 0) {
    nodes.push({ name: head, type: "file", path: full, content });
    return;
  }
  let folder = nodes.find((n) => n.type === "folder" && n.name === head) as
    | DemoFile
    | undefined;
  if (!folder) {
    folder = { name: head, type: "folder", path: full, children: [] };
    nodes.push(folder);
  }
  addPath(folder.children ?? [], rest, content, full);
}

export function buildTreeFromFlat(flat: FlatFile[]): DemoFile[] {
  const root: DemoFile[] = [];
  const sorted = [...flat].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    addPath(root, file.path.split("/"), file.content, "");
  }
  return root;
}

/** If every entry shares a single top-level folder (e.g. a wrapper dir in a zip), strip it. */
function stripCommonRoot(flat: FlatFile[]): FlatFile[] {
  if (flat.length === 0) return flat;
  const top = flat[0].path.split("/")[0];
  if (!top) return flat;
  if (!flat.every((f) => f.path.split("/")[0] === top)) return flat;
  return flat.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
}

function finishImport(ctx: ImportContext, name?: string): ImportResult {
  const flat = stripCommonRoot(ctx.flat);
  const files = buildTreeFromFlat(flat);
  return {
    ok: flat.length > 0,
    files,
    fileCount: flat.length,
    totalBytes: ctx.totalBytes,
    skipped: ctx.skipped,
    exceeded: ctx.exceeded,
    error: flat.length === 0 ? "No importable text files found." : null,
    name,
  };
}

function readZipBytes(bytes: Uint8Array, ctx: ImportContext): void {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) => {
        const name = f.name.replace(/^\/+/, "");
        const segments = name.split("/");
        const allowed = segments.every((seg) => !seg || !shouldIgnoreName(seg));
        if (!allowed) addSkipped(ctx, name);
        return allowed;
      },
    });
  } catch {
    addSkipped(ctx, "zip: could not be read");
    return;
  }
  for (const rawName of Object.keys(entries).sort()) {
    const clean = rawName.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!clean || clean.endsWith("/")) continue;
    const data = entries[rawName];
    if (!data) continue;
    processBytes(ctx, clean, data);
  }
}

async function readFileHandle(
  handle: FileSystemFileHandle,
  rel: string,
  ctx: ImportContext
): Promise<void> {
  if (ctx.exceeded) {
    addSkipped(ctx, rel);
    return;
  }
  try {
    const file = await handle.getFile();
    processBytes(ctx, rel, new Uint8Array(await file.arrayBuffer()));
  } catch {
    addSkipped(ctx, rel);
  }
}

async function readDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  base: string,
  ctx: ImportContext
): Promise<void> {
  for await (const entry of (handle as EnumerableDirectoryHandle).values()) {
    const name = entry.name;
    const rel = base ? `${base}/${name}` : name;
    if (shouldIgnoreName(name)) {
      addSkipped(ctx, `${rel}${entry.kind === "directory" ? "/" : ""}`);
      continue;
    }
    if (entry.kind === "directory") {
      await readDirectoryHandle(entry as FileSystemDirectoryHandle, rel, ctx);
    } else {
      await readFileHandle(entry as FileSystemFileHandle, rel, ctx);
    }
  }
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = (): void => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) resolve(all);
          else {
            all.push(...batch);
            readBatch();
          }
        },
        reject
      );
    };
    readBatch();
  });
}

async function readDropEntry(
  entry: FileSystemEntry,
  base: string,
  ctx: ImportContext
): Promise<void> {
  if (shouldIgnoreName(entry.name)) {
    addSkipped(ctx, base ? `${base}/${entry.name}` : entry.name);
    return;
  }
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    const rel = base ? `${base}/${entry.name}` : entry.name;
    await readDropFile(file, rel, ctx);
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(reader);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    for (const child of children) {
      await readDropEntry(child, rel, ctx);
    }
  }
}

async function readDropFile(file: File, rel: string, ctx: ImportContext): Promise<void> {
  if (ctx.exceeded) {
    addSkipped(ctx, rel);
    return;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(rel)) readZipBytes(bytes, ctx);
    else processBytes(ctx, rel, bytes);
  } catch {
    addSkipped(ctx, rel);
  }
}

export async function importFromDataTransfer(data: DataTransfer): Promise<ImportResult> {
  const ctx = createContext();
  const items = Array.from(data.items);
  const entries = items
    .map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));
  if (entries.length > 0) {
    for (const entry of entries) {
      await readDropEntry(entry, "", ctx);
    }
  } else {
    for (const file of Array.from(data.files)) {
      await readDropFile(file, file.name, ctx);
    }
  }
  return finishImport(ctx);
}

interface WindowWithDirectoryPicker {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}

/** lib.dom in some TS versions lacks the File System Access enumeration methods. */
interface EnumerableDirectoryHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export async function importFromDirectoryPicker(): Promise<ImportResult> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    return {
      ok: false,
      files: [],
      fileCount: 0,
      totalBytes: 0,
      skipped: [],
      exceeded: false,
      error:
        "Folder import isn't supported in this browser — drag a folder here or import a .zip instead.",
    };
  }
  const ctx = createContext();
  try {
    const handle = await picker();
    await readDirectoryHandle(handle, "", ctx);
    return finishImport(ctx, handle.name);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, files: [], fileCount: 0, totalBytes: 0, skipped: [], exceeded: false, error: null };
    }
    const message = e instanceof Error ? e.message : "Folder import failed";
    return { ok: false, files: [], fileCount: 0, totalBytes: 0, skipped: [], exceeded: false, error: message };
  }
}

export async function importFromZipFile(file: File): Promise<ImportResult> {
  const ctx = createContext();
  const name = file.name.replace(/\.zip$/i, "").trim() || "Imported Project";
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    readZipBytes(bytes, ctx);
  } catch {
    return {
      ok: false,
      files: [],
      fileCount: 0,
      totalBytes: 0,
      skipped: [],
      exceeded: false,
      error: "Zip could not be read.",
    };
  }
  return finishImport(ctx, name);
}
