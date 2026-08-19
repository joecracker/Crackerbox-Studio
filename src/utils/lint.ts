import type { WebContainer } from "@webcontainer/api";
import { spawnCommandInContainer } from "./workspaceWebContainer";

export interface LintIssue {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export type LintResult =
  | { ok: true; errors: number; warnings: number; issues: LintIssue[] }
  | { ok: false; unavailable: true; error?: string };

const LINT_DIR = "/crackerbox-lint";
const INSTALL_TIMEOUT_MS = 180_000;
const LINT_TIMEOUT_MS = 120_000;

const LINTABLE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

const PACKAGE_JSON = JSON.stringify(
  {
    name: "crackerbox-lint",
    private: true,
    type: "module",
    devDependencies: {
      "@eslint/js": "^9.0.0",
      eslint: "^9.0.0",
      globals: "^15.0.0",
      typescript: "^5.4.0",
      "typescript-eslint": "^8.0.0",
    },
  },
  null,
  2
);

const ESLINT_CONFIG = [
  'import js from "@eslint/js";',
  'import tseslint from "typescript-eslint";',
  'import globals from "globals";',
  "",
  "export default tseslint.config(",
  '  { ignores: ["**/node_modules/**"] },',
  "  {",
  '    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],',
  "    languageOptions: { globals: globals.browser },",
  "  },",
  "  js.configs.recommended,",
  "  ...tseslint.configs.recommended,",
  ");",
  "",
].join("\n");

export function isLintablePath(path: string): boolean {
  return LINTABLE_EXT_RE.test(path);
}

async function ensureLintSetup(container: WebContainer): Promise<boolean> {
  try {
    try {
      await container.fs.mkdir(LINT_DIR, { recursive: true });
    } catch {
      // dir already exists
    }
    try {
      await container.fs.readFile(`${LINT_DIR}/.ready`, "utf-8");
      return true;
    } catch {
      // not set up yet
    }
    await container.fs.writeFile(`${LINT_DIR}/package.json`, PACKAGE_JSON);
    await container.fs.writeFile(`${LINT_DIR}/eslint.config.mjs`, ESLINT_CONFIG);
    const result = await spawnCommandInContainer(
      container,
      "npm",
      ["install", "--no-audit", "--no-fund", "--no-progress"],
      LINT_DIR,
      INSTALL_TIMEOUT_MS
    );
    if (result.error || result.timedOut || result.exitCode !== 0) return false;
    await container.fs.writeFile(`${LINT_DIR}/.ready`, "ok");
    return true;
  } catch {
    return false;
  }
}

function parseEslintJson(output: string): LintIssue[] | null {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  let parsed: Array<{
    messages?: Array<{
      ruleId?: string | null;
      severity?: number;
      message?: string;
      line?: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
    }>;
  }>;
  try {
    parsed = JSON.parse(output.slice(start, end + 1)) as typeof parsed;
  } catch {
    return null;
  }
  const issues: LintIssue[] = [];
  for (const file of parsed ?? []) {
    for (const m of file.messages ?? []) {
      issues.push({
        ruleId: m.ruleId ?? null,
        severity: m.severity === 2 ? 2 : 1,
        message: m.message ?? "Unknown lint issue",
        line: m.line ?? 0,
        column: m.column ?? 0,
        endLine: m.endLine,
        endColumn: m.endColumn,
      });
    }
  }
  return issues;
}

export async function lintContentInContainer(
  container: WebContainer,
  rawPath: string,
  content: string
): Promise<LintResult> {
  if (!isLintablePath(rawPath)) {
    return { ok: false, unavailable: true, error: "Not a lintable file type." };
  }
  let tmpPath = "";
  try {
    if (!(await ensureLintSetup(container))) {
      return { ok: false, unavailable: true, error: "Could not set up the linter." };
    }
    const extIndex = rawPath.lastIndexOf(".");
    const ext = extIndex >= 0 ? rawPath.slice(extIndex) : ".js";
    try {
      await container.fs.mkdir(`${LINT_DIR}/tmp`, { recursive: true });
    } catch {
      // dir already exists
    }
    tmpPath = `${LINT_DIR}/tmp/check-${Date.now()}${ext}`;
    await container.fs.writeFile(tmpPath, content);
    const result = await spawnCommandInContainer(
      container,
      "node",
      [
        `${LINT_DIR}/node_modules/eslint/bin/eslint.js`,
        "--no-config-lookup",
        "--config",
        `${LINT_DIR}/eslint.config.mjs`,
        "--format",
        "json",
        tmpPath,
      ],
      "/",
      LINT_TIMEOUT_MS
    );
    if (result.error || result.timedOut || result.exitCode < 0 || result.exitCode >= 2) {
      return {
        ok: false,
        unavailable: true,
        error: result.error ?? (result.timedOut ? "Lint timed out." : "Lint could not run."),
      };
    }
    const issues = parseEslintJson(result.output);
    if (!issues) {
      return { ok: false, unavailable: true, error: "Could not read lint output." };
    }
    const errors = issues.filter((i) => i.severity === 2).length;
    const warnings = issues.length - errors;
    return { ok: true, errors, warnings, issues };
  } catch {
    return { ok: false, unavailable: true };
  } finally {
    if (tmpPath) {
      try {
        await container.fs.rm(tmpPath, { force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}
