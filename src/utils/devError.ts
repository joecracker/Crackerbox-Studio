export interface DetectedPreviewError {
  /** Stable-ish id used to avoid re-surfacing the same failure. */
  id: string;
  /** Short, plain-English headline, e.g. "Missing import". */
  title: string;
  /** One-to-two sentence plain-English explanation. */
  summary: string;
  /** The file the error points at, when one can be extracted. */
  file?: string;
  /** Raw output snippet to hand the assistant for diagnosis. */
  snippet: string;
}

interface Pattern {
  test: RegExp;
  title: string;
  summary: string;
  /** Optional second regex to pull a file path out of the snippet. */
  fileRe?: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    test: /Failed to resolve import|Failed to resolve dependency|Can't resolve|Unable to resolve|Cannot find module|Module not found/i,
    title: "Missing import",
    summary:
      "A file is importing something the project can't find — either the path is wrong or the package isn't installed.",
    fileRe: /(?:from\s+|["'])([^"'\s]+\.(?:ts|tsx|js|jsx|css|vue|svelte|json))(?=["']|$|\s)/i,
  },
  {
    test: /Module '([^']+)' has no exported member/i,
    title: "Bad import",
    summary:
      "A file imports a name that the module doesn't actually export — check the export and the import name.",
  },
  {
    test: /SyntaxError|Unexpected token|Unexpected identifier|Unexpected end of input|Unexpected end of JSON/i,
    title: "Syntax error",
    summary: "The code has a typo or missing punctuation and can't be parsed.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|css|json)):\d+/i,
  },
  {
    test: /is not defined|ReferenceError|Cannot read propert(?:y|ies) of (?:null|undefined)|Cannot access .* before initialization/i,
    title: "Unknown or missing value",
    summary:
      "The code is using a value that doesn't exist or hasn't been set up yet when it runs.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte)):\d+/i,
  },
  {
    test: /is not a function|TypeError|Cannot read propert(?:y|ies).* of undefined/i,
    title: "Wrong value used",
    summary:
      "The code called or read something the wrong way — for example, using a number like a function.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte)):\d+/i,
  },
  {
    test: /error TS\d+|TS\d+: /i,
    title: "TypeScript error",
    summary: "TypeScript found a type problem that stops the build.",
    fileRe: /([\w./-]+\.(?:ts|tsx))\((\d+),\d+\)/i,
  },
  {
    test: /\[vite\] Internal Server Error|Internal Server Error|Pre-transform error|Failed to load|Transform failed/i,
    title: "Server error",
    summary: "The dev server hit an error while serving the app.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|css|html)):\d+/i,
  },
  {
    test: /Failed to compile|Compiled with errors|ERROR in/i,
    title: "Build failed",
    summary: "The project failed to build, so the app can't start.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|css)):\d+/i,
  },
  {
    test: /npm ERR!|npm error|peer .* conflict|ERESOLVE|EACCES|EPERM|ENOENT/i,
    title: "Install problem",
    summary:
      "Installing dependencies hit a problem — a package conflict or a missing file. The dev server may not start until this is fixed.",
  },
  {
    test: /command not found|not recognized as an internal|Unknown command/i,
    title: "Unknown command",
    summary: "The dev server tried to run a command that isn't available.",
  },
  {
    test: /Unhandled Promise Rejection|Unhandled promise rejection|rejected promise/i,
    title: "Unhandled error",
    summary: "The app crashed on an error that nothing was set up to catch.",
    fileRe: /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte)):\d+/i,
  },
];

const FILE_RE =
  /(?:^|\s)((?:\.{0,2}\/)?(?:src|lib|utils|components|pages|app|public|test|tests|config)[\w./-]*\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|css|json|html))(?::\d+)?/i;

function extractFile(text: string, pattern?: RegExp): string | undefined {
  if (pattern) {
    const m = text.match(pattern);
    if (m && m[1]) return m[1];
  }
  const m = text.match(FILE_RE);
  return m ? m[1] : undefined;
}

/**
 * Scans dev-server output for a recognizable failure and turns it into a
 * plain-English summary the user can read and the assistant can act on.
 * Returns null when nothing actionable is found.
 */
export function detectPreviewError(output: string): DetectedPreviewError | null {
  if (!output || output.trim().length === 0) return null;

  for (const pattern of PATTERNS) {
    const match = output.match(pattern.test);
    if (!match) continue;

    const index = match.index ?? 0;
    const from = Math.max(0, index - 200);
    const to = Math.min(output.length, index + 900);
    const snippet = output.slice(from, to).trim();

    const file = extractFile(snippet, pattern.fileRe);
    const id = `${pattern.title}|${file ?? ""}|${(match[0] ?? "").slice(0, 80)}`;

    return {
      id,
      title: pattern.title,
      summary: pattern.summary,
      file,
      snippet: snippet || output.slice(-900).trim(),
    };
  }

  return null;
}

/** Lightweight hash so ids stay short and stable. */
export function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}