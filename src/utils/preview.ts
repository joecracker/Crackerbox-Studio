import type { DemoFile } from "../data/demoFiles";

const BLOCK_RE = /```([\w.-]*)[ \t]*\r?\n([\s\S]*?)```/g;

export function extractPreview(markdown: string): string | null {
  const css: string[] = [];
  const js: string[] = [];
  const html: string[] = [];
  let match: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((match = BLOCK_RE.exec(markdown)) !== null) {
    const lang = match[1].trim().toLowerCase();
    const code = match[2].trim();
    if (lang === "html") html.push(code);
    else if (lang === "css") css.push(code);
    else if (lang === "js" || lang === "javascript") js.push(code);
  }
  if (html.length === 0 && css.length === 0 && js.length === 0) return null;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<style>\n${css.join("\n\n")}\n</style>`,
    "</head>",
    "<body>",
    html.join("\n"),
    `<script>\n${js.join("\n\n")}\n</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}

function findFile(nodes: DemoFile[], path: string): DemoFile | undefined {
  for (const node of nodes) {
    if (node.type === "file" && node.path === path) return node;
    if (node.children) {
      const found = findFile(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

function normalizeRef(href: string): string | null {
  let p = href.trim().replace(/^\.\//, "").replace(/^\/+/, "");
  const q = p.indexOf("?");
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf("#");
  if (h !== -1) p = p.slice(0, h);
  if (!p) return null;
  return p;
}

const MODULE_SCRIPT_RE =
  /<script[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i;

const FRAMEWORK_ENTRY_PATHS = [
  "src/main.tsx",
  "src/main.jsx",
  "src/main.ts",
  "src/main.js",
  "src/App.tsx",
  "src/App.jsx",
  "src/index.tsx",
  "src/index.jsx",
  "src/index.ts",
  "src/index.js",
];

function hasFrameworkEntry(files: DemoFile[]): boolean {
  return FRAMEWORK_ENTRY_PATHS.some((path) => !!findFile(files, path));
}

/**
 * Builds a self-contained HTML document from the project's actual files (plain
 * HTML/CSS/JS projects). Returns `null` when the project is a framework app that
 * needs the dev server (e.g. it mounts React via a module script or a src/main
 * entry) — in that case the live preview is used instead.
 */
export function buildStaticPreview(files: DemoFile[]): string | null {
  const index = findFile(files, "index.html");
  if (!index?.content) return null;
  const html = index.content;

  if (MODULE_SCRIPT_RE.test(html)) return null;
  if (hasFrameworkEntry(files)) return null;

  const css: string[] = [];
  const js: string[] = [];

  const inlineStyles = html.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
    (m, href: string) => {
      const path = normalizeRef(href);
      const file = path ? findFile(files, path) : undefined;
      if (file?.content) {
        css.push(`/* ${path} */\n${file.content}`);
        return "";
      }
      return m;
    }
  );

  const inlineScripts = inlineStyles.replace(
    /<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi,
    (m, src: string) => {
      const path = normalizeRef(src);
      const file = path ? findFile(files, path) : undefined;
      if (file?.content) {
        js.push(`/* ${path} */\n${file.content}`);
        return "";
      }
      return m;
    }
  );

  const styleBlock = css.length > 0 ? `<style>\n${css.join("\n\n")}\n</style>` : "";
  const scriptBlock = js.length > 0 ? `<script>\n${js.join("\n\n")}\n</script>` : "";

  const finalHtml = styleBlock
    ? inlineScripts.replace("</head>", `${styleBlock}</head>`)
    : inlineScripts;

  return finalHtml.replace("</body>", `${scriptBlock}</body>`);
}