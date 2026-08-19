import type { DirEnt, WebContainer, WebContainerProcess } from "@webcontainer/api";
import { formatBytes, normalizePath } from "./workspace";
import type { DirectoryEntry } from "./workspace";
import type { DemoFile } from "../data/demoFiles";
import { tokenizeCommand } from "./commandGuard";
import { isLikelyBinaryBytes, SYNC_EXCLUDED_DIRS, SYNC_MAX_FILE_BYTES } from "./ignoreRules";

export type WriteWorkspaceFileResult = { ok: true; size: number } | { ok: false; error: string };
export type DeleteWorkspaceFileResult = { ok: true } | { ok: false; error: string };
export type ContainerListResult = { ok: true; entries: DirectoryEntry[] } | { ok: false; error: string };
export type ContainerReadResult = { ok: true; content: string } | { ok: false; error: string };
export interface CommandResult {
  ok: boolean;
  exitCode: number;
  output: string;
  timedOut: boolean;
  error: string | null;
}

const MIRROR_EXCLUDED_DIRS = SYNC_EXCLUDED_DIRS;
const MAX_MIRROR_FILE_BYTES = SYNC_MAX_FILE_BYTES;

function containerPath(path: string): string {
  return `/${path}`;
}

export async function listDirectoryInContainer(
  container: WebContainer,
  rawPath: string
): Promise<ContainerListResult> {
  const normalized = normalizePath(rawPath);
  if (!normalized.ok) return normalized;
  const path = containerPath(normalized.path);
  let dirents: DirEnt<string>[];
  try {
    dirents = await container.fs.readdir(path, { withFileTypes: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "readdir failed";
    return { ok: false, error: message };
  }
  const entries: DirectoryEntry[] = dirents.map((d) =>
    d.isDirectory() ? { name: d.name, type: "folder" } : { name: d.name, type: "file" }
  );
  return { ok: true, entries };
}

export async function readFileInContainer(
  container: WebContainer,
  rawPath: string
): Promise<ContainerReadResult> {
  const normalized = normalizePath(rawPath);
  if (!normalized.ok) return normalized;
  try {
    const content = await container.fs.readFile(containerPath(normalized.path), "utf-8");
    return { ok: true, content };
  } catch (e) {
    const message = e instanceof Error ? e.message : "read failed";
    return { ok: false, error: message };
  }
}

function joinRel(base: string, name: string): string {
  return base === "" ? name : `${base}/${name}`;
}

async function walkDirectory(
  container: WebContainer,
  absDir: string,
  relBase: string
): Promise<DemoFile[]> {
  let dirents: DirEnt<string>[];
  try {
    dirents = await container.fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: DemoFile[] = [];
  for (const d of dirents) {
    if (MIRROR_EXCLUDED_DIRS.has(d.name)) continue;
    const abs = absDir === "/" ? `/${d.name}` : `${absDir}/${d.name}`;
    const rel = joinRel(relBase, d.name);
    if (d.isDirectory()) {
      const children = await walkDirectory(container, abs, rel);
      nodes.push({ name: d.name, type: "folder", path: rel, children });
    } else {
      try {
        const bytes = await container.fs.readFile(abs);
        if (bytes.byteLength > MAX_MIRROR_FILE_BYTES) continue;
        if (isLikelyBinaryBytes(bytes)) continue;
        const content = new TextDecoder().decode(bytes);
        nodes.push({ name: d.name, type: "file", path: rel, content });
      } catch {
        // unreadable / binary file — skip it in the snapshot
      }
    }
  }
  return nodes;
}

/**
 * Read the container's filesystem back into a `DemoFile[]` snapshot suitable for the
 * persisted mirror. Generated/binary directories are excluded so the snapshot stays small.
 */
export async function readTreeFromContainer(container: WebContainer): Promise<DemoFile[]> {
  return walkDirectory(container, "/", "");
}

export async function writeWorkspaceFile(
  container: WebContainer,
  rawPath: string,
  content: string
): Promise<WriteWorkspaceFileResult> {
  const normalized = normalizePath(rawPath);
  if (!normalized.ok) return normalized;
  const path = containerPath(normalized.path);
  try {
    const parent = path.slice(0, path.lastIndexOf("/"));
    if (parent && parent !== path) {
      await container.fs.mkdir(parent, { recursive: true });
    }
    await container.fs.writeFile(path, content);
  } catch (e) {
    const message = e instanceof Error ? e.message : "write failed";
    return { ok: false, error: message };
  }
  const size = new TextEncoder().encode(content).length;
  return { ok: true, size };
}

export async function deleteWorkspaceFile(
  container: WebContainer,
  rawPath: string
): Promise<DeleteWorkspaceFileResult> {
  const normalized = normalizePath(rawPath);
  if (!normalized.ok) return normalized;
  try {
    await container.fs.rm(containerPath(normalized.path), { force: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "delete failed";
    return { ok: false, error: message };
  }
  return { ok: true };
}

export function describeWriteResult(result: WriteWorkspaceFileResult): string {
  return result.ok ? `Wrote file (${formatBytes(result.size)}).` : `Error: ${result.error}`;
}

export function describeDeleteResult(result: DeleteWorkspaceFileResult): string {
  return result.ok ? "Deleted file." : `Error: ${result.error}`;
}

const DEFAULT_TIMEOUT_MS = 60_000;

async function runProcess(
  proc: WebContainerProcess,
  timeoutMs: number
): Promise<{ output: string; exitCode: number; timedOut: boolean; error: string | null }> {
  let output = "";
  let timedOut = false;
  const reader = proc.output.getReader();
  const drain = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        output += value;
      }
    } catch {
      // stream closed on kill
    }
  })();

  const timeoutId = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  try {
    const exitCode = await proc.exit;
    await drain;
    return { output, exitCode, timedOut, error: null };
  } catch (e) {
    await drain;
    const message = e instanceof Error ? e.message : "process failed";
    return { output, exitCode: -1, timedOut, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runCommandInContainer(
  container: WebContainer,
  command: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<CommandResult> {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    return { ok: false, exitCode: -1, output: "", timedOut: false, error: "Empty command." };
  }
  let proc: WebContainerProcess;
  try {
    proc = await container.spawn(tokens[0], tokens.slice(1));
  } catch (e) {
    const message = e instanceof Error ? e.message : "spawn failed";
    return { ok: false, exitCode: -1, output: "", timedOut: false, error: message };
  }
  const result = await runProcess(proc, timeoutMs);
  if (result.error) return { ...result, ok: false };
  return { ...result, ok: true };
}

export async function spawnCommandInContainer(
  container: WebContainer,
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<CommandResult> {
  let proc: WebContainerProcess;
  try {
    proc = await container.spawn(command, args, { cwd });
  } catch (e) {
    const message = e instanceof Error ? e.message : "spawn failed";
    return { ok: false, exitCode: -1, output: "", timedOut: false, error: message };
  }
  const result = await runProcess(proc, timeoutMs);
  if (result.error) return { ...result, ok: false };
  return { ...result, ok: true };
}

export async function installPackageInContainer(
  container: WebContainer,
  spec: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<CommandResult> {
  let proc: WebContainerProcess;
  try {
    proc = await container.spawn("npm", ["install", spec]);
  } catch (e) {
    const message = e instanceof Error ? e.message : "npm failed to start";
    return { ok: false, exitCode: -1, output: "", timedOut: false, error: message };
  }
  const result = await runProcess(proc, timeoutMs);
  if (result.error) return { ...result, ok: false };
  return { ...result, ok: true };
}
