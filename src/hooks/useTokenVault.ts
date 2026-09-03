import { useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { decryptToken, encryptToken } from "../utils/crypto";
import type { EncryptedPayload } from "../utils/crypto";

export type TokenService =
  | "github"
  | "netlify"
  | "openrouter"
  | "opencode"
  | "tavily"
  | "cloudflare"
  | "homeassistant";

interface VaultState {
  github: EncryptedPayload | null;
  netlify: EncryptedPayload | null;
  openrouter: EncryptedPayload | null;
  opencode: EncryptedPayload | null;
  tavily: EncryptedPayload | null;
  cloudflare: EncryptedPayload | null;
  homeassistant: EncryptedPayload | null;
}

type TokenMap = Partial<Record<TokenService, string>>;

const VAULT_KEY = "crackerbox.deploy.vault";
const TRUSTED_KEY = "crackerbox.vault.trusted";
const EMPTY_VAULT: VaultState = {
  github: null,
  netlify: null,
  openrouter: null,
  opencode: null,
  tavily: null,
  cloudflare: null,
  homeassistant: null,
};
const TRUSTED_SENTINEL = "trusted";

function hasAnyToken(map: TokenMap): boolean {
  return Object.keys(map).length > 0;
}

export interface TokenVault {
  unlocked: boolean;
  trusted: boolean;
  tokens: TokenMap;
  hasStored: (service: TokenService) => boolean;
  unlock: (passphrase: string, trustThisDevice?: boolean) => Promise<void>;
  lock: () => void;
  saveToken: (service: TokenService, token: string) => Promise<void>;
  clearToken: (service: TokenService) => void;
  exportTokens: () => string;
  importTokens: (json: string) => Promise<{ imported: TokenService[]; skipped: string[] }>;
  busy: boolean;
  error: string | null;
}

export function useTokenVault(): TokenVault {
  const [vault, setVault] = usePersistentState<VaultState>(VAULT_KEY, EMPTY_VAULT);
  const [trusted, setTrusted] = usePersistentState<TokenMap>(TRUSTED_KEY, {});
  const [passphrase, setPassphrase] = useState<string | null>(() =>
    hasAnyToken(trusted) ? TRUSTED_SENTINEL : null
  );
  const [trustSession, setTrustSession] = useState<boolean>(() => hasAnyToken(trusted));
  const [tokens, setTokens] = useState<TokenMap>(trusted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStored = (service: TokenService) =>
    vault[service] !== null || trusted[service] !== undefined;

  const unlock = async (phrase: string, trustThisDevice = false) => {
    setBusy(true);
    setError(null);
    try {
      const result: TokenMap = {};
      if (vault.github) result.github = await decryptToken(phrase, vault.github);
      if (vault.netlify) result.netlify = await decryptToken(phrase, vault.netlify);
      if (vault.openrouter) result.openrouter = await decryptToken(phrase, vault.openrouter);
      if (vault.opencode) result.opencode = await decryptToken(phrase, vault.opencode);
      if (vault.tavily) result.tavily = await decryptToken(phrase, vault.tavily);
      if (vault.cloudflare) result.cloudflare = await decryptToken(phrase, vault.cloudflare);
      if (vault.homeassistant) result.homeassistant = await decryptToken(phrase, vault.homeassistant);
      setPassphrase(phrase);
      setTokens(result);
      setTrustSession(trustThisDevice);
      if (trustThisDevice) {
        setTrusted((prev) => ({ ...prev, ...result }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setPassphrase(null);
    setTokens({});
    setTrusted({});
    setTrustSession(false);
    setError(null);
  };

  const saveToken = async (service: TokenService, token: string) => {
    if (!passphrase) throw new Error("Unlock the vault first");
    setTokens((prev) => ({ ...prev, [service]: token }));
    if (trustSession) {
      setTrusted((prev) => ({ ...prev, [service]: token }));
    } else {
      const payload = await encryptToken(passphrase, token);
      setVault((prev) => ({ ...prev, [service]: payload }));
    }
    setError(null);
  };

  const clearToken = (service: TokenService) => {
    setVault((prev) => ({ ...prev, [service]: null }));
    setTokens((prev) => {
      const next = { ...prev };
      delete next[service];
      return next;
    });
    setTrusted((prev) => {
      const next = { ...prev };
      delete next[service];
      return next;
    });
  };

  // Export the decrypted tokens as a JSON file string so the user can move them
  // between devices. Only available while unlocked (tokens are in memory then).
  const exportTokens = () => {
    if (!passphrase) throw new Error("Unlock the vault first to export tokens.");
    const filtered: TokenMap = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (v) filtered[k as TokenService] = v;
    }
    return JSON.stringify({ app: "crackerbox", kind: "vault", exportedAt: new Date().toISOString(), tokens: filtered }, null, 2);
  };

  // Import a vault export file and re-encrypt each token with THIS device's
  // passphrase (the target device must be unlocked). Returns what was imported.
  const importTokens = async (json: string): Promise<{ imported: TokenService[]; skipped: string[] }> => {
    if (!passphrase) throw new Error("Unlock the vault first to import tokens.");
    let parsed: { tokens?: TokenMap };
    try {
      parsed = JSON.parse(json) as { tokens?: TokenMap };
    } catch {
      throw new Error("That doesn't look like a vault export file.");
    }
    const incoming = parsed.tokens ?? {};
    const imported: TokenService[] = [];
    const skipped: string[] = [];
    const services = [
      "github",
      "netlify",
      "openrouter",
      "opencode",
      "tavily",
      "cloudflare",
      "homeassistant",
    ] as const;
    for (const service of services) {
      const val = incoming[service];
      if (typeof val === "string" && val.trim()) {
        await saveToken(service, val.trim());
        imported.push(service);
      }
    }
    if (imported.length === 0) skipped.push("No recognized tokens were found in that file.");
    return { imported, skipped };
  };

  return {
    unlocked: passphrase !== null,
    trusted: passphrase === TRUSTED_SENTINEL,
    tokens,
    hasStored,
    unlock,
    lock,
    saveToken,
    clearToken,
    exportTokens,
    importTokens,
    busy,
    error,
  };
}