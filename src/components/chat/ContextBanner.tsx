interface ContextBannerProps {
  level: "soft" | "hard";
  percent: number;
  onStart: () => void;
  busy: boolean;
  error: string | null;
  model: string | null;
}

function pct(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

export default function ContextBanner({
  level,
  percent,
  onStart,
  busy,
  error,
  model,
}: ContextBannerProps) {
  const hard = level === "hard";
  return (
    <div
      className={`mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${
        hard
          ? "border-red-900/70 bg-red-950/40"
          : "border-amber-900/60 bg-amber-950/40"
      }`}
      role={hard ? "alert" : "status"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={`shrink-0 ${hard ? "text-red-400" : "text-amber-400"}`}
      >
        <path
          d="M8 1.8 15 13.8H1L8 1.8Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <p className={`min-w-0 flex-1 text-[11px] leading-relaxed ${hard ? "text-red-300" : "text-amber-300"}`}>
        Session context is large ({pct(percent)}). Starting a new chat summarizes the current
        conversation and continues with its full context — nothing is lost.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
          hard
            ? "border-red-700 bg-red-600/20 text-red-200 hover:bg-red-600/30 disabled:opacity-50"
            : "border-sky-600 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
        }`}
      >
        {busy ? "Summarizing…" : "Start and chat"}
      </button>
      {error && (
        <span className="w-full text-[11px] text-zinc-400">
          Handoff failed: {error}
          {model ? ` (used ${model})` : ""}
        </span>
      )}
    </div>
  );
}