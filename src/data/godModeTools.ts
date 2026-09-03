// "God Mode" tools for the Cracker Box chat agent.
// These give the in-app AI real superpowers it didn't have before:
//   - web_search  : find things on the web
//   - web_fetch   : read any public web page / text URL (via Cracker Box's fetch proxy)
//   - git_clone   : pull a GitHub repo's files into the current project (public OR private —
//                   private uses the user's saved GitHub token from the vault)
//
// Everything funnels through the Cloudflare Pages function at
// functions/api/fetch.ts, which avoids the browser CORS wall.

import type { ToolDefinition } from "../hooks/useChatStream";
import { shouldIgnoreName, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_TOTAL_BYTES } from "../utils/ignoreRules";
import { CRACKER_BOX_GUIDE } from "./crackerBoxGuide";

const PROXY = "/api/fetch";

async function fetchText(
  url: string,
  opts?: {
    auth?: string | null;
    method?: string;
    jsonBody?: unknown;
    textBody?: string;
  },
): Promise<string> {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(opts?.auth ? { authorization: `Bearer ${opts.auth}` } : {}),
      ...(opts?.method ? { method: opts.method } : {}),
      ...(opts?.jsonBody !== undefined ? { jsonBody: opts.jsonBody } : {}),
      ...(opts?.textBody !== undefined ? { textBody: opts.textBody } : {}),
    }),
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
      name: "web_search",
      description:
        "Search the web for a query and return a list of top results (title, URL, snippet). " +
        "Use this when you need to FIND information or pages, then follow up with web_fetch " +
        "on the most relevant URL to read the full content. Uses Tavily when a key is saved " +
        "in the vault (reliable), otherwise falls back to DuckDuckGo (may be limited). " +
        "Returns up to 10 results.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query, e.g. 'best practices for Home Assistant automation'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch the text content of a public web page or URL and return it as readable text. " +
        "Works for GET and POST. Great for reading docs, JSON APIs, blog posts, or calling " +
        "read-only APIs that need POST with a JSON body. Fetched through Cracker Box's proxy, " +
        "so no CORS limits. Pages longer than ~900KB are truncated. Private/IP hosts are blocked.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full http/https URL to fetch, e.g. 'https://opencode.ai/docs/' or 'https://api.example.com/search'. Must be a public URL.",
          },
          method: {
            type: "string",
            enum: ["GET", "POST"],
            description: "HTTP method. Default GET. Use POST for APIs that need a request body.",
          },
          jsonBody: {
            type: "object",
            description: "Optional JSON body for POST requests, e.g. { \"query\": \"foo\" }. Sent as application/json.",
          },
          textBody: {
            type: "string",
            description: "Optional raw text/JSON string body for POST requests (use instead of jsonBody if you have a raw payload).",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "self_inspect",
      description:
        "Read Cracker Box's own identity and capabilities instantly: app name, version, how the " +
        "vault/providers/tools work, and what you (the agent) can do. Use this before explaining " +
        "yourself to the user or when asked 'what are you / how do you work / can you do X'. " +
        "Fast, no clone needed.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_clone",
      description:
        "Clone a GitHub repository into the current project under a 'vendor/' folder, " +
        "e.g. vendor/owner/repo/. Works for public repos and — if a GitHub token is saved in the " +
        "vault — private ones too. Use this to pull in example code, a library's source, or even " +
        "Cracker Box's own repo so you can study or modify it. Clones the default branch. " +
        "Skips binaries/oversized files.",
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

async function defaultBranch(owner: string, name: string, auth?: string | null): Promise<string> {
  const json = await fetchText(`https://api.github.com/repos/${owner}/${name}`, { auth });
  try {
    const parsed = JSON.parse(json) as { default_branch?: string };
    return parsed.default_branch ?? "main";
  } catch {
    return "main";
  }
}

async function repoTree(owner: string, name: string, ref: string, auth?: string | null): Promise<Array<{ path: string; type: string }>> {
  const json = await fetchText(`https://api.github.com/repos/${owner}/${name}/git/trees/${ref}?recursive=1`, { auth });
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
  githubToken: string | null;
  tavilyKey: string | null;
}

interface SearchResultShape {
  title?: string;
  url?: string;
  snippet?: string;
}

export async function runGodModeTool(
  name: string,
  args: Record<string, unknown>,
  deps: RunnerDeps,
): Promise<string> {
  const auth = deps.githubToken ?? null;

  if (name === "self_inspect") {
    return (
      "You are the assistant inside Cracker Box Studio. Here is your built-in knowledge of " +
      "yourself and your capabilities:\n\n" +
      CRACKER_BOX_GUIDE +
      "\n\nTools you can call: web_search, web_fetch (GET/POST), git_clone (public + private), " +
      "self_inspect, plus workspace tools (list/read/write/delete files, run commands) and Home " +
      "Assistant MCP tools when connected. Providers: OpenRouter or OpenCode Zen (chosen in " +
      "Parameters). To see your own source code, use git_clone on joecracker/Crackerbox-Studio."
    );
  }

  if (name === "web_search") {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) throw new Error("Provide a search query.");
    const res = await fetch(PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search: query,
        ...(deps.tavilyKey ? { tavilyKey: deps.tavilyKey } : {}),
      }),
    });
    const json = (await res.json()) as { ok?: boolean; search?: { results?: SearchResultShape[]; error?: string } };
    if (!res.ok || !json.ok) throw new Error(json.search?.error ?? "Search failed.");
    const results = json.search?.results ?? [];
    if (results.length === 0) return json.search?.error ?? "No results found.";
    return results
      .map((r, i) => `${i + 1}. ${r.title || "Untitled"}\n   ${r.url || ""}\n   ${r.snippet || ""}`)
      .join("\n\n");
  }

  if (name === "web_fetch") {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) throw new Error("Provide a full URL starting with http:// or https://.");
    const method = args.method === "POST" ? "POST" : "GET";
    const content = await fetchText(url, {
      auth,
      method,
      jsonBody: args.jsonBody,
      textBody: typeof args.textBody === "string" ? args.textBody : undefined,
    });
    if (!content.trim()) return "That URL returned no text content.";
    return `Fetched ${url}:\n\n${content.slice(0, 60_000)}`;
  }

  if (name === "git_clone") {
    const repo = typeof args.repo === "string" ? args.repo.trim() : "";
    if (!repo) throw new Error("Provide repo in 'owner/reponame' format.");
    const { owner, name } = parseSlug(repo);
    const requestedRef = typeof args.ref === "string" && args.ref.trim() ? args.ref.trim() : null;
    const ref = requestedRef ?? (await defaultBranch(owner, name, auth));

    const files = await repoTree(owner, name, ref, auth);
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
      const raw = await fetchText(
        `https://raw.githubusercontent.com/${owner}/${name}/${ref}/${encodePath(file.path)}`,
        { auth },
      );
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
    const privateNote = auth ? "" : " (public repo — no GitHub token found; private repos need a token in the vault)";
    const skippedNote = skipped.length ? ` Skipped ${skipped.length} file(s): ${skipped.slice(0, 5).join(", ")}.` : "";
    return `Cloned ${owner}/${name} @ ${ref} into ${destRoot}/ — ${written} file(s) written.${skippedNote}${privateNote}`;
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

