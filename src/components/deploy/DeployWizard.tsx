import { useState } from "react";
import type { DemoFile } from "../../data/demoFiles";
import type { TokenVault } from "../../hooks/useTokenVault";
import type { DeployQueue } from "../../hooks/useDeployQueue";
import type { DeploySettings } from "../../hooks/useDeploySettings";
import { deployProject, slugify } from "../../utils/deploy";
import type { DeployLogEntry, DeployResult } from "../../utils/deploy";
import PendingChangesCard from "./PendingChangesCard";

interface DeployWizardProps {
  projectId: string;
  projectName: string;
  files: DemoFile[];
  hosted: boolean;
  onToggleHosted: () => void;
  vault: TokenVault;
  queue: DeployQueue;
  settings: DeploySettings;
  autoBusy: boolean;
  autoStatus: string | null;
  onDeployQueued: () => void;
  onDeploySuccess: (target: {
    repoName: string;
    siteName: string;
    repoPrivate: boolean;
    cfAccountId: string;
  }) => void;
}

type Step = "accounts" | "configure" | "deploy";

const STEP_TITLES: Record<Step, string> = {
  accounts: "Connect accounts",
  configure: "Configure deploy",
  deploy: "Deploy",
};

function TokenField({
  label,
  placeholder,
  token,
  hasToken,
  onSave,
  onRemove,
}: {
  label: string;
  placeholder: string;
  token: string;
  hasToken: boolean;
  onSave: (value: string) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {hasToken && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Connected
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) onSave(value.trim());
            setValue("");
          }}
          disabled={!value.trim()}
          className="shrink-0 rounded-md border border-zinc-700 px-2.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        {hasToken && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:text-red-400"
          >
            Remove
          </button>
        )}
      </div>
      {token && (
        <p className="mt-1 truncate text-[11px] text-zinc-600">Saved · {token.slice(0, 6)}…</p>
      )}
    </div>
  );
}

