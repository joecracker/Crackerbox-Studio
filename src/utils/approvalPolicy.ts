import type { DemoFile } from "../data/demoFiles";
import { flattenFiles } from "../data/demoFiles";
import { diffLines, diffStat } from "./diff";

export type GuardrailMode = "tiered" | "all" | "auto";

const TINY_EDIT_MAX_CHANGED_LINES = 4;

const SENSITIVE_BASENAME_RE =
  /^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|\.env(?:\.\w+)?|vite\.config\.[cm]?[jt]s|tsconfig(?:\.\w+)?\.json|eslint\.config\.[cm]?[jt]s|prettier\.config\.[cm]?[jt]s|.*\.config\.[cm]?[jt]s)$/i;

export function isTinySafeEdit(path: string, oldContent: string, newContent: string): boolean {
  if (!oldContent) return false;
  const basename = path.split("/").pop() ?? path;
  if (SENSITIVE_BASENAME_RE.test(basename)) return false;
  const { added, removed } = diffStat(diffLines(oldContent, newContent));
  return added + removed <= TINY_EDIT_MAX_CHANGED_LINES;
}

export interface FileIndex {
  paths: Set<string>;
  names: Map<string, string[]>;
}

const EDIT_VERB_RE =
  /\b(?:add|edit|change|update|modify|fix|rewrite|create|write|remove|delete|rename|replace|refactor|implement|redesign|improve|adjust|correct|redo|simplify)\b/i;

const NON_FILE_TOKEN_RE =
  /^(?:e\.g\.?|i\.e\.?|etc\.?|vs\.?|no\.?|mr\.?|ms\.?|dr\.?|st\.?|inc\.?|ltd\.?|co\.?|com)$/i;

const TOKEN_RE = /[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,12}/g;

function normalizePath(raw: string): string {
  let p = raw.trim();
  if (!p) return "";
  p = p.replace(/\\/g, "/");
  if (p.startsWith("/")) p = p.slice(1);
  while (p.startsWith("./")) p = p.slice(2);
  p = p.replace(/\/+$/, "");
  return p.toLowerCase();
}

function stripWrapping(token: string): string {
  let t = token.replace(/^[\s"'`([{]+/, "").replace(/[\s"'`)\]}.,;:!?]+$/, "");
  t = t.replace(/\.+$/, "");
  return t;
}

function basenameOf(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function hasWholeWord(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function isBareReference(sentence: string, token: string): boolean {
  const cleaned = sentence
    .replace(/^[\s"'`([{:-]+/, "")
    .replace(/[\s"'`)\]}.,;:!?-]+$/, "");
  return cleaned.length > 0 && cleaned.toLowerCase() === token.toLowerCase();
}

function extractFileTokens(sentence: string): string[] {
  const tokens: string[] = [];
  for (const match of sentence.matchAll(TOKEN_RE)) {
    const token = stripWrapping(match[0]);
    const lower = token.toLowerCase();
    if (!lower) continue;
    if (NON_FILE_TOKEN_RE.test(lower)) continue;
    if (/^(\d+\.\d+|\.\d+)$/.test(lower)) continue;
    tokens.push(lower);
  }
  return tokens;
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?]+(?=\s|$)|[\r\n]+/)
    .filter((s) => s.trim().length > 0);
}

export function buildFileIndex(nodes: DemoFile[]): FileIndex {
  const paths = new Set<string>();
  const names = new Map<string, string[]>();
  for (const file of flattenFiles(nodes)) {
    if (file.type !== "file") continue;
    const p = normalizePath(file.path);
    if (!p) continue;
    paths.add(p);
    const base = basenameOf(p);
    const list = names.get(base) ?? [];
    list.push(p);
    names.set(base, list);
  }
  return { paths, names };
}

export function isExplicitlyRequested(
  target: string,
  userTurn: string,
  index: FileIndex
): boolean {
  const normTarget = normalizePath(target);
  if (!normTarget) return false;
  const targetBase = basenameOf(normTarget);

  for (const sentence of sentences(userTurn)) {
    const tokens = extractFileTokens(sentence);
    const hasVerb = EDIT_VERB_RE.test(sentence);
    let referencesTarget = false;

    for (const token of tokens) {
      const norm = normalizePath(token);
      if (norm === normTarget) {
        referencesTarget = true;
        break;
      }
      if (basenameOf(norm) === targetBase && norm !== normTarget) {
        referencesTarget = true;
        break;
      }
    }

    if (!referencesTarget && index.names.has(targetBase)) {
      if (hasWholeWord(sentence, targetBase)) referencesTarget = true;
    }

    if (!referencesTarget) continue;
    if (hasVerb) return true;
    if (tokens.length === 1 && isBareReference(sentence, tokens[0])) return true;
  }

  return false;
}