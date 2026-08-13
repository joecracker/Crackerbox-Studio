import type { WebContainer } from "@webcontainer/api";
import { formatBytes, normalizePath } from "./workspace";

export type WriteWorkspaceFileResult = { ok: true; size: number } | { ok: false; error: string };
export type DeleteWorkspaceFileResult = { ok: true } | { ok: false; error: string };

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
