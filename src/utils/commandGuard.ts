export interface DenyCheckResult {
  blocked: boolean;
  reason: string;
}

const DENY_PATTERNS: { test: RegExp; reason: string }[] = [
  {
    test: /^rm\s+(-[a-zA-Z]+)?\s*(?:\/|\/\*|~)\b/i,
    reason: "deleting the filesystem root is not allowed",
  },
  {
    test: /^rm\s+.*\s(-[a-zA-Z]*[rf][a-zA-Z]*)\s+(\/|\/\*|~)\b/i,
    reason: "deleting the filesystem root is not allowed",
  },
  {
    test: /(^|\s)(mkfs|mkfs\.\w+|fdisk|sfdisk|parted|mkswap|shred|wipefs|dd)(\s|$)/i,
    reason: "low-level disk operations are not allowed",
  },
  {
    test: /(^|[\s;|&])sudo(\s+|$)/i,
    reason: "privilege escalation is not allowed",
  },
  {
    test: /(^|[\s;|&])su(\s+-|$)/i,
    reason: "privilege escalation is not allowed",
  },
  {
    test: /(^|[\s;|&])(reboot|poweroff|shutdown|halt)(\s+|$)/i,
    reason: "system control commands are not allowed",
  },
  {
    test: /(^|[\s;|&])(mount|umount)(\s+|$)/i,
    reason: "filesystem mounts are not allowed",
  },
  {
    test: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
    reason: "fork bombs are not allowed",
  },
  {
    test: /\b(curl|wget|fetch)\b[^|;]*\|\s*\b(sh|bash|zsh)\b/i,
    reason: "piping a download into a shell is not allowed",
  },
  {
    test: /(^|[^>&])(>|>>)\s*\/\s*(?!(?:dev\/(?:null|stdout|stderr)))(etc|usr|var|bin|sbin|dev|home|root|boot|lib|opt)(\/|$)/i,
    reason: "writing outside the project root is not allowed",
  },
  {
    test: /\bchmod\s+(-R\s+)?[0-7]{3,4}([^\s]*)?\s+(\/|\/\*|~)/i,
    reason: "changing permissions on the filesystem root is not allowed",
  },
  {
    test: /\bchown\s+(-R\s+)?[^\s]+\s+(\/|\/\*|~)/i,
    reason: "changing ownership on the filesystem root is not allowed",
  },
];

export function checkCommandDenylist(command: string): DenyCheckResult {
  if (!command.trim()) {
    return { blocked: true, reason: "empty commands are not allowed" };
  }
  for (const { test, reason } of DENY_PATTERNS) {
    if (test.test(command)) return { blocked: true, reason };
  }
  return { blocked: false, reason: "" };
}

export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const char of command.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === " " || char === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  if (current) tokens.push(current);
  return tokens;
}