import type { DeployStrategy } from "../../hooks/useDeploySettings";

interface PendingChangesCardProps {
  visible: boolean;
  activeDirty: boolean;
  changedAtLabel: string | null;
  strategy: DeployStrategy;
  onStrategyChange: (strategy: DeployStrategy) => void;
  onDeployNow: () => void;
  busy: boolean;
  status: string | null;
  lastCheckAtLabel: string | null;
  lastCheckNote: string | null;
  canDeploy: boolean;
  blockedReason: string | null;
}

const STRATEGY_OPTIONS: Array<{
  value: DeployStrategy;
  label: string;
  hint: string;
}> = [
  {
    value: "manual",
    label: "Manual",
    hint: "Nothing pushes until you press Deploy.",
  },
  {
    value: "midnight",
    label: "Nightly at midnight",
    hint: "Once a day — pushes right after midnight, or the first time you open Cracker Box that day. Skipped automatically when there's nothing to send.",
  },
  {
    value: "session",
    label: "End of session",
    hint: "Warns you before closing with unsent changes so you can push them in one go. Unsent edits are kept and carried over to the next session.",
  },
];

export default function PendingChangesCard({
  visible,
  activeDirty,
  changedAtLabel,
  strategy,
  onStrategyChange,
  onDeployNow,
  busy,
  status,
  lastCheckAtLabel,
  lastCheckNote,
  canDeploy,
  blockedReason,
}: PendingChangesCardProps) {
  if (!visible) return null;

  return (
    <section className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Batched deploys
        </h3>
        {activeDirty ? (
          <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            pending
          </span>
        ) : (
          <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            up to date
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
        {activeDirty
          ? `This project has changes waiting to push${changedAtLabel ? ` since ${changedAtLabel}` : ""}. Edits keep piling up locally until the next deploy.`
          : "Every edit is already live — nothing is waiting to push."}
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Deployment strategy</legend>
        <div className="flex flex-col gap-1.5">
          {STRATEGY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                strategy === option.value
                  ? "border-sky-600 bg-sky-500/10"
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <input
                type="radio"
                name="deploy-strategy"
                value={option.value}
                checked={strategy === option.value}
                onChange={() => onStrategyChange(option.value)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 border-zinc-700 bg-zinc-900 accent-sky-500"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-zinc-200">{option.label}</span>
                <span className="block text-[11px] leading-snug text-zinc-500">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onDeployNow}
        disabled={busy || !activeDirty || !canDeploy}
        title={!activeDirty ? "No changes waiting" : !canDeploy ? blockedReason ?? "" : undefined}
        className="mt-3 w-full rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Deploying…" : "Push all pending changes now"}
      </button>
      {!canDeploy && (
        <p className="mt-1 text-[11px] text-amber-400">{blockedReason}</p>
      )}
      {lastCheckNote && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Last check{lastCheckAtLabel ? ` ${lastCheckAtLabel}` : ""} — {lastCheckNote}
        </p>
      )}
      {status && (
        <p className="mt-2 break-all rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-400">
          {status}
        </p>
      )}
    </section>
  );
}
