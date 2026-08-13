import type { DemoFile } from "../data/demoFiles";

export interface TerminalContext {
  projectName: string;
  files: DemoFile[];
}

export interface CommandResult {
  lines: string[];
  error?: boolean;
}

const HELP: Array<[string, string]> = [
  ["cat <path>", "print a file's contents"],
  ["date", "print the current date and time"],
  ["echo <text>", "print text"],
  ["help", "list available commands"],
  ["ls [path]", "list directory contents"],
  ["pwd", "print working directory"],
  ["tree", "show the project file tree"],
  ["whoami", "print current user"],
  ["version", "print Cracker Box version"],
];

function findNode(nodes: DemoFile[], path: string): DemoFile | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

function cleanPath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\/+$/, "");
}

function formatEntries(nodes: DemoFile[]): string[] {
  const folders = nodes
    .filter((n) => n.type === "folder")
    .map((n) => `${n.name}/`)
    .sort();
  const files = nodes
    .filter((n) => n.type === "file")
    .map((n) => n.name)
    .sort();
  return [...folders, ...files];
}

function treeLines(nodes: DemoFile[], prefix: string): string[] {
  const out: string[] = [];
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└── " : "├── ";
    out.push(`${prefix}${connector}${node.name}${node.type === "folder" ? "/" : ""}`);
    if (node.type === "folder" && node.children) {
      out.push(...treeLines(node.children, prefix + (isLast ? "    " : "│   ")));
    }
  });
  return out;
}

function ls(ctx: TerminalContext, arg: string): CommandResult {
  if (arg === "" || arg === ".") {
    return { lines: formatEntries(ctx.files) };
  }
  const path = cleanPath(arg);
  const node = findNode(ctx.files, path);
  if (!node) {
    return { lines: [`ls: cannot access '${arg}': no such file or directory`], error: true };
  }
  if (node.type === "folder") {
    return { lines: formatEntries(node.children ?? []) };
  }
  return { lines: [node.name] };
}

function cat(ctx: TerminalContext, arg: string): CommandResult {
  if (arg === "") {
    return { lines: ["cat: missing file operand", 'Usage: cat <path>'], error: true };
  }
  const path = cleanPath(arg);
  const node = findNode(ctx.files, path);
  if (!node) {
    return { lines: [`cat: ${arg}: no such file`], error: true };
  }
  if (node.type === "folder") {
    return { lines: [`cat: ${arg}: is a directory`], error: true };
  }
  return { lines: node.content ? node.content.split("\n") : [""] };
}

export function runCommand(raw: string, ctx: TerminalContext): CommandResult {
  const trimmed = raw.trim();
  if (!trimmed) return { lines: [] };

  const spaceIndex = trimmed.search(/\s/);
  const cmd = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
  const rest = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();

  switch (cmd) {
    case "help": {
      const lines = [
        "Client-side shell — operates on this project's virtual file tree (no OS processes).",
        "",
        "Commands:",
        ...HELP.map(([name, desc]) => `  ${name.padEnd(20)}${desc}`),
      ];
      return { lines };
    }
    case "pwd":
      return { lines: [`/workspace/${ctx.projectName}`] };
    case "ls":
      return ls(ctx, rest);
    case "cat":
      return cat(ctx, rest);
    case "tree":
      return { lines: ["<root>/", ...treeLines(ctx.files, "")] };
    case "echo":
      return { lines: [rest] };
    case "date":
      return { lines: [new Date().toString()] };
    case "whoami":
      return { lines: ["crackerbox-user@cracker-box"] };
    case "version":
      return { lines: ["Cracker Box v0.1.0 — client-side terminal"] };
    default:
      return {
        lines: [`command not found: ${cmd}`, 'Type "help" for available commands.'],
        error: true,
      };
  }
}