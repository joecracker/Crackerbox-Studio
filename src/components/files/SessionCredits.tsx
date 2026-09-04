import type { OpenRouterCredits } from "../../hooks/useOpenRouterCredits";

interface SessionCreditsProps {
  tokenCount: number;
  contextLength: number | null;
  contextPercent: number | null;
  contextLevel: "ok" | "soft" | "hard" | "unknown";
  credits: OpenRouterCredits;
  creditsLoading: boolean;
  creditsError: string | null;
  onRefreshCredits: () => void;
}

const money = (n: number | null): string =>
  n === null ? "—" : `$${n.toFixed(2)}`;

// Stacked, compact panel for the file-tree footer. Small slot, so each
// metric gets its own line. Context color follows the warning thresholds.
export default function SessionCredits({
  tokenCount,
  contextLength,
  contextPercent,
  credits,
  creditsLoading,
  creditsError,
  onRefreshCredits,
}: SessionCreditsProps) {
  const pct =
    contextPercent !== null && contextPercent >= 0 ? Math.round(contextPercent * 100) : null;

  return (
    <div className="flex flex-col gap-1 border-t border-zinc-800 px-3 py-2 text-[11px] leading-tight">
      {/* Context — informational only, never blocks or warns */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
          Context
        </span>
        <span className="font-medium tabular-nums text-zinc-400">
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-600">Tokens</span>
        <span className="tabular-nums text-zinc-400">{tokenCount.toLocaleString()}</span>
      </div>
      {contextLength !== null && contextLength > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-600">Model ctx</span>
          <span className="tabular-nums text-zinc-500">{contextLength.toLocaleString()}</span>
        </div>
      )}

      {/* Credits */}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-1">
        <span className="text-zinc-500">Credits left</span>
        <span className="tabular-nums text-sky-400">
          {creditsLoading ? "…" : money(credits.remaining)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-600">Spent</span>
        <span className="tabular-nums text-zinc-400">{money(credits.totalUsage)}</span>
      </div>
      {creditsError && (
        <button
          type="button"
          onClick={onRefreshCredits}
          title="Retry loading credits"
          className="text-left text-[10px] text-amber-500/80 hover:text-amber-300"
        >
          {creditsError} — retry
        </button>
      )}
    </div>
  );
}
