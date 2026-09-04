import { useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { decryptToken, deriveVaultLookupKey, encryptToken } from "../utils/crypto";
import type { EncryptedPayload } from "../utils/crypto";

export type TokenService =
  | "github"
  | "openrouter"
  | "opencode"
  | "google"
  | "tavily"
  | "cloudflare"
  | "homeassistant";

interface VaultState {
  github: EncryptedPayload | null;
  openrouter: EncryptedPayload | null;
  opencode: EncryptedPayload | null;
  google: EncryptedPayload | null;
  tavily: EncryptedPayload | null;
  cloudflare: EncryptedPayload | null;
  homeassistant: EncryptedPayload | null;
}

type TokenMap = Partial<Record<TokenService, string>>;

const VAULT_KEY = "crackerbox.deploy.vault";
const TRUSTED_KEY = "crackerbox.vault.trusted";
const VAULT_API = "/api/vault";
const EMPTY_VAULT: VaultState = {
  github: null,
  openrouter: null,
  opencode: null,
  google: null,
  tavily: null,
  cloudflare: null,
  homeassistant: null,
};
const TRUSTED_SENTINEL = "trusted";

const SERVICES: TokenService[] = [
  "github",
  "openrouter",
  "opencode",
  "google",
  "tavily",
  "cloudflare",
  "homeassistant",
];

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
  syncToCloud: (passphraseOverride?: string) => Promise<boolean>;
  restoreFromCloud: (passphraseOverride?: string) => Promise<boolean>;
  cloudNeedsPassphrase: boolean;
  cloudStatus: string | null;
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
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const isTrustedUnlock = passphrase === TRUSTED_SENTINEL;

  const hasStored = (service: TokenService) =>
    vault[service] !== null || trusted[service] !== undefined;

  const unlock = async (phrase: string, trustThisDevice = false) => {
    setBusy(true);
    setError(null);
    try {
      const result: TokenMap = {};
      if (vault.github) result.github = await decryptToken(phrase, vault.github);
      if (vault.openrouter) result.openrouter = await decryptToken(phrase, vault.openrouter);
      if (vault.opencode) result.opencode = await decryptToken(phrase, vault.opencode);
      if (vault.google) result.google = await decryptToken(phrase, vault.google);
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
      "openrouter",
      "opencode",
      "google",
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

  // Resolves the REAL passphrase for cloud ops. When a device was auto-unlocked
// via "Trust this device" (passphrase is a sentinel, not a real phrase), the
// caller must supply their passphrase so the same key + ciphertext is produced
// on every device.
  const resolveCloudPhrase = (override?: string): string | null => {
    if (override && override.trim()) return override.trim();
    if (!isTrustedUnlock && passphrase) return passphrase;
    return null;
  };

  // Cloud sync: push the tokens (re-encrypted with the REAL passphrase) to
  // Cloudflare KV, keyed by the passphrase-derived hash. Any device that knows
  // the passphrase can restore. Never uses the trusted-device sentinel.
  const syncToCloud = async (passphraseOverride?: string): Promise<boolean> => {
    setError(null);
    setCloudStatus(null);
    const phrase = resolveCloudPhrase(passphraseOverride);
    if (!phrase) {
      setError(
        isTrustedUnlock
          ? "Enter your vault passphrase to sync to the cloud (trusted-device unlock doesn't carry it)."
          : "Unlock the vault first to sync to the cloud.",
      );
      return false;
    }
    setBusy(true);
    try {
      const key = await deriveVaultLookupKey(phrase);
      // Merge: start from whatever is already in the cloud so a device with no
      // tokens unlocked can NEVER wipe the shared vault. A clean cache + fresh
      // unlock + "Sync" used to overwrite the whole vault with nulls.
      const sealed: VaultState = { ...EMPTY_VAULT };
      try {
        const existing = await fetch(`${VAULT_API}?key=${encodeURIComponent(key)}`);
        const existingData = (await existing.json().catch(() => null)) as {
          vault?: VaultState | null;
        } | null;
        const remote = existingData?.vault;
        if (remote) {
          for (const service of SERVICES) {
            if (remote[service]) sealed[service] = remote[service];
          }
        }
      } catch {
        // best effort — if the remote read fails, fall through to local-only
      }
      for (const service of SERVICES) {
        const plain = tokens[service];
        if (plain) sealed[service] = await encryptToken(phrase, plain);
      }
      const res = await fetch(`${VAULT_API}?key=${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sealed),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Cloud sync failed (HTTP ${res.status}).`);
      }
      setCloudStatus("Vault synced to the cloud. It will survive clearing your cache.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cloud sync failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const restoreFromCloud = async (passphraseOverride?: string): Promise<boolean> => {
    setError(null);
    setCloudStatus(null);
    const phrase = resolveCloudPhrase(passphraseOverride);
    if (!phrase) {
      setError(
        isTrustedUnlock
          ? "Enter your vault passphrase to restore from the cloud (trusted-device unlock doesn't carry it)."
          : "Unlock the vault first to restore from the cloud.",
      );
      return false;
    }
    setBusy(true);
    try {
      const key = await deriveVaultLookupKey(phrase);
      const res = await fetch(`${VAULT_API}?key=${encodeURIComponent(key)}`);
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        vault?: VaultState | null;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Cloud restore failed (HTTP ${res.status}).`);
      }
      if (!data.vault) {
        setCloudStatus("No tokens are stored in the cloud yet. Sync once from a device that has tokens.");
        return false;
      }
      const result: TokenMap = {};
      const restored = data.vault;
      let hadPayloads = false;
      for (const service of SERVICES) {
        const payload = restored[service];
        if (payload) {
          hadPayloads = true;
          try {
            result[service] = await decryptToken(phrase, payload);
          } catch {
            // token sealed with a different passphrase — skip
          }
        }
      }
      if (!hadPayloads) {
        // Cloud vault exists but is empty — do NOT wipe this device's in-memory
        // tokens, and don't overwrite the persisted encrypted vault.
        setCloudStatus("The cloud vault is empty — no tokens synced to it yet. Sync from a device that has your tokens.");
        return false;
      }
      setVault(restored);
      setTokens(result);
      const count = Object.keys(result).length;
      setCloudStatus(
        count > 0
          ? `Restored ${count} token(s) from the cloud.`
          : "Cloud vault found, but no tokens could be decrypted with this passphrase — double-check you typed it exactly."
      );
      return count > 0;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cloud restore failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    unlocked: passphrase !== null,
    trusted: passphrase === TRUSTED_SENTINEL,
    cloudNeedsPassphrase: passphrase === TRUSTED_SENTINEL,
    tokens,
    hasStored,
    unlock,
    lock,
    saveToken,
    clearToken,
    exportTokens,
    importTokens,
    syncToCloud,
    restoreFromCloud,
    cloudStatus,
    busy,
    error,
  };
}