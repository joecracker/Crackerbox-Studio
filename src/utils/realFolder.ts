import type { DemoFile } from "../data/demoFiles";
import { shouldIgnoreName } from "./ignoreRules";

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

interface EnumerableDirectoryHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export function supportsFolderPicker(): boolean {
  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === "function";
}

export async function pickFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker({ mode: "readwrite" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

export async function readHandleToTree(handle: FileSystemDirectoryHandle): Promise<DemoFile[]> {
  const root: DemoFile[] = [];
  for await (const entry of (handle as EnumerableDirectoryHandle).values()) {
    const name = entry.name;
    if (shouldIgnoreName(name)) continue;
    if (entry.kind === "directory") {
      const children = await readHandleToTree(entry as FileSystemDirectoryHandle);
      root.push({ name, type: "folder", path: name, children });
    } else {
      const content = await readTextFile(entry as FileSystemFileHandle);
      root.push({ name, type: "file", path: name, content });
    }
  }
  return root;
}

async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    return text;
  } catch {
    return "";
  }
}

export async function writeTreeToHandle(
  handle: FileSystemDirectoryHandle,
  files: DemoFile[]
): Promise<void> {
  for (const node of files) {
    if (node.type === "folder") {
      const dir = await handle.getDirectoryHandle(node.name, { create: true });
      await writeTreeToHandle(dir, node.children ?? []);
    } else {
      const fileHandle = await handle.getFileHandle(node.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(node.content ?? "");
      await writable.close();
    }
  }
}

export async function saveNodeToHandle(
  handle: FileSystemDirectoryHandle,
  file: DemoFile
): Promise<void> {
  if (file.type === "folder") {
    const dir = await handle.getDirectoryHandle(file.name, { create: true });
    await writeTreeToHandle(dir, file.children ?? []);
    return;
  }
  const fileHandle = await handle.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file.content ?? "");
  await writable.close();
}