function StepHeader({ step, current }: { step: Step; current: Step }) {
  const order: Step[] = ["accounts", "configure", "deploy"];
  const active = order.indexOf(step) === order.indexOf(current);
  const done = order.indexOf(step) < order.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          done
            ? "bg-emerald-500/15 text-emerald-400"
            : active
              ? "bg-sky-500 text-zinc-950"
              : "bg-zinc-800 text-zinc-500"
        }`}
      >
        {done ? "✓" : order.indexOf(step) + 1}
      </span>
      <span
        className={`text-xs font-medium ${active ? "text-zinc-100" : "text-zinc-500"}`}
      >
        {STEP_TITLES[step]}
      </span>
    </div>
  );
}

export default function DeployWizard({
  projectId,
  projectName,
  files,
  hosted,
  onToggleHosted,
  vault,
  queue,
  settings,
  autoBusy,
  autoStatus,
  onDeployQueued,
  onDeploySuccess,
}: DeployWizardProps) {
  const [step, setStep] = useState<Step>("accounts");
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [repoName, setRepoName] = useState(settings.repoName || projectName);
  const [repoPrivate, setRepoPrivate] = useState(settings.repoPrivate);
  const [siteName, setSiteName] = useState(settings.siteName || projectName);
  const [cfAccountId, setCfAccountId] = useState(settings.cfAccountId);
  const [log, setLog] = useState<DeployLogEntry[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);

  const hasStoredAny =
    vault.hasStored("github") ||
    vault.hasStored("cloudflare") ||
    vault.hasStored("openrouter");
  const canContinue =
    vault.unlocked && !!vault.tokens.github && (!hosted || !!vault.tokens.cloudflare);
  const canDeploy = canContinue && files.length > 0;

  const activeDirty = queue.isDirty(projectId);
  const changedAt = queue.changedAt(projectId);
  const changedAtLabel = changedAt
    ? new Date(changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const lastCheckAtLabel = settings.lastCheckAt
    ? new Date(settings.lastCheckAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const cardBlockedReason = !files.length
    ? "This project has no files to deploy."
    : !vault.unlocked
      ? "Unlock the vault first."
      : !vault.tokens.github
        ? "Connect a GitHub token in step 1."
        : hosted && !vault.tokens.cloudflare
          ? "Connect a Cloudflare token in step 1."
          : null;

  const handleUnlock = () => {
    setSetupError(null);
    if (!hasStoredAny && passphrase !== passphraseConfirm) {
      setSetupError("Passphrases do not match");
      return;
    }
    void vault.unlock(passphrase, trustDevice);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    setResult(null);
    setLog([]);
    try {
      const res = await deployProject(
        {
          projectName,
          files,
          githubToken: vault.tokens.github ?? "",
          cloudflareToken: vault.tokens.cloudflare ?? "",
          repoPrivate,
          siteName,
          cfAccountId: cfAccountId.trim(),
          hosted,
          label: `Cracker Box ${new Date().toISOString().slice(0, 10)}`,
        },
        (entry) => setLog((prev) => [...prev, entry])
      );
      setResult(res);
      onDeploySuccess({
        repoName: slugify(repoName),
        siteName: slugify(siteName),
        repoPrivate,
        cfAccountId: cfAccountId.trim(),
      });
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Deploy
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-zinc-300">
                {hosted ? "Hosted app" : "Local (Home Assistant)"}
              </div>
              <div className="text-[10px] leading-snug text-zinc-500">
                {hosted
                  ? "Reached via a URL from outside your home network — deploys to Cloudflare Pages."
                  : "Served by Home Assistant itself — GitHub backup only, no external host."}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleHosted}
              className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Switch to {hosted ? "local" : "hosted"}
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-1.5">
          <StepHeader step="accounts" current={step} />
          <StepHeader step="configure" current={step} />
          <StepHeader step="deploy" current={step} />
        </div>

        <PendingChangesCard
          visible
          activeDirty={activeDirty}
          changedAtLabel={changedAtLabel}
          strategy={settings.strategy}
          onStrategyChange={settings.setStrategy}
          onDeployNow={onDeployQueued}
          busy={autoBusy || deploying}
          status={autoStatus}
          lastCheckAtLabel={lastCheckAtLabel}
          lastCheckNote={settings.lastCheckNote}
          canDeploy={canDeploy}
          blockedReason={cardBlockedReason}
          hosted={hosted}
        />

        {step === "accounts" &&
          (vault.unlocked ? (
            <div className="flex flex-col gap-4">
              <TokenField
                label="GitHub token"
                placeholder="ghp_…"
                token={vault.tokens.github ?? ""}
                hasToken={!!vault.tokens.github}
                onSave={(value) => void vault.saveToken("github", value)}
                onRemove={() => vault.clearToken("github")}
              />
              <TokenField
                label="Cloudflare token"
                placeholder="CF API token…"
                token={vault.tokens.cloudflare ?? ""}
                hasToken={!!vault.tokens.cloudflare}
                onSave={(value) => void vault.saveToken("cloudflare", value)}
                onRemove={() => vault.clearToken("cloudflare")}
              />
              <TokenField
                label="OpenRouter API key (chat)"
                placeholder="sk-or-v1-…"
                token={vault.tokens.openrouter ?? ""}
                hasToken={!!vault.tokens.openrouter}
                onSave={(value) => void vault.saveToken("openrouter", value)}
                onRemove={() => vault.clearToken("openrouter")}
              />
              <p className="text-[11px] leading-relaxed text-zinc-600">
                The OpenRouter key powers chat in this workspace. It is encrypted with the same
                vault passphrase as your GitHub and Cloudflare tokens.
              </p>
              <button
                type="button"
                onClick={vault.lock}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Lock vault
              </button>
              <button
                type="button"
                onClick={() => setStep("configure")}
                disabled={!canContinue}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs leading-relaxed text-zinc-400">
                {hasStoredAny
                  ? "Enter your passphrase to unlock saved tokens."
                  : "Set a passphrase to encrypt your API tokens. It is never stored — you'll re-enter it to unlock on each visit."}
              </p>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
                placeholder="Passphrase"
                autoComplete="new-password"
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {!hasStoredAny && (
                <input
                  type="password"
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlock();
                  }}
                  placeholder="Confirm passphrase"
                  autoComplete="new-password"
                  className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              )}
              {(vault.error || setupError) && (
                <p className="text-xs text-red-400">{vault.error ?? setupError}</p>
              )}
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-sky-500"
                />
                Trust this device
                <span className="text-zinc-600">(persist tokens here without re-entering the passphrase)</span>
              </label>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={vault.busy || !passphrase.trim()}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hasStoredAny ? "Unlock" : "Set passphrase"}
              </button>
            </div>
          ))}

        {step === "configure" && (
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="deploy-repo"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                GitHub repo name
              </label>
              <input
                id="deploy-repo"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={repoPrivate}
                onChange={(e) => setRepoPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-sky-500"
              />
              Private repository
            </label>
            {hosted ? (
              <>
                <div>
                  <label
                    htmlFor="deploy-cf-account"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    Cloudflare account ID
                  </label>
                  <input
                    id="deploy-cf-account"
                    value={cfAccountId}
                    onChange={(e) => setCfAccountId(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="deploy-site"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    Cloudflare Pages project name
                  </label>
                  <input
                    id="deploy-site"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-600">
                  Will use: <span className="text-zinc-400">{slugify(repoName)}</span> ·{" "}
                  <span className="text-zinc-400">{slugify(siteName)}</span> (Cloudflare Pages)
                </p>
              </>
            ) : (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                This is a <span className="text-zinc-300">local</span> project — Home Assistant
                serves it itself, so no external host is configured. Only a GitHub repo is used,
                as a backup and version history.
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("accounts")}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("deploy")}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-sky-400"
              >
                Review deploy
              </button>
            </div>
          </div>
        )}

        {step === "deploy" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-zinc-400">
              {hosted ? (
                <>
                  Push <span className="text-zinc-200">{projectName}</span> to a new GitHub repo and
                  deploy it to Cloudflare Pages.
                </>
              ) : (
                <>
                  Push <span className="text-zinc-200">{projectName}</span> to a new GitHub repo for
                  backup. No external host — Home Assistant serves it locally.
                </>
              )}
            </p>
            {!canDeploy && (
              <p className="text-xs text-amber-400">
                {files.length === 0
                  ? "This project has no files to deploy."
                  : hosted
                    ? "Connect and unlock both tokens in step 1."
                    : "Connect and unlock a GitHub token in step 1."}
              </p>
            )}
            {!result && (
              <button
                type="button"
                onClick={() => void handleDeploy()}
                disabled={deploying || !canDeploy}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deploying ? "Deploying…" : "Deploy"}
              </button>
            )}
            {deployError && <p className="text-xs text-red-400">{deployError}</p>}
            {log.length > 0 && (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
                {log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-1.5 py-0.5 text-[11px] leading-relaxed">
                    <span
                      className={
                        entry.ok
                          ? "text-emerald-400"
                          : entry.step === "done"
                            ? "text-emerald-400"
                            : "text-zinc-500"
                      }
                    >
                      {entry.ok ? "✓" : "•"}
                    </span>
                    <span className="min-w-0 flex-1 text-zinc-400">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
            {result && (
              <div className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs">
                <p className="text-sm font-medium text-emerald-400">
                  {hosted ? "Deployed" : "Backed up to GitHub"}
                </p>
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sky-400 hover:underline"
                >
                  {result.repoUrl}
                </a>
                {result.siteUrl && (
                  <a
                    href={result.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sky-400 hover:underline"
                  >
                    {result.siteUrl}
                  </a>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Back
              </button>
              {result && (
                <button
                  type="button"
                  onClick={() => setStep("configure")}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Deploy again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
