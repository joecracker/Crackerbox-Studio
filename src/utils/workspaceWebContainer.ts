import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { formatBytes, normalizePath } from "./workspace";
import { tokenizeCommand } from "./commandGuard";

export type WriteWorkspaceFileResult = { ok: true; size: number } | { ok: false; error: string };
export type DeleteWorkspaceFileResult = { ok: true } | { ok: false; error: string };
export interface CommandResult {
  ok: boolean;
  exitCode: number;
  output: string;
  timedOut: boolean;
  error: string | null;
}

function containerPath(path: string): string {
  return `/${path}`;
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
