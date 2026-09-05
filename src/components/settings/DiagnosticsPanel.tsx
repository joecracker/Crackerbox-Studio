import { useEffect, useState } from "react";

const STREAM_LOG_KEY = "crackerbox.streamLog";

interface StreamEntry {
  t?: number;
  event?: string;
  [key: string]: unknown;
}

function loadLog(): StreamEntry[] {
  try {
    const raw = localStorage.getItem(STREAM_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StreamEntry[]) : [];
  } catch {
    return [];
  }
}

export default function DiagnosticsPanel() {
  const [log, setLog] = useState<StreamEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const refresh = () => setLog(loadLog());

  useEffect(() => {
    refresh();
  }, []);

  const handleCopy = () => {
    const text = JSON.stringify(log.slice(-15), null, 2);
    try {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable
    }
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Diagnostics
        </p>
        <button
          type="button"
          onClick={refresh}
          className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy last 15"}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-2">
        {log.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-zinc-500">
            No stream events recorded yet. Run a chat turn, then Refresh.
          </p>
        ) : (
          log.slice(-15).map((entry, i) => (
            <pre
              key={i}
              className="mb-1 whitespace-pre-wrap break-words rounded bg-zinc-900/60 px-2 py-1 text-[10px] leading-relaxed text-zinc-300"
            >
              {JSON.stringify(entry)}
            </pre>
          ))
        )}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
        Reproduce the lockup, click Refresh, then Copy last 15 and paste it to your assistant.
      </p>
    </div>
  );
}