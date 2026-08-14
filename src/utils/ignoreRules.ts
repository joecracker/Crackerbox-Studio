/**
 * Shared rules for deciding which files/directories are excluded from project
 * trees and what counts as "too big" / "binary". Used both by the container
 * sync-back mirror and by project import.
 */

/** Directories excluded when mirroring the container back into the project tree. */
export const SYNC_EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache"]);

export const SYNC_MAX_FILE_BYTES = 1024 * 1024;

/**
 * Directories + files excluded when importing a real project. Superset of the
 * sync list, plus editor/tooling artifacts and OS junk.
 */
export const IMPORT_EXCLUDED_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cache",
  ".DS_Store",
  "Thumbs.db",
  ".vscode",
  ".idea",
  ".project",
  ".classpath",
  "coverage",
  ".parcel-cache",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".netlify",
  ".eslintcache",
  ".prettiercache",
  ".yarn",
  ".pnp",
  ".pnp.js",
]);

/** Per-file cap for imported files (bytes). Larger files are skipped. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Total cap for a single import (bytes). Once hit, remaining files are skipped. */
export const IMPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/** Max number of skipped paths surfaced to the user (keeps dialogs small). */
export const IMPORT_SKIPPED_CAP = 100;

export function shouldIgnoreName(name: string): boolean {
  return IMPORT_EXCLUDED_NAMES.has(name);
}

/** Best-effort binary detection: NUL byte in the first chunk indicates binary data. */
export function isLikelyBinaryBytes(bytes: Uint8Array): boolean {
  const check = bytes.subarray(0, Math.min(bytes.byteLength, 8192));
  for (let i = 0; i < check.byteLength; i++) {
    if (check[i] === 0) return true;
  }
  return false;
}
