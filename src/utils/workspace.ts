import type { DemoFile } from "../data/demoFiles";

export interface DirectoryEntry {
  name: string;
  type: "file" | "folder";
  size?: number;
}

export type NormalizedPath = { ok: true; path: string } | { ok: false; error: string };

export function formatBytes(length: number): string {
  if (length >= 1024 * 1024) return `${(length / (1024 * 1024)).toFixed(1)} MB`;
  if (length >= 1024) return `${Math.round(length / 1024)} KB`;
  return `${length} B`;
}

export interface WorkspaceFS {
  listDirectory(
    path: string
  ): { ok: true; entries: DirectoryEntry[] } | { ok: false; error: string };
  readFile(path: string): { ok: true; content: string } | { ok: false; error: string };
}

export type ToolExecResult = { ok: true; content: string } | { ok: false; error: string };

export function normalizePath(raw: string): NormalizedPath {
  const cleaned = (raw ?? "").replace(/\\/g, "/").trim();
  const segments = cleaned.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    return { ok: false, error: `Invalid path '${raw}': escaping the project root is not allowed.` };
  }
  return { ok: true, path: segments.join("/") };
}

function findNode(nodes: DemoFile[], path: string): DemoFile | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function getFile(nodes: DemoFile[], path: string): DemoFile | null {
  return findNode(nodes, path);
}

export function createWorkspaceFS(files: DemoFile[]): WorkspaceFS {
  const listDirectory: WorkspaceFS["listDirectory"] = (rawPath) => {
    const normalized = normalizePath(rawPath);
    if (!normalized.ok) return normalized;
    if (normalized.path === "") {
      return {
        ok: true,
        entries: files.map((n) => ({
          name: n.name,
          type: n.type,
          size: n.type === "file" ? (n.content?.length ?? 0) : undefined,
        })),
      };
    }
    const node = findNode(files, normalized.path);
    if (!node) return { ok: false, error: `Directory '${rawPath}' not found in the project.` };
    if (node.type === "file") {
      return { ok: false, error: `'${rawPath}' is a file, not a directory.` };
    }
    return {
      ok: true,
      entries: (node.children ?? []).map((n) => ({
        name: n.name,
        type: n.type,
        size: n.type === "file" ? (n.content?.length ?? 0) : undefined,
      })),
    };
  };

  const readFile: WorkspaceFS["readFile"] = (rawPath) => {
    const normalized = normalizePath(rawPath);
    if (!normalized.ok) return normalized;
    const node = normalized.path === "" ? null : findNode(files, normalized.path);
    if (!node || node.type !== "file") {
      return { ok: false, error: `File '${rawPath}' not found in the project.` };
    }
    return { ok: true, content: node.content ?? "" };
  };

  return { listDirectory, readFile };
}

export function executeWorkspaceTool(
  fs: WorkspaceFS,
  name: string,
  rawArguments: string
): ToolExecResult {
  let args: Record<string, unknown>;
  try {
    args = rawArguments ? (JSON.parse(rawArguments) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, error: `Invalid tool arguments: ${rawArguments}` };
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, error: "Invalid tool arguments: expected a JSON object." };
  }

  if (name === "list_directory") {
    const path = typeof args.path === "string" ? args.path : "";
    const result = fs.listDirectory(path);
    if (!result.ok) return result;
    const lines = result.entries.map((e) =>
      e.type === "folder" ? `${e.name}/` : `${e.name} (${formatBytes(e.size ?? 0)})`
    );
    return {
      ok: true,
      content: lines.length > 0 ? lines.join("\n") : "(empty directory)",
    };
  }

  if (name === "read_file") {
    const path = typeof args.path === "string" ? args.path : "";
    const result = fs.readFile(path);
    if (!result.ok) return result;
    return { ok: true, content: result.content };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}
