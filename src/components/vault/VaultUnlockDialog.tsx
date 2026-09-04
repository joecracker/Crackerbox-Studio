import { useEffect, useRef, useState } from "react";
import type { TokenVault } from "../../hooks/useTokenVault";

interface VaultUnlockDialogProps {
  vault: TokenVault;
  onDismiss: () => void;
  onGoDeploy?: () => void;
}

export default function VaultUnlockDialog({ vault, onDismiss, onGoDeploy }: VaultUnlockDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on input when dialog appears
  useEffect(() => inputRef.current?.focus(), []);

  const hasStoredAny =
    vault.hasStored("github") ||
    vault.hasStored("openrouter") ||
    vault.hasStored("opencode") ||
    vault.hasStored("google") ||
    vault.hasStored("homeassistant");

  if (vault.unlocked) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await vault.unlock(passphrase, trustDevice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
        {hasStoredAny ? (
          <>
            <h2 className="mb-4 text-xl font-semibold text-zinc-100">Unlock Cracker Box</h2>
            <p className="mb-4 text-zinc-400">
              Enter your passphrase to access your saved keys.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="passphrase" className="mb-2 block text-sm font-medium text-zinc-300">
                  Passphrase
                </label>
                <input
                  id="passphrase"
                  ref={inputRef}
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-sky-500 focus:outline-none"
                  placeholder="Your passphrase"
                />
                {vault.error && (
                  <p className="mt-2 text-sm text-red-400">{vault.error}</p>
                )}
              </div>
              <div className="mb-6 flex items-center">
                <input
                  id="trust-device"
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="trust-device" className="ml-2 text-sm text-zinc-300">
                  Trust this device (don't ask again)
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={vault.busy || !passphrase.trim()}
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-zinc-50 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {vault.busy ? "Unlocking…" : "Unlock"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-xl font-semibold text-zinc-100">Welcome to Cracker Box</h2>
            <p className="mb-4 text-zinc-400">
              To chat with a model, you'll need an OpenRouter API key (your secrets never leave
              this device).
            </p>
            <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400">
              Add your key under <span className="text-zinc-200">Deploy → Connect accounts</span>.
              You can also unlock later from Deploy — or just skip for now.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Skip for now
              </button>
              {onGoDeploy && (
                <button
                  type="button"
                  onClick={onGoDeploy}
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-zinc-50 hover:bg-sky-500"
                >
                  Set up my key
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
