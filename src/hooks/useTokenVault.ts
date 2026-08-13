import { useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { decryptToken, encryptToken } from "../utils/crypto";
import type { EncryptedPayload } from "../utils/crypto";

export type TokenService = "github" | "netlify" | "openrouter";

interface VaultState {
  github: EncryptedPayload | null;
  netlify: EncryptedPayload | null;
  openrouter: EncryptedPayload | null;
}

const VAULT_KEY = "crackerbox.deploy.vault";
const EMPTY_VAULT: VaultState = { github: null, netlify: null, openrouter: null };

export interface TokenVault {
  unlocked: boolean;
  tokens: Partial<Record<TokenService, string>>;
  hasStored: (service: TokenService) => boolean;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  saveToken: (service: TokenService, token: string) => Promise<void>;
  clearToken: (service: TokenService) => void;
  busy: boolean;
  error: string | null;
}

export function useTokenVault(): TokenVault {
  const [vault, setVault] = usePersistentState<VaultState>(VAULT_KEY, EMPTY_VAULT);
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Partial<Record<TokenService, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStored = (service: TokenService) => vault[service] !== null;

  const unlock = async (phrase: string) => {
    setBusy(true);
    setError(null);
    try {
      const result: Partial<Record<TokenService, string>> = {};
      if (vault.github) result.github = await decryptToken(phrase, vault.github);
      if (vault.netlify) result.netlify = await decryptToken(phrase, vault.netlify);
      if (vault.openrouter) result.openrouter = await decryptToken(phrase, vault.openrouter);
      setPassphrase(phrase);
      setTokens(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setPassphrase(null);
    setTokens({});
    setError(null);
  };

  const saveToken = async (service: TokenService, token: string) => {
    if (!passphrase) throw new Error("Unlock the vault first");
    const payload = await encryptToken(passphrase, token);
    setVault((prev) => ({ ...prev, [service]: payload }));
    setTokens((prev) => ({ ...prev, [service]: token }));
    setError(null);
  };

  const clearToken = (service: TokenService) => {
    setVault((prev) => ({ ...prev, [service]: null }));
    setTokens((prev) => {
      const next = { ...prev };
      delete next[service];
      return next;
    });
  };

  return {
    unlocked: passphrase !== null,
    tokens,
    hasStored,
    unlock,
    lock,
    saveToken,
    clearToken,
    busy,
    error,
  };
}
