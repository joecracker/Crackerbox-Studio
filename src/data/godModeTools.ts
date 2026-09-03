// "God Mode" tools for the Cracker Box chat agent.
// These give the in-app AI real superpowers it didn't have before:
//   - web_fetch   : read any public web page / text URL (via Cracker Box's fetch proxy)
//   - git_clone   : pull a public GitHub repo's files into the current project
//
// Everything funnels through the Cloudflare Pages function at
// functions/api/fetch.ts, which avoids the browser CORS wall.

import type { ToolDefinition } from "../hooks/useChatStream";
import { shouldIgnoreName, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_TOTAL_BYTES } from "../utils/ignoreRules";

const PROXY = "/api/fetch";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const json = (await res.json()) as { ok?: boolean; content?: string; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `Proxy request failed (HTTP ${res.status})`);
  }
  return json.content ?? "";
}

export const GOD_MODE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch the text content of a public web page or URL and return it as readable text. " +
        "Great for reading docs, APIs that return plain text/JSON, blog posts, or looking up " +
        "anything on the open web. The content is fetched through Cracker Box's proxy, so it " +
        "works without CORS limits. Pages longer than ~900KB are truncated.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full http/https URL to fetch, e.g. 'https://opencode.ai/docs/'. Must be a public URL.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_clone",
      description:
        "Clone a PUBLIC GitHub repository into the current project under a 'vendor/' folder, " +
        "e.g. vendor/owner/repo/. Use this to pull in example code, a library's source, or Cracker Box's " +
        "own repo so you can study or modify it. Clones the default branch. Skips binaries/oversized files.",
      parameters: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Full repo slug, 'owner/reponame', e.g. 'anomalyco/opencode'.",
          },
          ref: {
            type: "string",
            description: "Optional branch/tag/SHA. Defaults to the repo's default branch.",
          },
        },
        required: ["repo"],
      },
    },
  },
];

export const GOD_MODE_NAMES = new Set<string>(GOD_MODE_TOOLS.map((t) => t.function.name));

function parseSlug(repo: string): { owner: string; name: string } {
  const parts = repo.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("repo must be in 'owner/reponame' format.");
  return { owner: parts[0], name: parts[1] };
}

async function defaultBranch(owner: string, name: string): Promise<string> {
  const json = await fetchText(`https://api.github.com/repos/${owner}/${name}`);
  try {
    const parsed = JSON.parse(json) as { default_branch?: string };
    return parsed.default_branch ?? "main";
  } catch {
    return "main";
  }
}

async function repoTree(owner: string, name: string, ref: string): Promise<Array<{ path: string; type: string }>> {
  const json = await fetchText(`https://api.github.com/repos/${owner}/${name}/git/trees/${ref}?recursive=1`);
  const parsed = JSON.parse(json) as { tree?: Array<{ path?: string; type?: string }> };
  if (!parsed.tree) {
    const msg = (parsed as unknown as { message?: string }).message;
    throw new Error(msg || "Could not read repo tree.");
  }
  const out: Array<{ path: string; type: string }> = [];
  for (const t of parsed.tree) {
    if (!t.path || !t.type) continue;
    const top = t.path.split("/")[0] ?? "";
    if (shouldIgnoreName(top)) continue;
    if (t.path.split("/").some((seg) => seg === ".git" || shouldIgnoreName(seg))) continue;
    out.push({ path: t.path, type: t.type });
  }
  return out;
}

interface RunnerDeps {
  persistFile: (path: string, content: string) => void;
  refreshTree: () => Promise<void>;
}

export async function runGodModeTool(
  name: string,
  args: Record<string, unknown>,
  deps: RunnerDeps,
): Promise<string> {
  if (name === "web_fetch") {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) throw new Error("Provide a full URL starting with http:// or https://.");
    const content = await fetchText(url);
    if (!content.trim()) return "That URL returned no text content.";
    return `Fetched ${url}:\n\n${content.slice(0, 60_000)}`;
  }

  if (name === "git_clone") {
    const repo = typeof args.repo === "string" ? args.repo.trim() : "";
    if (!repo) throw new Error("Provide repo in 'owner/reponame' format.");
    const { owner, name } = parseSlug(repo);
    const requestedRef = typeof args.ref === "string" && args.ref.trim() ? args.ref.trim() : null;
    const ref = requestedRef ?? (await defaultBranch(owner, name));

    const files = await repoTree(owner, name, ref);
    const textFiles = files.filter((f) => f.type === "blob");
    if (textFiles.length === 0) throw new Error("No files found in that repo.");

    const destRoot = `vendor/${owner}/${name}`;
    let written = 0;
    let total = 0;
    const skipped: string[] = [];
    for (const file of textFiles) {
      if (total >= IMPORT_MAX_TOTAL_BYTES) {
        skipped.push("(reached total size cap)");
        break;
      }
      if (file.path.split("/").some((seg) => isBinaryPathLike(seg))) {
        skipped.push(file.path);
        continue;
      }
      const raw = await fetchText(`https://raw.githubusercontent.com/${owner}/${name}/${ref}/${encodePath(file.path)}`);
      const bytes = new TextEncoder().encode(raw).length;
      if (bytes > IMPORT_MAX_FILE_BYTES) {
        skipped.push(file.path);
        continue;
      }
      total += bytes;
      deps.persistFile(`${destRoot}/${file.path}`, raw);
      written++;
      if (written >= 400) {
        skipped.push("(500-file cap reached)");
        break;
      }
    }
    try {
      await deps.refreshTree();
    } catch {
      // refresh is best effort
    }
    const skippedNote = skipped.length ? ` Skipped ${skipped.length} file(s): ${skipped.slice(0, 5).join(", ")}.` : "";
    return `Cloned ${owner}/${name} @ ${ref} into ${destRoot}/ — ${written} file(s) written.${skippedNote}`;
  }

  throw new Error(`Unknown God Mode tool: ${name}`);
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function isBinaryPathLike(seg: string): boolean {
  return /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|zip|gz|pdf|mp4|mp3|wasm|map|lock|min\.js|min\.css)$/i.test(seg);
}

