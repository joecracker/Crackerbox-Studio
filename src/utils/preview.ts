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